/*
  # Restructure Purchases to Support Multiple Items

  This migration restructures the purchases system to support multiple items per purchase order.

  1. New Tables
    - `purchase_items`
      - `id` (uuid, primary key)
      - `purchase_id` (uuid) - Reference to parent purchase
      - `item_id` (uuid) - Reference to inventory_items
      - `quantity` (numeric) - Quantity purchased
      - `unit_price` (numeric) - Price per unit at time of purchase
      - `total_amount` (numeric) - Calculated total for this line item
      - `created_at` (timestamptz)

  2. Changes to Existing Tables
    - Migrate existing purchase data to new structure
    - Remove item-specific columns from `purchases` table (item_id, quantity, unit_price)
    - Keep total_amount in purchases as the sum of all items

  3. Security
    - Enable RLS on `purchase_items` table
    - Add policies for authenticated users to view/manage purchase items

  4. Important Notes
    - Each existing purchase becomes a purchase order with one item
    - New purchases can have multiple items
    - Maintains referential integrity with foreign keys
*/

-- Create the purchase_items table
CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on purchase_items
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_items
CREATE POLICY "Authenticated users can view all purchase items"
  ON purchase_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert purchase items"
  ON purchase_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = purchase_items.purchase_id
      AND purchases.created_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update their purchase items"
  ON purchase_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = purchase_items.purchase_id
      AND purchases.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = purchase_items.purchase_id
      AND purchases.created_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can delete their purchase items"
  ON purchase_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = purchase_items.purchase_id
      AND purchases.created_by = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON purchase_items(item_id);

-- Migrate existing purchase data to the new structure
-- Each existing purchase becomes a purchase with one item in purchase_items
DO $$
DECLARE
  purchase_record RECORD;
BEGIN
  FOR purchase_record IN SELECT * FROM purchases WHERE item_id IS NOT NULL LOOP
    INSERT INTO purchase_items (purchase_id, item_id, quantity, unit_price, total_amount)
    VALUES (
      purchase_record.id,
      purchase_record.item_id,
      purchase_record.quantity,
      purchase_record.unit_price,
      purchase_record.total_amount
    );
  END LOOP;
END $$;

-- Now remove the item-specific columns from purchases table
ALTER TABLE purchases DROP COLUMN IF EXISTS item_id;
ALTER TABLE purchases DROP COLUMN IF EXISTS quantity;
ALTER TABLE purchases DROP COLUMN IF EXISTS unit_price;

-- Drop the old index that referenced item_id
DROP INDEX IF EXISTS idx_purchases_item_id;
