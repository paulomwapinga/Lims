/*
  # Add Age Unit Field to Patients Table
  
  This migration adds support for entering patient ages in months or years,
  which is essential for infants and children under 1 year old.
  
  1. Changes
    - Add `age_unit` column to patients table with values 'years' or 'months'
    - Default to 'years' for backward compatibility with existing records
    - For new records, if age < 12 and not specified, unit will be 'months'
  
  2. Notes
    - The age field stores the numeric value (e.g., 5 for 5 months or 2 for 2 years)
    - The age_unit field specifies whether age is in 'years' or 'months'
    - Allows entering precise ages for infants (e.g., 5 months, 11 months)
*/

-- Add age_unit column to patients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'age_unit'
  ) THEN
    ALTER TABLE patients ADD COLUMN age_unit text DEFAULT 'years' CHECK (age_unit IN ('years', 'months'));
  END IF;
END $$;

-- Update existing records to use 'years' as the unit
UPDATE patients SET age_unit = 'years' WHERE age_unit IS NULL;