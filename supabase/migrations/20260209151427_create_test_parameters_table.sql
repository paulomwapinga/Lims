/*
  # Create Test Parameters Table

  1. New Tables
    - `test_parameters`
      - `id` (uuid, primary key)
      - `test_id` (uuid, foreign key to tests)
      - `parameter_name` (text, required) - Name of the parameter (e.g., Hemoglobin, WBC)
      - `applicable_to_male` (boolean, default false) - If applicable to males
      - `applicable_to_female` (boolean, default false) - If applicable to females
      - `applicable_to_child` (boolean, default false) - If applicable to children
      - `ref_range_from` (numeric, nullable) - Lower bound of reference range
      - `ref_range_to` (numeric, nullable) - Upper bound of reference range
      - `unit` (text, nullable) - Unit of measurement (e.g., g/dL, cells/µL)
      - `description` (text, nullable) - Additional notes or description
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `test_parameters` table
    - Add policy for authenticated users to read parameters
    - Add policy for admin users to manage parameters
*/

CREATE TABLE IF NOT EXISTS test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  parameter_name text NOT NULL,
  applicable_to_male boolean DEFAULT false,
  applicable_to_female boolean DEFAULT false,
  applicable_to_child boolean DEFAULT false,
  ref_range_from numeric,
  ref_range_to numeric,
  unit text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE test_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read test parameters"
  ON test_parameters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can insert test parameters"
  ON test_parameters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update test parameters"
  ON test_parameters FOR UPDATE
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

CREATE POLICY "Admin users can delete test parameters"
  ON test_parameters FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_test_parameters_test_id ON test_parameters(test_id);