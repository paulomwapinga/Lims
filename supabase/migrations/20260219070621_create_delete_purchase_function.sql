/*
  # Create function to delete purchases safely

  1. New Function
    - `delete_purchase(purchase_id uuid)` - Safely deletes a purchase and its items
    - Handles inventory reversal for completed purchases
    - Bypasses RLS by using SECURITY DEFINER
    - Only allows admins or purchase creators to delete

  2. Security
    - Function runs with elevated privileges (SECURITY DEFINER)
    - Has its own authorization check to ensure only admins or creators can delete
*/

CREATE OR REPLACE FUNCTION delete_purchase(p_purchase_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase purchases%ROWTYPE;
  v_user_role user_role;
  v_purchase_item RECORD;
  v_item inventory_items%ROWTYPE;
BEGIN
  SELECT role INTO v_user_role FROM users WHERE id = auth.uid();
  
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id;
  
  IF v_purchase.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Purchase not found');
  END IF;
  
  IF v_user_role != 'admin' AND v_purchase.created_by != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to delete this purchase');
  END IF;
  
  IF v_purchase.status = 'completed' THEN
    FOR v_purchase_item IN 
      SELECT item_id, quantity 
      FROM purchase_items 
      WHERE purchase_id = p_purchase_id
    LOOP
      SELECT * INTO v_item FROM inventory_items WHERE id = v_purchase_item.item_id;
      
      IF v_item.id IS NOT NULL THEN
        UPDATE inventory_items 
        SET qty_on_hand = qty_on_hand - v_purchase_item.quantity
        WHERE id = v_purchase_item.item_id;
      END IF;
    END LOOP;
  END IF;
  
  DELETE FROM purchase_items WHERE purchase_id = p_purchase_id;
  DELETE FROM purchases WHERE id = p_purchase_id;
  
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;