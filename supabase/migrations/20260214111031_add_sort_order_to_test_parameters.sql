/*
  # Add Sort Order to Test Parameters

  1. Changes
    - Add `sort_order` column to `test_parameters` table
      - `sort_order` (integer, default 0) - Display order of parameters within a test
    - Add index on (test_id, sort_order) for efficient sorting
    - Update existing records to set sort_order based on creation order

  2. Purpose
    - Enable custom ordering of test parameters
    - Allow drag-and-drop reordering in UI
    - Maintain consistent parameter display order

  3. Notes
    - Existing parameters will be assigned sort_order based on their creation time
    - Lower sort_order values appear first
*/

-- Add sort_order column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_parameters' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE test_parameters ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Set initial sort_order for existing records based on creation order
UPDATE test_parameters
SET sort_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY test_id ORDER BY created_at) - 1 AS row_num
  FROM test_parameters
) AS subquery
WHERE test_parameters.id = subquery.id;

-- Create index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_test_parameters_test_id_sort_order 
  ON test_parameters(test_id, sort_order);