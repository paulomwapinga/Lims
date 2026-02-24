/*
  # Add Marital Status to Patients Table

  1. Changes
    - Add `marital_status` column to `patients` table
      - Type: text
      - Allowed values: 'Single', 'Married', 'Divorced', 'Widowed', 'Separated'
      - Default: NULL (optional field)
      - Includes check constraint to ensure valid values

  2. Notes
    - Marital status is important for patient counseling and medical advice
    - Field is optional to accommodate existing patient records
    - Uses check constraint to maintain data integrity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'marital_status'
  ) THEN
    ALTER TABLE patients 
    ADD COLUMN marital_status text;
    
    ALTER TABLE patients
    ADD CONSTRAINT check_marital_status 
    CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed', 'Separated'));
  END IF;
END $$;