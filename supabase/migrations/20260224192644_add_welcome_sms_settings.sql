/*
  # Add Welcome SMS Configuration to Settings

  1. Changes
    - Add `welcome_sms_enabled` boolean column (default: false)
    - Add `welcome_sms_template` text column for welcome message template
  
  2. Security
    - No RLS changes needed (settings table already secured to admin-only)
  
  3. Notes
    - Welcome SMS will be sent automatically when a new patient is created
    - Template supports placeholders: [PATIENT_NAME], [CLINIC_NAME]
    - Uses existing SMS API credentials (sms_api_key, sms_secret_key, sms_source_addr)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'welcome_sms_enabled'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN welcome_sms_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'facility_settings' AND column_name = 'welcome_sms_template'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN welcome_sms_template text DEFAULT 'Karibu [PATIENT_NAME]! Tunakushukuru kwa kuchagua [CLINIC_NAME]. Tunaomba afya njema.';
  END IF;
END $$;
