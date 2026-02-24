/*
  # Add SMS Configuration to Settings
  
  1. Changes
    - Add `sms_enabled` boolean column (default: false)
    - Add `sms_api_key` text column for Beem Africa API key
    - Add `sms_secret_key` text column for Beem Africa secret key
    - Add `sms_source_addr` text column for sender ID
    - Add `sms_template` text column for SMS message template
  
  2. Security
    - No RLS changes needed (settings table already secured to admin-only)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'sms_enabled'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN sms_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'sms_api_key'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN sms_api_key text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'sms_secret_key'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN sms_secret_key text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'sms_source_addr'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN sms_source_addr text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'sms_template'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN sms_template text DEFAULT 'Habari [PATIENT_NAME], majibu ya kipimo yako tayari. Tafadhali fika maabara.';
  END IF;
END $$;