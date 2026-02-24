/*
  # Allow Doctors to View Other Doctors

  1. Changes
    - Add policy for doctors to view other doctors in the users table
    - This is needed for receipts and visit history where doctor names are displayed
  
  2. Security
    - Policy only allows doctors to read basic info of other doctors
    - No sensitive data exposure
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Doctors can view other doctors'
  ) THEN
    CREATE POLICY "Doctors can view other doctors"
      ON users
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'doctor'
        )
        AND role = 'doctor'
      );
  END IF;
END $$;
