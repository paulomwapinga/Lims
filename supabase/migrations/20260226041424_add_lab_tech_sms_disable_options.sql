/*
  # Add Lab Tech SMS Disable Options

  1. Changes
    - Add `lab_tech_auto_send_sms` setting (default: false) to disable automatic SMS when lab tech saves results
    - Add `doctor_auto_send_sms` setting (default: false) to disable automatic SMS when sending results to doctor
    - Update triggers to check these settings before sending SMS
    
  2. Settings Added
    - lab_tech_auto_send_sms: Controls whether SMS is sent automatically when lab tech completes test results
    - doctor_auto_send_sms: Controls whether SMS is sent automatically when results are sent to doctor
    
  3. Security
    - Settings are checked in triggers before SMS is sent
    - Users can still manually trigger SMS if needed
*/

-- Add settings for lab tech SMS auto-send control
INSERT INTO settings (key, value)
VALUES 
  ('lab_tech_auto_send_sms', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES 
  ('doctor_auto_send_sms', 'false')
ON CONFLICT (key) DO NOTHING;

-- Update the notify_patient_results_ready function to check lab_tech_auto_send_sms setting
CREATE OR REPLACE FUNCTION notify_patient_results_ready()
RETURNS TRIGGER AS $$
DECLARE
  v_visit_test_id uuid;
  v_patient_phone text;
  v_patient_name text;
  v_test_name text;
  v_sms_enabled text;
  v_lab_tech_auto_send_sms text;
  v_sms_api_key text;
  v_sms_secret_key text;
  v_sms_source_addr text;
  v_completion_message text;
  v_total_params int;
  v_completed_params int;
  v_supabase_url text;
  v_supabase_anon_key text;
BEGIN
  -- Get settings
  v_sms_enabled := get_setting('sms_enabled');
  v_lab_tech_auto_send_sms := get_setting('lab_tech_auto_send_sms');
  v_sms_api_key := get_setting('sms_api_key');
  v_sms_secret_key := get_setting('sms_secret_key');
  v_sms_source_addr := get_setting('sms_source_addr');
  v_completion_message := get_setting('sms_completion_message');
  v_supabase_url := get_setting('supabase_url');
  v_supabase_anon_key := get_setting('supabase_anon_key');

  -- Exit if SMS is not enabled or auto-send is disabled
  IF v_sms_enabled IS NULL OR v_sms_enabled != 'true' OR 
     v_lab_tech_auto_send_sms IS NULL OR v_lab_tech_auto_send_sms != 'true' OR
     v_sms_api_key IS NULL OR v_sms_api_key = '' OR
     v_sms_secret_key IS NULL OR v_sms_secret_key = '' OR
     v_sms_source_addr IS NULL OR v_sms_source_addr = '' THEN
    RETURN NEW;
  END IF;

  -- Use defaults if not set
  IF v_completion_message IS NULL THEN
    v_completion_message := 'Hello {patient_name}, your {test_name} results are ready. Please visit the clinic.';
  END IF;
  
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rjjxheikbfzrmdvjfrva.supabase.co';
  END IF;
  
  IF v_supabase_anon_key IS NULL THEN
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqanhoZWlrYmZ6cm1kdmpmcnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTY1NTcsImV4cCI6MjA4NjM5MjU1N30.jadidCfgPpGlqW0deToPOHwqm60JRQHP4lQ2tWIW48M';
  END IF;

  -- Get visit_test_id from the test result
  v_visit_test_id := NEW.visit_test_id;

  -- Check if all parameters for this visit_test are now completed
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN vtr.value IS NOT NULL AND vtr.value != '' THEN 1 END)
  INTO 
    v_total_params,
    v_completed_params
  FROM test_parameters tp
  LEFT JOIN visit_test_results vtr ON vtr.test_parameter_id = tp.id AND vtr.visit_test_id = v_visit_test_id
  WHERE tp.test_id = (SELECT test_id FROM visit_tests WHERE id = v_visit_test_id);

  -- Only send SMS if all parameters are completed
  IF v_completed_params < v_total_params THEN
    RETURN NEW;
  END IF;

  -- Get patient details
  SELECT 
    p.phone,
    p.name,
    t.name
  INTO 
    v_patient_phone,
    v_patient_name,
    v_test_name
  FROM visit_tests vt
  JOIN visits v ON vt.visit_id = v.id
  JOIN patients p ON v.patient_id = p.id
  JOIN tests t ON vt.test_id = t.id
  WHERE vt.id = v_visit_test_id;

  -- Validate phone number
  IF v_patient_phone IS NULL OR v_patient_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Replace placeholders in message
  v_completion_message := REPLACE(v_completion_message, '{patient_name}', v_patient_name);
  v_completion_message := REPLACE(v_completion_message, '{test_name}', v_test_name);

  -- Call the send-sms edge function using pg_net with Beem Africa credentials
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := jsonb_build_object(
        'phone', v_patient_phone,
        'message', v_completion_message,
        'api_key', v_sms_api_key,
        'secret_key', v_sms_secret_key,
        'source_addr', v_sms_source_addr
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send SMS: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the send_to_doctor_sms function to check doctor_auto_send_sms setting
CREATE OR REPLACE FUNCTION send_to_doctor_sms()
RETURNS TRIGGER AS $$
DECLARE
  v_doctor_phone text;
  v_doctor_name text;
  v_patient_name text;
  v_test_name text;
  v_sms_enabled text;
  v_doctor_auto_send_sms text;
  v_sms_api_key text;
  v_sms_secret_key text;
  v_sms_source_addr text;
  v_doctor_message text;
  v_supabase_url text;
  v_supabase_anon_key text;
  v_already_sent boolean;
BEGIN
  -- Check if SMS was already sent for this visit_test
  SELECT sms_sent_at IS NOT NULL INTO v_already_sent
  FROM visit_tests
  WHERE id = NEW.id;

  -- Exit if SMS was already sent
  IF v_already_sent THEN
    RETURN NEW;
  END IF;

  -- Get settings
  v_sms_enabled := get_setting('sms_enabled');
  v_doctor_auto_send_sms := get_setting('doctor_auto_send_sms');
  v_sms_api_key := get_setting('sms_api_key');
  v_sms_secret_key := get_setting('sms_secret_key');
  v_sms_source_addr := get_setting('sms_source_addr');
  v_doctor_message := get_setting('doctor_sms_message');
  v_supabase_url := get_setting('supabase_url');
  v_supabase_anon_key := get_setting('supabase_anon_key');

  -- Exit if SMS is not enabled, auto-send is disabled, or send_to_doctor is false
  IF v_sms_enabled IS NULL OR v_sms_enabled != 'true' OR 
     v_doctor_auto_send_sms IS NULL OR v_doctor_auto_send_sms != 'true' OR
     NEW.send_to_doctor != true OR
     v_sms_api_key IS NULL OR v_sms_api_key = '' OR
     v_sms_secret_key IS NULL OR v_sms_secret_key = '' OR
     v_sms_source_addr IS NULL OR v_sms_source_addr = '' THEN
    RETURN NEW;
  END IF;

  -- Use defaults if not set
  IF v_doctor_message IS NULL THEN
    v_doctor_message := 'Dr. {doctor_name}, {test_name} results for patient {patient_name} are ready for review.';
  END IF;
  
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rjjxheikbfzrmdvjfrva.supabase.co';
  END IF;
  
  IF v_supabase_anon_key IS NULL THEN
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqanhoZWlrYmZ6cm1kdmpmcnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTY1NTcsImV4cCI6MjA4NjM5MjU1N30.jadidCfgPpGlqW0deToPOHwqm60JRQHP4lQ2tWIW48M';
  END IF;

  -- Get doctor and patient details
  SELECT 
    u.phone,
    u.name,
    p.name,
    t.name
  INTO 
    v_doctor_phone,
    v_doctor_name,
    v_patient_name,
    v_test_name
  FROM visit_tests vt
  JOIN visits v ON vt.visit_id = v.id
  JOIN patients p ON v.patient_id = p.id
  JOIN tests t ON vt.test_id = t.id
  JOIN users u ON v.doctor_id = u.id
  WHERE vt.id = NEW.id;

  -- Validate doctor phone number
  IF v_doctor_phone IS NULL OR v_doctor_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Replace placeholders in message
  v_doctor_message := REPLACE(v_doctor_message, '{doctor_name}', v_doctor_name);
  v_doctor_message := REPLACE(v_doctor_message, '{patient_name}', v_patient_name);
  v_doctor_message := REPLACE(v_doctor_message, '{test_name}', v_test_name);

  -- Call the send-sms edge function
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := jsonb_build_object(
        'phone', v_doctor_phone,
        'message', v_doctor_message,
        'api_key', v_sms_api_key,
        'secret_key', v_sms_secret_key,
        'source_addr', v_sms_source_addr
      )
    );
    
    -- Update sms_sent_at timestamp
    UPDATE visit_tests SET sms_sent_at = NOW() WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send SMS to doctor: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;