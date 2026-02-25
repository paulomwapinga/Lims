/*
  # Fix Welcome SMS Trigger Phone Variable

  1. Changes
    - Fix undefined v_phone variable - should use NEW.phone directly
  
  2. Notes
    - Previous version had v_phone in http_post but wasn't set
*/

CREATE OR REPLACE FUNCTION send_welcome_sms()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_settings record;
  v_message text;
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
  
  v_message := v_settings.welcome_sms_template;
  v_message := replace(v_message, '[PATIENT_NAME]', NEW.name);
  v_message := replace(v_message, '[CLINIC_NAME]', COALESCE(v_settings.clinic_name, 'Our Clinic'));
  
  SELECT INTO v_request_id pg_net.http_post(
    url := 'https://rjjxheikbfzrmdvjfrva.supabase.co/functions/v1/send-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_settings.service_role_key
    ),
    body := jsonb_build_object(
      'phone', NEW.phone,
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