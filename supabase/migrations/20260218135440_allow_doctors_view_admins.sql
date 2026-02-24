/*
  # Allow Doctors to View Admin Names
  
  1. Changes
    - Add policy for doctors to view admin users
    - This allows doctors to see who created/managed visits when an admin performs tasks
  
  2. Security
    - Maintains RLS protection
    - Only allows SELECT (read-only) access
    - Limited to authenticated users with doctor role
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Doctors can view admins'
  ) THEN
    CREATE POLICY "Doctors can view admins"
      ON users FOR SELECT
      TO authenticated
      USING (is_doctor() AND role = 'admin');
  END IF;
END $$;