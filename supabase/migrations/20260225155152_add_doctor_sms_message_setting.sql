/*
  # Add Doctor SMS Message Setting

  This migration adds a new SMS message template for doctors.

  1. Changes
    - Add `sms_doctor_message` setting for notifying doctors when lab results are ready
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM settings WHERE key = 'sms_doctor_message'
  ) THEN
    INSERT INTO settings (key, value)
    VALUES ('sms_doctor_message', 'Habari Dkt. {doctor_name}, Matokeo ya vipimo vya {patient_name} yako tayari kwa ajili ya ukaguzi. Tafadhali ingia kwenye mfumo.');
  END IF;
END $$;
