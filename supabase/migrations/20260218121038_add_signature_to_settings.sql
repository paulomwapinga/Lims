/*
  # Add Signature Storage to Settings

  1. Changes
    - Add `signature_image` column to settings table to store base64 encoded signature image
    - This will be used for displaying signatures on lab reports and receipts

  2. Security
    - Existing RLS policies will continue to apply
    - Only admins can update the signature
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'signature_image'
  ) THEN
    ALTER TABLE settings ADD COLUMN signature_image text;
  END IF;
END $$;
