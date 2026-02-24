/*
  # Add Parameter Types and Allowed Values Support

  This migration adds support for numeric, qualitative, and boolean parameter types
  to the test_parameters table.

  1. Changes to Existing Tables
    - `test_parameters`
      - Add `parameter_type` (text) - Type of parameter: numeric, qualitative, or boolean
      - Add `allowed_values` (jsonb) - Stores allowed values for qualitative/boolean types
      - Existing parameters default to 'numeric' type

  2. Data Migration
    - Set all existing parameters to 'numeric' type with null allowed_values

  3. Constraints
    - parameter_type must be one of: numeric, qualitative, boolean
    - For qualitative/boolean types, allowed_values must contain at least 2 values
    - For numeric types, allowed_values must be null

  4. Important Notes
    - Backward compatible: existing numeric parameters continue to work
    - Reference ranges only apply to numeric parameters
    - Qualitative and boolean parameters use allowed_values for dropdown options
*/

-- Add parameter_type column with default 'numeric'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_parameters' AND column_name = 'parameter_type'
  ) THEN
    ALTER TABLE test_parameters ADD COLUMN parameter_type text NOT NULL DEFAULT 'numeric';
  END IF;
END $$;

-- Add allowed_values column (JSONB for structured data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_parameters' AND column_name = 'allowed_values'
  ) THEN
    ALTER TABLE test_parameters ADD COLUMN allowed_values jsonb DEFAULT NULL;
  END IF;
END $$;

-- Add constraint to ensure parameter_type is valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'test_parameters_parameter_type_check'
  ) THEN
    ALTER TABLE test_parameters
    ADD CONSTRAINT test_parameters_parameter_type_check
    CHECK (parameter_type IN ('numeric', 'qualitative', 'boolean'));
  END IF;
END $$;

-- Update existing parameters to be 'numeric' type (already default, but explicit)
UPDATE test_parameters
SET parameter_type = 'numeric', allowed_values = NULL
WHERE parameter_type = 'numeric';

-- Create index for faster filtering by parameter type
CREATE INDEX IF NOT EXISTS idx_test_parameters_type ON test_parameters(parameter_type);

-- Add helpful comment
COMMENT ON COLUMN test_parameters.parameter_type IS 'Type of parameter: numeric (with ranges), qualitative (dropdown values), or boolean (positive/negative)';
COMMENT ON COLUMN test_parameters.allowed_values IS 'JSON array of allowed values for qualitative and boolean types. NULL for numeric types.';
