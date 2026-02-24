/*
  # Restrict Edit and Delete Operations to Admin Role

  ## Overview
  This migration updates RLS policies to ensure that only users with the 'admin' role
  can perform UPDATE and DELETE operations across all tables. Doctors can only view
  and create records, but cannot edit or delete them.

  ## Changes Made

  ### 1. Patients Table
  - Updated UPDATE and DELETE policies to require admin role

  ### 2. Visits Table
  - Updated UPDATE and DELETE policies to require admin role
  - Doctors can still create visits but cannot modify or delete them

  ### 3. Visit Tests and Visit Medicines Tables
  - Updated UPDATE and DELETE policies to require admin role

  ### 4. Inventory Items Table
  - Already restricted to admin (no changes needed)

  ### 5. Tests Table
  - Already restricted to admin (no changes needed)

  ### 6. Stock Movements Table
  - DELETE policy added to restrict to admin only

  ## Security Notes
  - Authenticated users can still view all data
  - Doctors retain ability to create new records
  - Only admins can modify or delete existing records
  - Users can still update their own profile
*/

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Doctors and admins can update patients" ON patients;
DROP POLICY IF EXISTS "Doctors can update visits" ON visits;
DROP POLICY IF EXISTS "Doctors can manage visit tests" ON visit_tests;
DROP POLICY IF EXISTS "Doctors can manage visit medicines" ON visit_medicines;

-- Patients: Only admins can update and delete
CREATE POLICY "Admins can update patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete patients"
  ON patients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Visits: Only admins can update and delete
CREATE POLICY "Admins can update visits"
  ON visits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete visits"
  ON visits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Visit Tests: Split policies for better control
CREATE POLICY "Doctors can insert visit tests"
  ON visit_tests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update visit tests"
  ON visit_tests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete visit tests"
  ON visit_tests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Visit Medicines: Split policies for better control
CREATE POLICY "Doctors can insert visit medicines"
  ON visit_medicines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update visit medicines"
  ON visit_medicines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete visit medicines"
  ON visit_medicines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Stock Movements: Add delete policy for admins
CREATE POLICY "Admins can delete stock movements"
  ON stock_movements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Users: Add delete policy for admins
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );