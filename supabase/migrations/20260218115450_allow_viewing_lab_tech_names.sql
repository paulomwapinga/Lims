/*
  # Allow Doctors and Admins to View Lab Tech Information

  1. Changes
    - Add policy allowing doctors to view lab techs (who enter test results)
    - Add policy allowing lab techs to view other lab techs
  
  2. Security
    - Doctors need to see who entered lab results for accountability
    - Lab techs need to see other lab techs for collaboration
    - Still maintains proper access control
*/

CREATE POLICY "Doctors can view lab techs"
  ON users FOR SELECT
  TO authenticated
  USING (is_doctor() AND role = 'lab_tech');

CREATE POLICY "Lab techs can view other lab techs"
  ON users FOR SELECT
  TO authenticated
  USING (is_lab_tech() AND role = 'lab_tech');
