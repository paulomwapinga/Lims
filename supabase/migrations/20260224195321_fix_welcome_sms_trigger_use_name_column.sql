/*
  # Fix Welcome SMS Trigger to Use Correct Patient Name Column

  1. Changes
    - Update send_welcome_sms function to use NEW.name instead of NEW.first_name || ' ' || NEW.last_name
    - The patients table has a single 'name' column, not separate first_name and last_name columns
  
  2. Security
    - Uses SECURITY DEFINER to bypass RLS when fetching settings
    - Only sends SMS if welcome_sms_enabled and sms_enabled are true
*/

CREATE OR REPLACE FUNCTION send_welcome_sms()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_sms_enabled boolean;
  v_welcome_sms_enabled boolean;
  v_sms_api_key text;
  v_sms_secret_key text;
  v_sms_source_addr text;
  v_welcome_sms_template text;
  v_clinic_name text;
  v_supabase_url text;
  v_supabase_anon_key text;
  v_message text;
  v_request_id bigint;
BEGIN
  SELECT 
    sms_enabled,
    welcome_sms_enabled,
    sms_api_key,
    sms_secret_key,
    sms_source_addr,
    welcome_sms_template,
    clinic_name,
    supabase_url,
    supabase_anon_key
  INTO 
    v_sms_enabled,
    v_welcome_sms_enabled,
    v_sms_api_key,
    v_sms_secret_key,
    v_sms_source_addr,
    v_welcome_sms_template,
    v_clinic_name,
    v_supabase_url,
    v_supabase_anon_key
  FROM facility_settings
  LIMIT 1;
  
  IF v_sms_enabled AND 
     v_welcome_sms_enabled AND
     v_sms_api_key IS NOT NULL AND v_sms_api_key != '' AND
     v_sms_secret_key IS NOT NULL AND v_sms_secret_key != '' AND
     v_sms_source_addr IS NOT NULL AND v_sms_source_addr != '' AND
     v_supabase_url IS NOT NULL AND v_supabase_anon_key IS NOT NULL THEN
    
    IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
      v_message := REPLACE(v_welcome_sms_template, '[PATIENT_NAME]', NEW.name);
      v_message := REPLACE(v_message, '[CLINIC_NAME]', COALESCE(v_clinic_name, 'Our Clinic'));
      
      SELECT extensions.http_post(
        url := v_supabase_url || '/functions/v1/send-sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
          'phone', NEW.phone,
          'message', v_message,
          'api_key', v_sms_api_key,
          'secret_key', v_sms_secret_key,
          'source_addr', v_sms_source_addr
        )
      ) INTO v_request_id;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send welcome SMS: %', SQLERRM;
    RETURN NEW;
END;
$$;
