/*
  # Add Lab Tech SMS Message Setting

  This migration adds a new SMS message template for lab technicians.

  1. Changes
    - Add `sms_lab_tech_message` setting for notifying lab techs when results are ready to review
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM settings WHERE key = 'sms_lab_tech_message'
  ) THEN
    INSERT INTO settings (key, value)
    VALUES ('sms_lab_tech_message', 'Habari {lab_tech_name}, Matokeo ya {patient_name} yako tayari kwa ajili ya ukaguzi na kuandika ripoti. Tafadhali ingia kwenye mfumo.');
  END IF;
END $$;
