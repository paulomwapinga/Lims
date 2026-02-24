/*
  # Create Purchases Table

  1. New Tables
    - `purchases`
      - `id` (uuid, primary key)
      - `purchase_date` (timestamptz) - Date of purchase
      - `item_id` (uuid) - Reference to inventory_items
      - `quantity` (numeric) - Quantity purchased
      - `unit_price` (numeric) - Price per unit
      - `total_amount` (numeric) - Total purchase amount
      - `supplier` (text) - Supplier name
      - `notes` (text) - Additional notes
      - `created_by` (uuid) - Reference to user who created the purchase
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `purchases` table
    - Add policy for authenticated users to view all purchases
    - Add policy for authenticated users to insert purchases
    - Add policy for authenticated users to update their own purchases
    - Add policy for authenticated users to delete their own purchases

  3. Important Notes
    - Purchases automatically update inventory stock levels in the application layer
    - Tracks both medicines and lab consumables
    - Maintains audit trail with created_by field
*/

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date timestamptz NOT NULL DEFAULT now(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  supplier text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all purchases"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert purchases"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update their own purchases"
  ON purchases
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete their own purchases"
  ON purchases
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_purchases_item_id ON purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_created_by ON purchases(created_by);