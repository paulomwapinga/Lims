/*
  # Fix Missing Abnormality Types in Test Results

  1. Purpose
    - Updates existing visit_test_results records where is_abnormal = true but abnormality_type is null
    - Calculates the correct abnormality type (L for low, H for high) based on the value and reference ranges

  2. Changes
    - Updates visit_test_results.abnormality_type by comparing numeric values against reference ranges
    - Sets 'L' if value is below ref_range_from
    - Sets 'H' if value is above ref_range_to

  3. Notes
    - Only affects records where is_abnormal is true and abnormality_type is null
    - Uses the test parameter reference ranges to determine the type
    - Handles non-numeric values safely
*/

-- Update abnormality types for existing results
UPDATE visit_test_results vtr
SET abnormality_type = CASE
  WHEN (vtr.value ~ '^[0-9.]+$')::boolean THEN
    CASE
      WHEN tp.ref_range_from IS NOT NULL 
           AND (vtr.value::numeric) < tp.ref_range_from THEN 'L'
      WHEN tp.ref_range_to IS NOT NULL 
           AND (vtr.value::numeric) > tp.ref_range_to THEN 'H'
      ELSE NULL
    END
  ELSE NULL
END
FROM test_parameters tp
WHERE vtr.test_parameter_id = tp.id
  AND vtr.is_abnormal = true
  AND vtr.abnormality_type IS NULL
  AND (tp.ref_range_from IS NOT NULL OR tp.ref_range_to IS NOT NULL);
