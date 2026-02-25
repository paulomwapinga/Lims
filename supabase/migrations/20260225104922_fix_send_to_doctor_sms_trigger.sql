/*
  # Fix Send to Doctor SMS Trigger

  1. Changes
    - Update notify_patient_sms_on_test_completion() to use the correct settings table structure
    - Use get_setting() helper function to read from settings table
    - Use net.http_post instead of extensions.http_post
    - Fix template placeholder format to match {patient_name} and {test_name}
    - Ensure trigger fires when results_status changes to 'completed'

  2. Security
    - Function checks if SMS is enabled before sending
    - Error handling ensures database operations aren't blocked by SMS failures
*/

-- Drop and recreate the function with correct settings access
CREATE OR REPLACE FUNCTION notify_patient_sms_on_test_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_name text;
  v_patient_phone text;
  v_test_name text;
  v_sms_enabled text;
  v_sms_api_key text;
  v_sms_secret_key text;
  v_sms_source_addr text;
  v_completion_message text;
  v_supabase_url text;
  v_supabase_anon_key text;
BEGIN
  -- Only proceed if results_status changed to 'completed'
  IF NEW.results_status = 'completed' AND (OLD.results_status IS NULL OR OLD.results_status != 'completed') THEN
    BEGIN
      -- Get settings using the get_setting helper function
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

      -- Get patient and test details
      SELECT p.name, p.phone, t.name
      INTO v_patient_name, v_patient_phone, v_test_name
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      JOIN tests t ON NEW.test_id = t.id
      WHERE v.id = NEW.visit_id;

      -- Validate phone number
      IF v_patient_phone IS NULL OR v_patient_phone = '' THEN
        RETURN NEW;
      END IF;

      -- Replace placeholders in message
      v_completion_message := REPLACE(v_completion_message, '{patient_name}', v_patient_name);
      v_completion_message := REPLACE(v_completion_message, '{test_name}', v_test_name);

      -- Call the send-sms edge function using pg_net
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

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send SMS notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
