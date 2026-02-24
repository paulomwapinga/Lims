/*
  # Lab Test Results System

  ## Overview
  Creates a comprehensive system for entering, storing, and managing lab test results.

  ## 1. New Tables
  
  ### visit_test_results
  Stores individual parameter results for each test in a visit.
  - `id` (uuid, primary key) - Unique identifier
  - `visit_test_id` (uuid, foreign key) - Links to visit_tests table
  - `test_parameter_id` (uuid, foreign key) - Links to test_parameters table
  - `value` (text) - The actual result value (numeric, text, or selected option)
  - `is_abnormal` (boolean) - Flag to highlight abnormal results
  - `notes` (text, optional) - Additional notes for this specific parameter
  - `created_at` (timestamptz) - When the result was entered
  - `created_by` (uuid, foreign key) - User who entered the result
  - `updated_at` (timestamptz) - Last update timestamp
  - `updated_by` (uuid, foreign key) - User who last updated the result

  ## 2. Table Modifications
  
  ### visit_tests
  - Add `results_status` (text) - Tracks the status: 'pending', 'in_progress', 'completed'
  - Add `results_entered_at` (timestamptz) - When results were finalized
  - Add `results_entered_by` (uuid, foreign key) - User who finalized the results
  - Add `technician_notes` (text) - General notes for the entire test

  ## 3. Security
  - Enable RLS on visit_test_results table
  - Add policies for authenticated users to view results
  - Restrict creation/updates to admin, doctor, and lab_tech roles
  - Add check constraint to ensure valid results_status values

  ## 4. Indexes
  - Index on visit_test_id for fast lookups
  - Index on test_parameter_id for reporting
  - Index on results_status for filtering pending tests

  ## 5. Important Notes
  - Results are stored as text to accommodate different data types (numeric, text, options)
  - Frontend will handle type validation based on parameter_type
  - is_abnormal flag helps highlight critical results in reports
  - Audit trail maintained through created_by/updated_by fields
*/

-- Add new columns to visit_tests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visit_tests' AND column_name = 'results_status'
  ) THEN
    ALTER TABLE visit_tests 
    ADD COLUMN results_status text DEFAULT 'pending' NOT NULL,
    ADD COLUMN results_entered_at timestamptz,
    ADD COLUMN results_entered_by uuid REFERENCES auth.users(id),
    ADD COLUMN technician_notes text;
  END IF;
END $$;

-- Add check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'visit_tests' AND constraint_name = 'visit_tests_results_status_check'
  ) THEN
    ALTER TABLE visit_tests
    ADD CONSTRAINT visit_tests_results_status_check 
    CHECK (results_status IN ('pending', 'in_progress', 'completed'));
  END IF;
END $$;

-- Create visit_test_results table
CREATE TABLE IF NOT EXISTS visit_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_test_id uuid NOT NULL REFERENCES visit_tests(id) ON DELETE CASCADE,
  test_parameter_id uuid NOT NULL REFERENCES test_parameters(id) ON DELETE RESTRICT,
  value text NOT NULL,
  is_abnormal boolean DEFAULT false NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES auth.users(id) NOT NULL,
  UNIQUE(visit_test_id, test_parameter_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visit_test_results_visit_test_id 
  ON visit_test_results(visit_test_id);

CREATE INDEX IF NOT EXISTS idx_visit_test_results_test_parameter_id 
  ON visit_test_results(test_parameter_id);

CREATE INDEX IF NOT EXISTS idx_visit_tests_results_status 
  ON visit_tests(results_status);

-- Enable RLS
ALTER TABLE visit_test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visit_test_results

-- Allow authenticated users to view test results
CREATE POLICY "Users can view test results"
  ON visit_test_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admin, doctor, and lab_tech to insert results
CREATE POLICY "Staff can insert results"
  ON visit_test_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'doctor', 'lab_tech')
    )
  );

-- Allow admin, doctor, and lab_tech to update results
CREATE POLICY "Staff can update results"
  ON visit_test_results
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'doctor', 'lab_tech')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'doctor', 'lab_tech')
    )
  );

-- Allow only admin to delete results
CREATE POLICY "Admin can delete results"
  ON visit_test_results
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_visit_test_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS visit_test_results_updated_at ON visit_test_results;

CREATE TRIGGER visit_test_results_updated_at
  BEFORE UPDATE ON visit_test_results
  FOR EACH ROW
  EXECUTE FUNCTION update_visit_test_results_updated_at();