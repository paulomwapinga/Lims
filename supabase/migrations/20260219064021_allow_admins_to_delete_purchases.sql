/*
  # Allow Admins to Delete Any Purchase

  1. Changes
    - Updates the DELETE policy on purchases table to allow:
      - Users to delete their own purchases (created_by = auth.uid())
      - Admins to delete any purchase
  
  2. Security
    - Maintains ownership check for non-admin users
    - Grants full delete access to admin role
*/

DROP POLICY IF EXISTS "Authenticated users can delete their own purchases" ON purchases;

CREATE POLICY "Users can delete own purchases, admins can delete any"
  ON purchases
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = created_by
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
