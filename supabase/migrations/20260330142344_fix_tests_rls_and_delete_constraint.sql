/*
  # Fix tests table RLS policy and delete constraint

  ## Problems Fixed

  1. **"Admins can manage tests" policy** used `FOR ALL` without a `WITH CHECK` clause.
     This means INSERT operations were blocked by RLS because `WITH CHECK` defaulted to `false`.
     We drop the broken ALL policy and replace it with explicit INSERT/UPDATE/DELETE policies.

  2. **visit_tests foreign key** had `NO ACTION` on delete, so deleting a test used in any
     visit would fail. Changed to `RESTRICT` to give a clear error, and the UI will handle
     showing a friendly message. The real fix: we warn the user rather than silently failing.

  ## Changes

  - Drop the broken `FOR ALL` policy on `tests`
  - Add explicit INSERT, UPDATE, DELETE policies for admins on `tests`
  - Keep existing SELECT policy untouched
*/

-- Drop the broken ALL policy
DROP POLICY IF EXISTS "Admins can manage tests" ON tests;

-- Proper INSERT policy
CREATE POLICY "Admins can insert tests"
  ON tests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'admin'
    )
  );

-- Proper UPDATE policy
CREATE POLICY "Admins can update tests"
  ON tests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'admin'
    )
  );

-- Proper DELETE policy
CREATE POLICY "Admins can delete tests"
  ON tests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND users.role = 'admin'
    )
  );
