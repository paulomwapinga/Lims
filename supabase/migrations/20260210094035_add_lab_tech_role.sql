/*
  # Add Lab Technician Role

  ## Overview
  Adds the 'lab_tech' role to the user_role enum for lab technicians who will enter test results.

  ## Changes
  - Add 'lab_tech' value to user_role enum type

  ## Important Notes
  - This must be in a separate migration because enum values need to be committed before use
  - Lab technicians will have permissions to enter and update test results
*/

-- Add lab_tech role to user_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'lab_tech' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'lab_tech';
  END IF;
END $$;