/*
  # Fix Welcome SMS Trigger to Use pg_net Extension

  1. Changes
    - Update welcome SMS function to use pg_net.http_post
    - Use hardcoded Supabase URL
    - Get service role key from facility_settings
  
  2. Notes
    - Service role key must be stored in facility_settings table
    - Uses pg_net extension for async HTTP calls
*/

-- Add service_role_key column to facility_settings if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facility_settings' AND column_name = 'service_role_key'
  ) THEN
    ALTER TABLE facility_settings ADD COLUMN service_role_key text;
  END IF;
END $$;

-- Update the welcome SMS function
CREATE OR REPLACE FUNCTION send_welcome_sms()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings record;
  v_message text;
  v_patient_name text;
  v_phone text;
  v_request_id bigint;
BEGIN
  SELECT * INTO v_settings FROM facility_settings LIMIT 1;
  
  IF v_settings.welcome_sms_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  
  IF v_settings.sms_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  
  IF v_settings.service_role_key IS NULL THEN
    RAISE WARNING 'Service role key not configured in settings';
    RETURN NEW;
  END IF;
  
  v_patient_name := NEW.first_name || ' ' || NEW.last_name;
  v_phone := NEW.phone;
  
  v_message := v_settings.welcome_sms_template;
  v_message := replace(v_message, '[PATIENT_NAME]', v_patient_name);
  v_message := replace(v_message, '[CLINIC_NAME]', COALESCE(v_settings.clinic_name, 'Our Clinic'));
  
  SELECT INTO v_request_id pg_net.http_post(
    url := 'https://rjjxheikbfzrmdvjfrva.supabase.co/functions/v1/send-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_settings.service_role_key
    ),
    body := jsonb_build_object(
      'phone', v_phone,
      'message', v_message,
      'api_key', v_settings.sms_api_key,
      'secret_key', v_settings.sms_secret_key,
      'source_addr', v_settings.sms_source_addr
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send welcome SMS: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Also update the test results completed SMS trigger
CREATE OR REPLACE FUNCTION send_test_completed_sms()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings record;
  v_message text;
  v_patient record;
  v_visit record;
  v_test record;
  v_request_id bigint;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO v_settings FROM facility_settings LIMIT 1;
  
  IF v_settings.sms_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  
  IF v_settings.service_role_key IS NULL THEN
    RAISE WARNING 'Service role key not configured in settings';
    RETURN NEW;
  END IF;
  
  SELECT * INTO v_test FROM visit_tests WHERE id = NEW.visit_test_id;
  SELECT * INTO v_visit FROM visits WHERE id = v_test.visit_id;
  SELECT * INTO v_patient FROM patients WHERE id = v_visit.patient_id;
  
  IF v_patient.phone IS NULL OR v_patient.phone = '' THEN
    RETURN NEW;
  END IF;
  
  v_message := v_settings.sms_template;
  v_message := replace(v_message, '[PATIENT_NAME]', v_patient.first_name || ' ' || v_patient.last_name);
  v_message := replace(v_message, '[CLINIC_NAME]', COALESCE(v_settings.clinic_name, 'Our Clinic'));
  
  SELECT INTO v_request_id pg_net.http_post(
    url := 'https://rjjxheikbfzrmdvjfrva.supabase.co/functions/v1/send-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_settings.service_role_key
    ),
    body := jsonb_build_object(
      'phone', v_patient.phone,
      'message', v_message,
      'api_key', v_settings.sms_api_key,
      'secret_key', v_settings.sms_secret_key,
      'source_addr', v_settings.sms_source_addr
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send SMS: %', SQLERRM;
    RETURN NEW;
END;
$$;