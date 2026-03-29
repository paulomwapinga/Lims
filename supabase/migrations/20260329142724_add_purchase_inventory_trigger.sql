/*
  # Add Automatic Inventory Addition Trigger for Purchases

  ## Overview
  This migration creates a database trigger to automatically add inventory quantities when:
  1. A new purchase is created with status 'completed'
  2. An existing draft purchase is updated to 'completed' status

  ## Changes Made

  ### 1. Function Created
  - `add_purchase_to_inventory()` - Adds purchase item quantities to inventory and logs stock movements

  ### 2. Triggers Created
  - `trigger_add_purchase_inventory_insert` - Fires after INSERT on purchases when status is 'completed'
  - `trigger_add_purchase_inventory_update` - Fires after UPDATE on purchases when status changes to 'completed'

  ### 3. Stock Movement Logging
  - All inventory additions are logged in stock_movements table
  - Movement type: 'IN'
  - Reason: 'Purchase from [supplier]'
  - Reference type: 'purchases'
  - Reference ID: The purchase ID

  ## Important Notes
  - Stock movements are automatically created for audit trail
  - This ensures inventory is updated consistently
  - Prevents double-updating inventory (checks if already processed)
*/

-- Function to add purchase items to inventory
CREATE OR REPLACE FUNCTION add_purchase_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  purchase_item RECORD;
BEGIN
  -- Only process if status is 'completed'
  IF NEW.status = 'completed' THEN
    -- Loop through all items in this purchase
    FOR purchase_item IN
      SELECT item_id, quantity, unit
      FROM purchase_items
      WHERE purchase_id = NEW.id
    LOOP
      -- Add to inventory
      UPDATE inventory_items
      SET 
        qty_on_hand = qty_on_hand + purchase_item.quantity,
        updated_at = now()
      WHERE id = purchase_item.item_id;

      -- Log stock movement
      INSERT INTO stock_movements (
        item_id,
        movement_type,
        qty,
        reason,
        reference_type,
        reference_id,
        performed_by,
        created_at
      ) VALUES (
        purchase_item.item_id,
        'IN',
        purchase_item.quantity,
        'Purchase from ' || NEW.supplier,
        'purchases',
        NEW.id,
        NEW.created_by,
        now()
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new purchases
DROP TRIGGER IF EXISTS trigger_add_purchase_inventory_insert ON purchases;
CREATE TRIGGER trigger_add_purchase_inventory_insert
  AFTER INSERT ON purchases
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION add_purchase_to_inventory();

-- Create trigger for updating draft purchases to completed
DROP TRIGGER IF EXISTS trigger_add_purchase_inventory_update ON purchases;
CREATE TRIGGER trigger_add_purchase_inventory_update
  AFTER UPDATE ON purchases
  FOR EACH ROW
  WHEN (OLD.status = 'draft' AND NEW.status = 'completed')
  EXECUTE FUNCTION add_purchase_to_inventory();
