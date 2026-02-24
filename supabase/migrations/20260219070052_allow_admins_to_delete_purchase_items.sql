/*
  # Allow Admins to Delete Purchase Items

  1. Changes
    - Updates the DELETE policy on purchase_items table to allow:
      - Users to delete items from their own purchases (created_by = auth.uid())
      - Admins to delete any purchase items
  
  2. Security
    - Maintains ownership check for non-admin users
    - Grants full delete access to admin role
    - Required for cascading deletes when admins delete purchases
*/

DROP POLICY IF EXISTS "Authenticated users can delete their purchase items" ON purchase_items;

CREATE POLICY "Users can delete own purchase items, admins can delete any"
  ON purchase_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = purchase_items.purchase_id
      AND purchases.created_by = (SELECT auth.uid())
    )
    OR
    (SELECT role FROM users WHERE id = (SELECT auth.uid())) = 'admin'
  );
