/*
  # Restrict Lab Results Editing to Lab Tech and Admin Only

  ## Changes Made
  
  This migration restricts the ability to insert and update lab test results
  to only lab technicians and administrators. Doctors can view results but
  cannot enter or edit them.

  ### Modified Policies
  
  1. **visit_test_results table**
     - DROP existing "Staff can insert results" policy (allowed admin, doctor, lab_tech)
     - DROP existing "Staff can update results" policy (allowed admin, doctor, lab_tech)
     - CREATE new "Lab tech and admin can insert results" policy (admin, lab_tech only)
     - CREATE new "Lab tech and admin can update results" policy (admin, lab_tech only)

  ## Security Impact
  
  - Doctors retain SELECT access to view all test results
  - Only lab_tech and admin roles can INSERT new results
  - Only lab_tech and admin roles can UPDATE existing results
  - Admin retains DELETE access (unchanged)
*/

-- Drop existing policies that allow doctors to edit results
DROP POLICY IF EXISTS "Staff can insert results" ON visit_test_results;
DROP POLICY IF EXISTS "Staff can update results" ON visit_test_results;

-- Create new policy: Only lab_tech and admin can insert results
CREATE POLICY "Lab tech and admin can insert results"
  ON visit_test_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'lab_tech')
    )
  );

-- Create new policy: Only lab_tech and admin can update results
CREATE POLICY "Lab tech and admin can update results"
  ON visit_test_results
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'lab_tech')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'lab_tech')
    )
  );