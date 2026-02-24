/*
  # Fix Ambiguous doctor_id Column Reference in Triggers

  ## Issue
  The trigger functions `deduct_medicine_inventory()` and `deduct_test_consumables()` 
  had ambiguous column references where the variable name `doctor_id` conflicted with 
  the column name `doctor_id` from the visits table.

  ## Changes
  - Renamed the variable from `doctor_id` to `v_doctor_id` in both functions
  - This eliminates the ambiguity and prevents errors when inserting visits
*/

-- Function to deduct medicine inventory when dispensed (FIXED)
CREATE OR REPLACE FUNCTION deduct_medicine_inventory()
RETURNS TRIGGER AS $$
DECLARE
  current_qty decimal(10,2);
  v_doctor_id uuid;
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
  SELECT visits.doctor_id INTO v_doctor_id
  FROM visits
  WHERE visits.id = NEW.visit_id;

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
    v_doctor_id,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct test consumables when test is ordered (FIXED)
CREATE OR REPLACE FUNCTION deduct_test_consumables()
RETURNS TRIGGER AS $$
DECLARE
  consumable RECORD;
  current_qty decimal(10,2);
  required_qty decimal(10,2);
  v_doctor_id uuid;
BEGIN
  -- Get doctor_id from visit
  SELECT visits.doctor_id INTO v_doctor_id
  FROM visits
  WHERE visits.id = NEW.visit_id;

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
      v_doctor_id,
      now()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
