/*
  # Allow Lab Techs to View Doctor Information

  1. Changes
    - Add RLS policy to allow lab technicians to view doctor and admin users
    - This is needed so they can see who ordered the tests they're working on
    
  2. Security
    - Lab techs can only view users with role 'doctor' or 'admin'
    - They still cannot view other lab techs
    - They still cannot modify user data
*/

CREATE POLICY "Lab techs can view doctors and admins"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'lab_tech'
    )
    AND role IN ('doctor', 'admin')
  );
