/*
  # Add Abnormality Type Classification

  ## Overview
  Adds automated interpretation of abnormal results with L (Low) and H (High) indicators.

  ## 1. Table Modifications
  
  ### visit_test_results
  - Add `abnormality_type` (text, nullable) - Classification of abnormality: NULL (normal), 'L' (below range), or 'H' (above range)
  
  ## 2. Constraints
  - Add check constraint to ensure only valid abnormality types: NULL, 'L', or 'H'
  
  ## 3. Logic
  - When result value < ref_range_from → is_abnormal = true, abnormality_type = 'L'
  - When result value > ref_range_to → is_abnormal = true, abnormality_type = 'H'
  - When result is within range → is_abnormal = false, abnormality_type = NULL
  
  ## 4. Important Notes
  - Auto-detection works only for numeric values
  - Text and dropdown parameters require manual marking
  - Technicians can manually override auto-detected values
  - L/H indicators provide clinical context for abnormal results
*/

-- Add abnormality_type column to visit_test_results
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visit_test_results' AND column_name = 'abnormality_type'
  ) THEN
    ALTER TABLE visit_test_results 
    ADD COLUMN abnormality_type text;
  END IF;
END $$;

-- Add check constraint for valid abnormality types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'visit_test_results' AND constraint_name = 'visit_test_results_abnormality_type_check'
  ) THEN
    ALTER TABLE visit_test_results
    ADD CONSTRAINT visit_test_results_abnormality_type_check 
    CHECK (abnormality_type IN ('L', 'H') OR abnormality_type IS NULL);
  END IF;
END $$;

-- Create index for querying by abnormality type
CREATE INDEX IF NOT EXISTS idx_visit_test_results_abnormality_type 
  ON visit_test_results(abnormality_type) 
  WHERE abnormality_type IS NOT NULL;