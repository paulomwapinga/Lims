/*
  # Add Unit Field to Visit Medicines

  1. Changes
    - Add `unit` column to `visit_medicines` table
      - Type: text
      - Required field
      - Stores the dispensing unit (e.g., tablet, piece, strip, bottle, ml, etc.)
      - Default: 'pc' (piece) for backward compatibility

  2. Notes
    - Allows flexibility in specifying medicine units when dispensing
    - Different from inventory unit - this is the unit used for dispensing/prescription
    - Essential for clear medicine instructions and documentation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visit_medicines' AND column_name = 'unit'
  ) THEN
    ALTER TABLE visit_medicines 
    ADD COLUMN unit text NOT NULL DEFAULT 'pc';
  END IF;
END $$;