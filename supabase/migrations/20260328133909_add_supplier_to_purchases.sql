/*
  # Add Supplier Reference to Purchases

  1. Changes
    - Add `supplier_id` column to `purchases` table (foreign key to suppliers)
    - Keep existing `supplier` column for backward compatibility and manual entry
    - Add index for supplier lookups
    - Add trigger to update `updated_at` timestamp on suppliers table

  2. Notes
    - `supplier_id` is optional - allows linking to saved supplier
    - `supplier` text field remains for one-off purchases or manual entry
    - If both are provided, `supplier_id` takes precedence in UI
*/

-- Add supplier_id column to purchases table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE purchases ADD COLUMN supplier_id uuid REFERENCES suppliers(id);
  END IF;
END $$;

-- Create index for supplier lookups
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);

-- Create updated_at trigger for suppliers table
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_suppliers_updated_at ON suppliers;
CREATE TRIGGER trigger_update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_updated_at();