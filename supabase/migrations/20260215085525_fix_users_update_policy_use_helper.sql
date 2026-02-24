/*
  # Fix Users Update Policy to Use Helper Function

  1. Changes
    - Drop existing "Admins can update users" policy that uses subquery
    - Recreate using is_admin() helper function to avoid recursion issues
  
  2. Security
    - Maintains same security level: only admins can update users
    - Uses helper function for consistency with other policies
    - Prevents potential recursion or performance issues
*/

DROP POLICY IF EXISTS "Admins can update users" ON users;

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
