/*
  # Create Suppliers Table

  1. New Tables
    - `suppliers`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Supplier company name
      - `contact_person` (text, optional) - Contact person name
      - `phone` (text, optional) - Contact phone number
      - `email` (text, optional) - Contact email
      - `address` (text, optional) - Supplier address
      - `notes` (text, optional) - Additional notes about supplier
      - `created_at` (timestamptz) - When supplier was added
      - `created_by` (uuid) - User who added the supplier
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `suppliers` table
    - Admins and doctors can view all suppliers
    - Only admins can create, update, or delete suppliers

  3. Indexes
    - Index on name for fast lookups and autocomplete
*/

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast name lookups (autocomplete)
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Admins and doctors can view all suppliers
CREATE POLICY "Admins and doctors can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'doctor')
    )
  );

-- Only admins can insert suppliers
CREATE POLICY "Admins can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can update suppliers
CREATE POLICY "Admins can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can delete suppliers
CREATE POLICY "Admins can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );