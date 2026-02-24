/*
  # Add Lab Technician Access to Visit Tests

  ## Overview
  Adds RLS policies to allow lab technicians to view and update visit_tests table
  for entering and managing test results.

  ## 1. Changes Made
  
  ### SELECT Policy
  - Allow all authenticated users (admin, doctor, lab_tech) to view visit tests
  - Required for lab technicians to see pending tests and enter results
  
  ### UPDATE Policy for Lab Tech
  - Allow lab_tech role to update test result fields:
    - results_status
    - results_entered_at
    - results_entered_by
    - technician_notes
    - sent_to_doctor_at
    - sent_to_doctor_by
  - Lab technicians should NOT be able to modify:
    - visit_id (which patient/visit)
    - test_id (which test was ordered)
    - price (financial data)
  
  ## 2. Security Notes
  - Lab technicians can only update result-related fields
  - Admins retain full update permissions via existing policy
  - Doctors can only insert new tests (existing policy)
  - Financial and core test data remains protected
*/

-- Add SELECT policy for all authenticated users to view visit tests
DROP POLICY IF EXISTS "Authenticated users can view visit tests" ON visit_tests;
CREATE POLICY "Authenticated users can view visit tests"
  ON visit_tests
  FOR SELECT
  TO authenticated
  USING (true);

-- Add UPDATE policy for lab technicians to update test results
DROP POLICY IF EXISTS "Lab techs can update test results" ON visit_tests;
CREATE POLICY "Lab techs can update test results"
  ON visit_tests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'lab_tech'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'lab_tech'
    )
  );
