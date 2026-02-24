/*
  # Create Units Table

  1. New Tables
    - `units`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Unit name/abbreviation
      - `description` (text) - Full description of the unit
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `units` table
    - Add policy for authenticated users to read units
    - Add policy for admin users to manage units

  3. Default Data
    - Seed common medical units (tablets, capsules, ml, bottles, etc.)
*/

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read units"
  ON units
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert units"
  ON units
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update units"
  ON units
  FOR UPDATE
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

CREATE POLICY "Admins can delete units"
  ON units
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert default units
INSERT INTO units (name, description) VALUES
  ('tab', 'Tablet'),
  ('cap', 'Capsule'),
  ('pc', 'Piece'),
  ('strip', 'Strip'),
  ('bottle', 'Bottle'),
  ('ml', 'Milliliter'),
  ('sachet', 'Sachet'),
  ('vial', 'Vial'),
  ('ampule', 'Ampule'),
  ('tube', 'Tube'),
  ('box', 'Box'),
  ('syringe', 'Syringe'),
  ('inhaler', 'Inhaler'),
  ('drops', 'Drops'),
  ('pack', 'Pack')
ON CONFLICT (name) DO NOTHING;