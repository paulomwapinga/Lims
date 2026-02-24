/*
  # Fix Users Update Policy

  1. Changes
    - Drop existing "Admins can update users" policy
    - Recreate with proper WITH CHECK clause
  
  2. Security
    - Ensures admins can update user records with proper validation
    - Both USING and WITH CHECK clauses are required for UPDATE policies
*/

DROP POLICY IF EXISTS "Admins can update users" ON users;

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );