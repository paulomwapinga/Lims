/*
  # Remove Discount Column from Visits Table

  This migration removes the discount functionality from the visits table.

  ## Changes Made
  
  1. Removes the `discount` column from the `visits` table
     - The discount column is no longer needed as the application will no longer support discounts
     - Total will be calculated directly from subtotal without any deductions
  
  ## Notes
  
  - This is a non-destructive migration that safely removes the discount column
  - Existing visit records will remain intact, only the discount column will be dropped
  - The `total` field will continue to exist and should equal `subtotal` for new visits
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visits' AND column_name = 'discount'
  ) THEN
    ALTER TABLE visits DROP COLUMN discount;
  END IF;
END $$;
