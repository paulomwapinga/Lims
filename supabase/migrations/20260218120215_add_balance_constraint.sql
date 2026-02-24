/*
  # Add Balance Constraint to Visits Table

  1. Changes
    - Add check constraint to ensure balance is never negative
    - Add check constraint to ensure paid amount doesn't exceed total

  2. Purpose
    - Prevent data integrity issues where overpayment creates negative balances
    - Ensure financial calculations remain accurate
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'visits_balance_non_negative'
  ) THEN
    ALTER TABLE visits 
    ADD CONSTRAINT visits_balance_non_negative 
    CHECK (balance >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'visits_paid_not_exceed_total'
  ) THEN
    ALTER TABLE visits 
    ADD CONSTRAINT visits_paid_not_exceed_total 
    CHECK (paid <= total);
  END IF;
END $$;
