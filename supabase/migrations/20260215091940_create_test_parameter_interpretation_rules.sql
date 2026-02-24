/*
  # Create Test Parameter Interpretation Rules System

  1. New Tables
    - `test_parameter_rules`
      - `id` (uuid, primary key)
      - `parameter_id` (uuid, foreign key to test_parameters)
      - `rule_type` (text) - Type of rule: 'numeric_comparison', 'text_match', 'range', 'presence'
      - `operator` (text) - Comparison operator: '>', '<', '>=', '<=', '=', '!=', 'between', 'in', 'contains', 'exists'
      - `value` (text) - The comparison value (can be JSON for complex rules)
      - `result_status` (text) - The status to assign: 'normal', 'abnormal', 'critical'
      - `priority` (integer) - Rule evaluation priority (lower number = higher priority)
      - `active` (boolean) - Whether the rule is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `test_parameter_rules` table
    - Add policies for authenticated users to read rules
    - Add policies for admins to manage rules

  3. Indexes
    - Index on parameter_id for fast lookups
    - Index on active status

  4. Notes
    - Rules are evaluated in priority order
    - Multiple rules can exist for the same parameter
    - First matching rule determines the interpretation
    - Supports complex rules through JSON value field
*/

CREATE TABLE IF NOT EXISTS test_parameter_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id uuid REFERENCES test_parameters(id) ON DELETE CASCADE NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('numeric_comparison', 'text_match', 'range', 'presence')),
  operator text NOT NULL CHECK (operator IN ('>', '<', '>=', '<=', '=', '!=', 'between', 'in', 'contains', 'exists', 'not_exists')),
  value text NOT NULL,
  result_status text NOT NULL CHECK (result_status IN ('normal', 'abnormal', 'critical')),
  priority integer DEFAULT 0 NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_test_parameter_rules_parameter_id ON test_parameter_rules(parameter_id);
CREATE INDEX IF NOT EXISTS idx_test_parameter_rules_active ON test_parameter_rules(active) WHERE active = true;

ALTER TABLE test_parameter_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active test parameter rules"
  ON test_parameter_rules FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can view all test parameter rules"
  ON test_parameter_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert test parameter rules"
  ON test_parameter_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update test parameter rules"
  ON test_parameter_rules FOR UPDATE
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

CREATE POLICY "Admins can delete test parameter rules"
  ON test_parameter_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_test_parameter_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_test_parameter_rules_updated_at
  BEFORE UPDATE ON test_parameter_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_test_parameter_rules_updated_at();