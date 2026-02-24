/*
  # Add Draft Status and Timestamp to Purchases

  This migration adds draft functionality and time tracking to purchases.

  1. Changes to purchases table
    - Add `status` column (draft or completed)
    - Add `completed_at` timestamp for when purchase is finalized
    - Update existing records to have 'completed' status

  2. Important Notes
    - Draft purchases can be saved and edited later
    - Completed purchases are final and update inventory
    - Time tracking shows when purchases were completed
*/

-- Add status column (draft or completed)
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed' 
CHECK (status IN ('draft', 'completed'));

-- Add completed_at timestamp
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Set completed_at for existing completed purchases
UPDATE purchases 
SET completed_at = created_at 
WHERE status = 'completed' AND completed_at IS NULL;
