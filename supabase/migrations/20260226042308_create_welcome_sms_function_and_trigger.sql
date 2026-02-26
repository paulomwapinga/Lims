/*
  # Create Welcome SMS Function and Trigger

  1. Changes
    - Create send_welcome_sms_to_patient() function
    - Create trigger to send welcome SMS when a new patient is created
    - Uses Beem Africa API credentials from settings
    
  2. Function Logic
    - Checks if SMS and welcome SMS are enabled
    - Validates phone number
    - Replaces placeholders in welcome message
    - Calls send-sms edge function via pg_net
    
  3. Security
    - Function runs as SECURITY DEFINER to bypass RLS
    - Uses settings table for configuration
*/

-- Create function to send welcome SMS when a new patient is created
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

  -- Exit if SMS or welcome SMS is not enabled
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

  -- Call the send-sms edge function using pg_net
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

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS send_welcome_sms_trigger ON patients;

-- Create trigger to send welcome SMS to new patients
CREATE TRIGGER send_welcome_sms_trigger
  AFTER INSERT ON patients
  FOR EACH ROW
  EXECUTE FUNCTION send_welcome_sms_to_patient();