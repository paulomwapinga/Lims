/*
  # Fix Test Parameters RLS Policies for Better Performance

  ## Overview
  This migration updates the test_parameters table RLS policies to use `(select auth.uid())`
  instead of `auth.uid()` to prevent re-evaluation for each row, improving query
  performance at scale.

  ## Changes Made
  - Update "Admin users can insert test parameters" policy
  - Update "Admin users can update test parameters" policy
  - Update "Admin users can delete test parameters" policy

  ## Security Notes
  - No changes to access control logic
  - Only performance optimization
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can insert test parameters" ON test_parameters;
DROP POLICY IF EXISTS "Admin users can update test parameters" ON test_parameters;
DROP POLICY IF EXISTS "Admin users can delete test parameters" ON test_parameters;

-- Recreate policies with optimized auth.uid() calls
CREATE POLICY "Admin users can insert test parameters"
  ON test_parameters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update test parameters"
  ON test_parameters FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can delete test parameters"
  ON test_parameters FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );
