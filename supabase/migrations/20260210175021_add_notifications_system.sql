/*
  # Lab Results Notification System

  ## New Tables

  1. `notifications`
    - `id` (uuid, primary key) - Unique notification identifier
    - `user_id` (uuid) - References auth.users (recipient, typically doctor)
    - `type` (text) - Notification type: 'lab_result_ready', 'lab_result_updated', etc.
    - `title` (text) - Notification title
    - `message` (text) - Notification message content
    - `related_visit_test_id` (uuid, nullable) - References visit_tests for lab result notifications
    - `is_read` (boolean) - Whether notification has been viewed
    - `created_at` (timestamptz) - When notification was created
    - `read_at` (timestamptz, nullable) - When notification was marked as read

  ## Modified Tables

  1. `visit_tests`
    - `sent_to_doctor_at` (timestamptz, nullable) - When results were sent to doctor
    - `sent_to_doctor_by` (uuid, nullable) - Lab tech who sent the results
    - `doctor_viewed_at` (timestamptz, nullable) - When doctor viewed the results

  ## Security

  - Enable RLS on notifications table
  - Add policies for users to view their own notifications
  - Add policies for lab techs to send notifications
  - Add policies for doctors to view completed test results
  - Create indexes for efficient notification queries

  ## Performance

  - Index on notifications (user_id, is_read, created_at)
  - Index on visit_tests (sent_to_doctor_at)
*/

-- Add notification tracking fields to visit_tests
ALTER TABLE visit_tests
ADD COLUMN IF NOT EXISTS sent_to_doctor_at timestamptz,
ADD COLUMN IF NOT EXISTS sent_to_doctor_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS doctor_viewed_at timestamptz;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'lab_result_ready',
  title text NOT NULL,
  message text NOT NULL,
  related_visit_test_id uuid REFERENCES visit_tests(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_visit_test
  ON notifications(related_visit_test_id);

CREATE INDEX IF NOT EXISTS idx_visit_tests_sent_to_doctor
  ON visit_tests(sent_to_doctor_at)
  WHERE sent_to_doctor_at IS NOT NULL;

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Lab techs and admins can create notifications
CREATE POLICY "Lab techs and admins can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'lab_tech')
    )
  );

-- Policy: Doctors can view completed test results for their visits
CREATE POLICY "Doctors can view completed tests for their visits"
  ON visit_tests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'doctor'
    )
    AND EXISTS (
      SELECT 1 FROM visits
      WHERE visits.id = visit_tests.visit_id
      AND visits.doctor_id = auth.uid()
    )
  );

-- Function to create notification when results are sent to doctor
CREATE OR REPLACE FUNCTION notify_doctor_of_results()
RETURNS TRIGGER AS $$
DECLARE
  doctor_id uuid;
  patient_name text;
  test_name text;
BEGIN
  -- Only proceed if sent_to_doctor_at was just set (changed from NULL to a value)
  IF OLD.sent_to_doctor_at IS NULL AND NEW.sent_to_doctor_at IS NOT NULL THEN
    -- Get the doctor_id from the visit
    SELECT visits.doctor_id INTO doctor_id
    FROM visits
    WHERE visits.id = NEW.visit_id;

    -- Get patient name
    SELECT patients.name INTO patient_name
    FROM patients
    JOIN visits ON visits.patient_id = patients.id
    WHERE visits.id = NEW.visit_id;

    -- Get test name
    SELECT tests.name INTO test_name
    FROM tests
    WHERE tests.id = NEW.test_id;

    -- Create notification for the doctor
    IF doctor_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_visit_test_id
      ) VALUES (
        doctor_id,
        'lab_result_ready',
        'New Lab Results Available',
        'Test results for ' || test_name || ' are ready for patient ' || patient_name,
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic notification
DROP TRIGGER IF EXISTS trigger_notify_doctor_of_results ON visit_tests;
CREATE TRIGGER trigger_notify_doctor_of_results
  AFTER UPDATE ON visit_tests
  FOR EACH ROW
  EXECUTE FUNCTION notify_doctor_of_results();

-- Grant necessary permissions
GRANT SELECT ON notifications TO authenticated;
GRANT UPDATE ON notifications TO authenticated;
GRANT INSERT ON notifications TO authenticated;
