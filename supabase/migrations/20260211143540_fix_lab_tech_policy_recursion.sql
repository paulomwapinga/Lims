/*
  # Fix Infinite Recursion in Lab Tech Policy

  1. Changes
    - Drop the recursive "Lab techs can view doctors and admins" policy
    - Create a security definer function to check if user is lab tech
    - Create new non-recursive policy using the helper function
  
  2. Security
    - Lab techs can view doctor and admin profiles
    - Uses security definer function to avoid recursion
    - Maintains restrictive access control
*/

-- Drop the existing recursive policy
DROP POLICY IF EXISTS "Lab techs can view doctors and admins" ON users;

-- Create a security definer function to check if current user is lab tech
CREATE OR REPLACE FUNCTION public.is_lab_tech()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'lab_tech'
  );
END;
$$;

-- Create new non-recursive policy
CREATE POLICY "Lab techs can view doctors and admins"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    is_lab_tech() 
    AND role IN ('doctor', 'admin')
  );
