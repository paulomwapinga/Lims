/*
  # Add SMS Sent Timestamp to Visit Tests

  1. Changes
    - Add `sms_sent_at` column to `visit_tests` table to track when SMS notifications were sent to patients
    - This is separate from `sent_to_doctor_at` which tracks doctor notifications
    - Allows manual SMS sending from the Lab Results page

  2. Notes
    - Column is nullable since not all results will have SMS sent
    - No default value - set explicitly when SMS is sent
    - Uses timestamptz for timezone-aware timestamps
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visit_tests' AND column_name = 'sms_sent_at'
  ) THEN
    ALTER TABLE visit_tests ADD COLUMN sms_sent_at timestamptz;
  END IF;
END $$;
