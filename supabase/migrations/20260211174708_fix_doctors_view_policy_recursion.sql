/*
  # Fix Recursive RLS Policy for Doctors Viewing Doctors

  1. Changes
    - Drop the problematic policy
    - Create a helper function to check if user is a doctor
    - Recreate the policy using the helper function to avoid recursion
  
  2. Security
    - Maintains same security level
    - Prevents infinite recursion by using security definer function
*/

DROP POLICY IF EXISTS "Doctors can view other doctors" ON users;

CREATE OR REPLACE FUNCTION is_doctor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'doctor'
  );
END;
$$;

CREATE POLICY "Doctors can view other doctors"
  ON users
  FOR SELECT
  TO authenticated
  USING (is_doctor() AND role = 'doctor');
