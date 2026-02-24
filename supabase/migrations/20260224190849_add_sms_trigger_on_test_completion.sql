/*
  # Add SMS Notification Trigger for Completed Tests
  
  1. Changes
    - Create function to send SMS when test results are marked as completed
    - Add trigger on visit_tests table to fire after update
    - SMS only sent when results_status changes to 'completed'
    - Uses the send-sms edge function via pg_net extension
  
  2. How It Works
    - Lab tech marks test as completed (results_status = 'completed')
    - Trigger fires and calls edge function asynchronously
    - SMS sent to patient's phone number
    - Message template uses patient name from settings
  
  3. Requirements
    - pg_net extension must be enabled
    - SMS must be enabled in facility_settings
    - Valid SMS credentials configured
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION notify_patient_sms_on_test_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_name text;
  v_patient_phone text;
  v_test_name text;
  v_sms_enabled boolean;
  v_sms_api_key text;
  v_sms_secret_key text;
  v_sms_source_addr text;
  v_sms_template text;
  v_message text;
  v_request_id bigint;
BEGIN
  IF NEW.results_status = 'completed' AND (OLD.results_status IS NULL OR OLD.results_status != 'completed') THEN
    SELECT 
      sms_enabled, 
      sms_api_key, 
      sms_secret_key, 
      sms_source_addr,
      sms_template
    INTO 
      v_sms_enabled,
      v_sms_api_key,
      v_sms_secret_key,
      v_sms_source_addr,
      v_sms_template
    FROM facility_settings
    LIMIT 1;

    IF v_sms_enabled AND 
       v_sms_api_key IS NOT NULL AND v_sms_api_key != '' AND
       v_sms_secret_key IS NOT NULL AND v_sms_secret_key != '' AND
       v_sms_source_addr IS NOT NULL AND v_sms_source_addr != '' THEN
      
      SELECT p.name, p.phone, t.name
      INTO v_patient_name, v_patient_phone, v_test_name
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      JOIN tests t ON NEW.test_id = t.id
      WHERE v.id = NEW.visit_id;

      IF v_patient_phone IS NOT NULL AND v_patient_phone != '' THEN
        v_message := REPLACE(v_sms_template, '[PATIENT_NAME]', v_patient_name);
        v_message := REPLACE(v_message, '[TEST_NAME]', v_test_name);

        SELECT extensions.http_post(
          url := current_setting('app.supabase_url', true) || '/functions/v1/send-sms',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
          ),
          body := jsonb_build_object(
            'phone', v_patient_phone,
            'message', v_message,
            'api_key', v_sms_api_key,
            'secret_key', v_sms_secret_key,
            'source_addr', v_sms_source_addr
          )
        ) INTO v_request_id;
        
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_patient_sms ON visit_tests;

CREATE TRIGGER trigger_notify_patient_sms
  AFTER UPDATE ON visit_tests
  FOR EACH ROW
  EXECUTE FUNCTION notify_patient_sms_on_test_completion();