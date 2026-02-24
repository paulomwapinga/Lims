/*
  # Add Welcome SMS Trigger on Patient Creation

  1. Changes
    - Create function to send welcome SMS when a new patient is created
    - Create trigger to call the function after patient insert
  
  2. Security
    - Uses service role to bypass RLS when fetching settings
    - Only sends SMS if welcome_sms_enabled is true
  
  3. Notes
    - Replaces [PATIENT_NAME] with patient's full name
    - Replaces [CLINIC_NAME] with clinic name from settings
    - Uses Supabase Edge Function to send SMS via Beem Africa API
    - Runs asynchronously - doesn't block patient creation if SMS fails
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
  v_patient_name text;
  v_phone text;
  v_supabase_url text;
  v_service_role_key text;
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
  
  v_patient_name := NEW.first_name || ' ' || NEW.last_name;
  v_phone := NEW.phone;
  
  v_message := v_settings.welcome_sms_template;
  v_message := replace(v_message, '[PATIENT_NAME]', v_patient_name);
  v_message := replace(v_message, '[CLINIC_NAME]', COALESCE(v_settings.clinic_name, 'Our Clinic'));
  
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.supabase_service_role_key', true);
  
  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'phone', v_phone,
        'message', v_message,
        'api_key', v_settings.sms_api_key,
        'secret_key', v_settings.sms_secret_key,
        'source_addr', v_settings.sms_source_addr
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send welcome SMS: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_send_welcome_sms ON patients;

CREATE TRIGGER trigger_send_welcome_sms
  AFTER INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_sms();
