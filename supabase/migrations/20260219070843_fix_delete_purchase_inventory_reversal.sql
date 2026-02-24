/*
  # Fix delete_purchase function to properly reverse inventory

  1. Changes
    - Fix inventory reversal logic: ADD quantity back when deleting (since purchase subtracted it)
    - The purchase added inventory, so deletion should remove that addition

  2. Notes
    - When a purchase is completed, inventory is increased
    - When deleting a completed purchase, we need to decrease inventory (reverse the addition)
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
        SET qty_on_hand = GREATEST(0, qty_on_hand - v_purchase_item.quantity)
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