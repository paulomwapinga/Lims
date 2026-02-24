/*
  # Add Automatic Inventory Deduction Triggers

  ## Overview
  This migration creates database triggers to automatically deduct inventory quantities when:
  1. Medicines are dispensed during visits (visit_medicines)
  2. Tests are ordered during visits (visit_tests with consumables)

  ## Changes Made

  ### 1. Functions Created
  - `deduct_medicine_inventory()` - Deducts medicine quantities and logs stock movements
  - `deduct_test_consumables()` - Deducts test consumable quantities and logs stock movements

  ### 2. Triggers Created
  - `trigger_deduct_medicine` - Fires after INSERT on visit_medicines
  - `trigger_deduct_test_consumables` - Fires after INSERT on visit_tests

  ### 3. Stock Movement Logging
  - All inventory deductions are logged in stock_movements table
  - Movement type: 'OUT'
  - Reason: 'Dispensed in visit' or 'Used for test'
  - Reference type: 'visit_medicines' or 'visit_tests'
  - Reference ID: The record ID from visit_medicines or visit_tests

  ## Important Notes
  - If inventory quantity is insufficient, the operation will fail with a clear error message
  - Stock movements are automatically created for audit trail
  - This ensures inventory accuracy and prevents overselling
*/

-- Function to deduct medicine inventory when dispensed
CREATE OR REPLACE FUNCTION deduct_medicine_inventory()
RETURNS TRIGGER AS $$
DECLARE
  current_qty decimal(10,2);
  doctor_id uuid;
BEGIN
  -- Get current quantity
  SELECT qty_on_hand INTO current_qty
  FROM inventory_items
  WHERE id = NEW.item_id;

  -- Check if sufficient quantity exists
  IF current_qty < NEW.qty THEN
    RAISE EXCEPTION 'Insufficient inventory for item_id %. Available: %, Required: %', 
      NEW.item_id, current_qty, NEW.qty;
  END IF;

  -- Deduct from inventory
  UPDATE inventory_items
  SET 
    qty_on_hand = qty_on_hand - NEW.qty,
    updated_at = now()
  WHERE id = NEW.item_id;

  -- Get doctor_id from visit
  SELECT doctor_id INTO doctor_id
  FROM visits
  WHERE id = NEW.visit_id;

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
    'OUT',
    NEW.qty,
    'Dispensed in visit',
    'visit_medicines',
    NEW.id,
    doctor_id,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct test consumables when test is ordered
CREATE OR REPLACE FUNCTION deduct_test_consumables()
RETURNS TRIGGER AS $$
DECLARE
  consumable RECORD;
  current_qty decimal(10,2);
  required_qty decimal(10,2);
  doctor_id uuid;
BEGIN
  -- Get doctor_id from visit
  SELECT doctor_id INTO doctor_id
  FROM visits
  WHERE id = NEW.visit_id;

  -- Loop through all consumables for this test
  FOR consumable IN
    SELECT item_id, quantity
    FROM test_consumables
    WHERE test_id = NEW.test_id
  LOOP
    -- Calculate required quantity (consumable quantity * test qty)
    required_qty := consumable.quantity * NEW.qty;

    -- Get current quantity
    SELECT qty_on_hand INTO current_qty
    FROM inventory_items
    WHERE id = consumable.item_id;

    -- Check if sufficient quantity exists
    IF current_qty < required_qty THEN
      RAISE EXCEPTION 'Insufficient inventory for consumable item_id %. Available: %, Required: %', 
        consumable.item_id, current_qty, required_qty;
    END IF;

    -- Deduct from inventory
    UPDATE inventory_items
    SET 
      qty_on_hand = qty_on_hand - required_qty,
      updated_at = now()
    WHERE id = consumable.item_id;

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
      consumable.item_id,
      'OUT',
      required_qty,
      'Used for test: ' || (SELECT name FROM tests WHERE id = NEW.test_id),
      'visit_tests',
      NEW.id,
      doctor_id,
      now()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for medicine dispensing
DROP TRIGGER IF EXISTS trigger_deduct_medicine ON visit_medicines;
CREATE TRIGGER trigger_deduct_medicine
  AFTER INSERT ON visit_medicines
  FOR EACH ROW
  EXECUTE FUNCTION deduct_medicine_inventory();

-- Create trigger for test consumables
DROP TRIGGER IF EXISTS trigger_deduct_test_consumables ON visit_tests;
CREATE TRIGGER trigger_deduct_test_consumables
  AFTER INSERT ON visit_tests
  FOR EACH ROW
  EXECUTE FUNCTION deduct_test_consumables();
