/*
  # Prevent Duplicate SMS - Send One SMS Per Visit

  1. Changes
    - Create a new table to track SMS sent per visit
    - Update SMS trigger to check if SMS was already sent for this visit
    - Send only ONE SMS per visit, listing all completed tests
    - Prevent multiple SMS when multiple tests are sent to doctor

  2. Security
    - Enable RLS on sms_log table
    - Only system functions can write to this table
*/

-- Create SMS log table to track sent messages
CREATE TABLE IF NOT EXISTS sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  sms_type text NOT NULL, -- 'test_results', 'welcome', etc.
  UNIQUE(visit_id, sms_type) -- Prevent duplicate SMS for same visit and type
);

-- Enable RLS
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view SMS logs
CREATE POLICY "Admins can view SMS logs"
  ON sms_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- System functions can insert SMS logs
CREATE POLICY "System can insert SMS logs"
  ON sms_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update the SMS trigger function
CREATE OR REPLACE FUNCTION notify_patient_sms_on_test_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_name text;
  v_patient_phone text;
  v_test_names text;
  v_sms_enabled text;
  v_sms_api_key text;
  v_sms_secret_key text;
  v_sms_source_addr text;
  v_completion_message text;
  v_supabase_url text;
  v_supabase_anon_key text;
  v_sms_already_sent boolean;
  v_visit_id uuid;
BEGIN
  -- Only proceed if sent_to_doctor_at was just set (changed from NULL to a value)
  IF NEW.sent_to_doctor_at IS NOT NULL AND (OLD.sent_to_doctor_at IS NULL OR OLD.sent_to_doctor_at != NEW.sent_to_doctor_at) THEN
    BEGIN
      v_visit_id := NEW.visit_id;

      -- Check if we already sent SMS for this visit
      SELECT EXISTS(
        SELECT 1 FROM sms_log 
        WHERE visit_id = v_visit_id 
        AND sms_type = 'test_results'
      ) INTO v_sms_already_sent;

      -- If SMS already sent for this visit, skip
      IF v_sms_already_sent THEN
        RETURN NEW;
      END IF;

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
        v_completion_message := 'Hello {patient_name}, your test results are ready. Please visit the clinic.';
      END IF;
      
      IF v_supabase_url IS NULL THEN
        v_supabase_url := 'https://rjjxheikbfzrmdvjfrva.supabase.co';
      END IF;
      
      IF v_supabase_anon_key IS NULL THEN
        v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqanhoZWlrYmZ6cm1kdmpmcnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTY1NTcsImV4cCI6MjA4NjM5MjU1N30.jadidCfgPpGlqW0deToPOHwqm60JRQHP4lQ2tWIW48M';
      END IF;

      -- Get patient details
      SELECT p.name, p.phone
      INTO v_patient_name, v_patient_phone
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = v_visit_id;

      -- Validate phone number
      IF v_patient_phone IS NULL OR v_patient_phone = '' THEN
        RETURN NEW;
      END IF;

      -- Get all test names for this visit that are completed and sent to doctor
      SELECT string_agg(t.name, ', ')
      INTO v_test_names
      FROM visit_tests vt
      JOIN tests t ON vt.test_id = t.id
      WHERE vt.visit_id = v_visit_id
        AND vt.sent_to_doctor_at IS NOT NULL
      ORDER BY t.name;

      -- Replace placeholders in message
      v_completion_message := REPLACE(v_completion_message, '{patient_name}', v_patient_name);
      
      -- If message contains {test_name}, replace with all test names
      IF v_completion_message LIKE '%{test_name}%' THEN
        v_completion_message := REPLACE(v_completion_message, '{test_name}', COALESCE(v_test_names, 'test'));
      END IF;

      -- Call the send-sms edge function
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

      -- Log that we sent SMS for this visit
      INSERT INTO sms_log (visit_id, phone_number, message, sms_type)
      VALUES (v_visit_id, v_patient_phone, v_completion_message, 'test_results');

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send SMS notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
