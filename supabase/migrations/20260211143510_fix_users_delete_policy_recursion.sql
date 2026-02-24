/*
  # Fix Infinite Recursion in Users DELETE Policy

  1. Changes
    - Drop the recursive "Admins can delete users" policy
    - Create new non-recursive DELETE policy using the is_admin() helper function
  
  2. Security
    - Only admins can delete users
    - Uses security definer function to avoid recursion
    - Maintains restrictive access control
*/

-- Drop the existing recursive delete policy
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Create new non-recursive delete policy using the helper function
CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin());
