/*
  # Seed Demo Data for Remtullah Medical Laboratory

  ## Overview
  This migration inserts sample data for testing and demo purposes.

  ## Data Inserted

  ### 1. Inventory Items
  - 2 Medicine items: Paracetamol tablets, Amoxicillin capsules
  - 2 Lab Consumable items: Blood collection tubes, Test strips

  ### 2. Lab Test with BOM
  - Complete Blood Count (CBC) test with consumable recipe

  ### 3. Sample Patient
  - Demo patient for testing visits

  ## Notes
  - User accounts (admin and doctor) must be created through Supabase Auth
  - After creating users, their profiles will be automatically created via RLS
*/

-- Insert sample inventory items
INSERT INTO inventory_items (name, type, unit, qty_on_hand, reorder_level, cost_price, sell_price)
VALUES 
  ('Paracetamol 500mg', 'medicine', 'tablets', 500, 100, 0.50, 2.00),
  ('Amoxicillin 250mg', 'medicine', 'capsules', 300, 50, 1.50, 5.00),
  ('Blood Collection Tubes', 'lab_consumable', 'pcs', 200, 50, 2.00, 0),
  ('Test Strips', 'lab_consumable', 'strips', 150, 30, 1.50, 0),
  ('Glucose Test Reagent', 'lab_consumable', 'ml', 100, 20, 5.00, 0),
  ('Cotton Swabs', 'lab_consumable', 'pcs', 500, 100, 0.10, 0)
ON CONFLICT (name) DO NOTHING;

-- Insert sample lab test
INSERT INTO tests (name, price, notes)
VALUES 
  ('Complete Blood Count (CBC)', 250.00, 'Requires fasting. Sample: Blood'),
  ('Blood Glucose Test', 100.00, 'Fasting required. Sample: Blood'),
  ('Urine Analysis', 150.00, 'First morning sample preferred')
ON CONFLICT (name) DO NOTHING;

-- Insert test consumptions (BOM) for CBC test
DO $$
DECLARE
  cbc_test_id uuid;
  blood_tube_id uuid;
  test_strip_id uuid;
BEGIN
  -- Get test ID
  SELECT id INTO cbc_test_id FROM tests WHERE name = 'Complete Blood Count (CBC)' LIMIT 1;
  
  -- Get consumable IDs
  SELECT id INTO blood_tube_id FROM inventory_items WHERE name = 'Blood Collection Tubes' LIMIT 1;
  SELECT id INTO test_strip_id FROM inventory_items WHERE name = 'Test Strips' LIMIT 1;
  
  -- Insert BOM if test and items exist
  IF cbc_test_id IS NOT NULL AND blood_tube_id IS NOT NULL THEN
    INSERT INTO test_consumptions (test_id, item_id, qty_used)
    VALUES (cbc_test_id, blood_tube_id, 2)
    ON CONFLICT (test_id, item_id) DO NOTHING;
  END IF;
  
  IF cbc_test_id IS NOT NULL AND test_strip_id IS NOT NULL THEN
    INSERT INTO test_consumptions (test_id, item_id, qty_used)
    VALUES (cbc_test_id, test_strip_id, 1)
    ON CONFLICT (test_id, item_id) DO NOTHING;
  END IF;
END $$;

-- Insert test consumptions for Glucose test
DO $$
DECLARE
  glucose_test_id uuid;
  blood_tube_id uuid;
  reagent_id uuid;
BEGIN
  SELECT id INTO glucose_test_id FROM tests WHERE name = 'Blood Glucose Test' LIMIT 1;
  SELECT id INTO blood_tube_id FROM inventory_items WHERE name = 'Blood Collection Tubes' LIMIT 1;
  SELECT id INTO reagent_id FROM inventory_items WHERE name = 'Glucose Test Reagent' LIMIT 1;
  
  IF glucose_test_id IS NOT NULL AND blood_tube_id IS NOT NULL THEN
    INSERT INTO test_consumptions (test_id, item_id, qty_used)
    VALUES (glucose_test_id, blood_tube_id, 1)
    ON CONFLICT (test_id, item_id) DO NOTHING;
  END IF;
  
  IF glucose_test_id IS NOT NULL AND reagent_id IS NOT NULL THEN
    INSERT INTO test_consumptions (test_id, item_id, qty_used)
    VALUES (glucose_test_id, reagent_id, 5)
    ON CONFLICT (test_id, item_id) DO NOTHING;
  END IF;
END $$;

-- Insert sample patient
INSERT INTO patients (name, phone, gender, age, address)
VALUES 
  ('Ahmed Khan', '+91-9876543210', 'Male', 35, '123 Main Street, Mumbai'),
  ('Fatima Ali', '+91-9876543211', 'Female', 28, '456 Park Avenue, Delhi'),
  ('Mohammed Rahman', '+91-9876543212', 'Male', 42, '789 Lake Road, Bangalore')
ON CONFLICT DO NOTHING;