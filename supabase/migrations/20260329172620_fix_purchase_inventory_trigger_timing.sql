/*
  # Fix Purchase Inventory Trigger Timing
  
  ## Problem
  The current trigger fires after INSERT on purchases, but purchase_items are inserted 
  after the purchase. This means when the trigger runs, there are no items to process.
  
  ## Solution
  Change the trigger to fire after INSERT on purchase_items instead of purchases.
  This ensures the items exist when we try to add them to inventory.
  
  ## Changes Made
  
  ### 1. Drop Old Triggers
  - Remove triggers on purchases table
  
  ### 2. Create New Trigger on purchase_items
  - `trigger_add_purchase_item_to_inventory` - Fires after INSERT on purchase_items
  - Only processes if the parent purchase has status 'completed'
  
  ### 3. Updated Function
  - Modified to work with individual purchase items instead of looping
  - Checks parent purchase status before processing
*/

-- Drop the old triggers on purchases table
DROP TRIGGER IF EXISTS trigger_add_purchase_inventory_insert ON purchases;
DROP TRIGGER IF EXISTS trigger_add_purchase_inventory_update ON purchases;

-- Create new function that processes individual purchase items
CREATE OR REPLACE FUNCTION add_purchase_item_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  purchase_status TEXT;
  purchase_supplier TEXT;
  purchase_created_by UUID;
BEGIN
  -- Get the parent purchase details
  SELECT status, supplier, created_by
  INTO purchase_status, purchase_supplier, purchase_created_by
  FROM purchases
  WHERE id = NEW.purchase_id;
  
  -- Only process if parent purchase is completed
  IF purchase_status = 'completed' THEN
    -- Add to inventory
    UPDATE inventory_items
    SET 
      qty_on_hand = qty_on_hand + NEW.quantity,
      updated_at = now()
    WHERE id = NEW.item_id;

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
      NEW.item_id,
      'IN',
      NEW.quantity,
      'Purchase from ' || purchase_supplier,
      'purchases',
      NEW.purchase_id,
      purchase_created_by,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on purchase_items
CREATE TRIGGER trigger_add_purchase_item_to_inventory
  AFTER INSERT ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION add_purchase_item_to_inventory();

-- Also keep a trigger for when draft purchases are updated to completed
-- This will process all existing items
CREATE OR REPLACE FUNCTION add_draft_purchase_to_inventory()
RETURNS TRIGGER AS $$
DECLARE
  purchase_item RECORD;
BEGIN
  -- Only process if status changed from draft to completed
  IF OLD.status = 'draft' AND NEW.status = 'completed' THEN
    -- Loop through all items in this purchase
    FOR purchase_item IN
      SELECT item_id, quantity
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

CREATE TRIGGER trigger_update_draft_purchase_to_completed
  AFTER UPDATE ON purchases
  FOR EACH ROW
  WHEN (OLD.status = 'draft' AND NEW.status = 'completed')
  EXECUTE FUNCTION add_draft_purchase_to_inventory();
