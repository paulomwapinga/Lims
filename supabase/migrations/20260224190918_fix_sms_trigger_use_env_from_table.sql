/*
  # Fix SMS Trigger to Use Environment Variables from Table
  
  1. Changes
    - Add supabase_url and supabase_anon_key to facility_settings
    - Update trigger function to use these values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'supabase_url'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN supabase_url text DEFAULT 'https://rjjxheikbfzrmdvjfrva.supabase.co';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'supabase_anon_key'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN supabase_anon_key text DEFAULT 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqanhoZWlrYmZ6cm1kdmpmcnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTY1NTcsImV4cCI6MjA4NjM5MjU1N30.jadidCfgPpGlqW0deToPOHwqm60JRQHP4lQ2tWIW48M';
  END IF;
END $$;

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
  v_supabase_url text;
  v_supabase_anon_key text;
  v_request_id bigint;
BEGIN
  IF NEW.results_status = 'completed' AND (OLD.results_status IS NULL OR OLD.results_status != 'completed') THEN
    SELECT 
      sms_enabled, 
      sms_api_key, 
      sms_secret_key, 
      sms_source_addr,
      sms_template,
      supabase_url,
      supabase_anon_key
    INTO 
      v_sms_enabled,
      v_sms_api_key,
      v_sms_secret_key,
      v_sms_source_addr,
      v_sms_template,
      v_supabase_url,
      v_supabase_anon_key
    FROM facility_settings
    LIMIT 1;

    IF v_sms_enabled AND 
       v_sms_api_key IS NOT NULL AND v_sms_api_key != '' AND
       v_sms_secret_key IS NOT NULL AND v_sms_secret_key != '' AND
       v_sms_source_addr IS NOT NULL AND v_sms_source_addr != '' AND
       v_supabase_url IS NOT NULL AND v_supabase_anon_key IS NOT NULL THEN
      
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
          url := v_supabase_url || '/functions/v1/send-sms',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key
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