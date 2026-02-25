/*
  # Fix SMS Triggers to Use Beem Africa Credentials

  1. Changes
    - Update notify_patient_results_ready() to use Beem Africa credentials (api_key, secret_key, source_addr)
    - Update send_welcome_sms_to_patient() to use Beem Africa credentials
    - Remove old apiUrl and apiKey parameters
    - Triggers now check for sms_api_key, sms_secret_key, and sms_source_addr instead of sms_api_url

  2. Security
    - Triggers still check if SMS is enabled before sending
    - Error handling ensures database operations aren't blocked by SMS failures
*/

-- Function to send SMS when all test results are completed
CREATE OR REPLACE FUNCTION notify_patient_results_ready()
RETURNS TRIGGER AS $$
DECLARE
  v_visit_test_id uuid;
  v_patient_phone text;
  v_patient_name text;
  v_test_name text;
  v_sms_enabled text;
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
  v_sms_api_key := get_setting('sms_api_key');
  v_sms_secret_key := get_setting('sms_secret_key');
  v_sms_source_addr := get_setting('sms_source_addr');
  v_completion_message := get_setting('sms_completion_message');
  v_supabase_url := get_setting('supabase_url');
  v_supabase_anon_key := get_setting('supabase_anon_key');

  -- Exit if SMS is not enabled or not configured
  IF v_sms_enabled IS NULL OR v_sms_enabled != 'true' OR 
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

-- Function to send welcome SMS when a new patient is created
CREATE OR REPLACE FUNCTION send_welcome_sms_to_patient()
RETURNS TRIGGER AS $$
DECLARE
  v_sms_enabled text;
  v_welcome_sms_enabled text;
  v_sms_api_key text;
  v_sms_secret_key text;
  v_sms_source_addr text;
  v_welcome_message text;
  v_clinic_name text;
  v_supabase_url text;
  v_supabase_anon_key text;
BEGIN
  -- Get settings
  v_sms_enabled := get_setting('sms_enabled');
  v_welcome_sms_enabled := get_setting('welcome_sms_enabled');
  v_sms_api_key := get_setting('sms_api_key');
  v_sms_secret_key := get_setting('sms_secret_key');
  v_sms_source_addr := get_setting('sms_source_addr');
  v_welcome_message := get_setting('welcome_sms_message');
  v_clinic_name := get_setting('clinic_name');
  v_supabase_url := get_setting('supabase_url');
  v_supabase_anon_key := get_setting('supabase_anon_key');

  -- Exit if SMS or welcome SMS is not enabled or not configured
  IF v_sms_enabled IS NULL OR v_sms_enabled != 'true' OR 
     v_welcome_sms_enabled IS NULL OR v_welcome_sms_enabled != 'true' OR 
     v_sms_api_key IS NULL OR v_sms_api_key = '' OR
     v_sms_secret_key IS NULL OR v_sms_secret_key = '' OR
     v_sms_source_addr IS NULL OR v_sms_source_addr = '' THEN
    RETURN NEW;
  END IF;

  -- Use defaults if not set
  IF v_welcome_message IS NULL THEN
    v_welcome_message := 'Welcome {patient_name}! Thank you for choosing {clinic_name}. We wish you good health.';
  END IF;
  
  IF v_clinic_name IS NULL THEN
    v_clinic_name := 'REMTULLAH MEDICAL LABORATORY';
  END IF;
  
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rjjxheikbfzrmdvjfrva.supabase.co';
  END IF;
  
  IF v_supabase_anon_key IS NULL THEN
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqanhoZWlrYmZ6cm1kdmpmcnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTY1NTcsImV4cCI6MjA4NjM5MjU1N30.jadidCfgPpGlqW0deToPOHwqm60JRQHP4lQ2tWIW48M';
  END IF;

  -- Validate phone number
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;

  -- Replace placeholders in message
  v_welcome_message := REPLACE(v_welcome_message, '{patient_name}', NEW.name);
  v_welcome_message := REPLACE(v_welcome_message, '{clinic_name}', v_clinic_name);

  -- Call the send-sms edge function using pg_net with Beem Africa credentials
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := jsonb_build_object(
        'phone', NEW.phone,
        'message', v_welcome_message,
        'api_key', v_sms_api_key,
        'secret_key', v_sms_secret_key,
        'source_addr', v_sms_source_addr
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send welcome SMS: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;