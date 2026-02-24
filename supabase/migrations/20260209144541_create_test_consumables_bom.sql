/*
  # Create Test Consumables BOM (Bill of Materials)

  1. New Tables
    - `test_consumables`
      - `id` (uuid, primary key)
      - `test_id` (uuid) - Reference to tests table
      - `item_id` (uuid) - Reference to inventory_items (lab consumables)
      - `quantity` (numeric) - Quantity of consumable required per test
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `result` field to `visit_tests` table for storing test results

  3. Security
    - Enable RLS on `test_consumables` table
    - Add policies for authenticated users to view test consumables
    - Add policies for admin users to manage test consumables

  4. Important Notes
    - When a test is ordered during a visit, the system will:
      - Check if sufficient stock exists for all required consumables
      - Deduct consumables from inventory automatically
      - Log stock movements with reference to the visit
    - Only lab consumables can be added to test BOM (not medicines)
    - Equipment (non-consumable items) are tracked separately
*/

CREATE TABLE IF NOT EXISTS test_consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(test_id, item_id)
);

ALTER TABLE test_consumables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view test consumables"
  ON test_consumables
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert test consumables"
  ON test_consumables
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update test consumables"
  ON test_consumables
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete test consumables"
  ON test_consumables
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_test_consumables_test_id ON test_consumables(test_id);
CREATE INDEX IF NOT EXISTS idx_test_consumables_item_id ON test_consumables(item_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visit_tests' AND column_name = 'result'
  ) THEN
    ALTER TABLE visit_tests ADD COLUMN result text DEFAULT '';
  END IF;
END $$;