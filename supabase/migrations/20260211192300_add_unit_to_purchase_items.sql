/*
  # Add Unit to Purchase Items

  This migration adds a unit field to purchase_items table to allow flexible unit selection
  when recording purchases (e.g., box, pcs, bottles, etc).

  1. Changes
    - Add `unit` column to `purchase_items` table
    - Set default value from the inventory item's unit for existing records
    - Make unit NOT NULL to ensure data integrity

  2. Important Notes
    - Existing purchase items will inherit the unit from their inventory item
    - New purchases can specify any unit (box, pcs, strips, bottles, etc.)
    - This allows purchasing in bulk units while tracking in different units in inventory
*/

-- Add unit column to purchase_items (nullable initially for data migration)
ALTER TABLE purchase_items 
ADD COLUMN IF NOT EXISTS unit text;

-- Populate existing records with units from their inventory items
UPDATE purchase_items pi
SET unit = ii.unit
FROM inventory_items ii
WHERE pi.item_id = ii.id
AND pi.unit IS NULL;

-- Make unit NOT NULL now that all records have values
ALTER TABLE purchase_items 
ALTER COLUMN unit SET NOT NULL;
