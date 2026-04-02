/*
  # Add Dashboard Helper Functions

  1. New Functions
    - `count_distinct_patients_today(today_start)`: Returns count of distinct patient_ids from visits today
    - `count_low_stock_items()`: Returns count of inventory items where qty_on_hand <= reorder_level

  These replace client-side data fetching patterns that were subject to the PostgREST 1000-row cap.
*/

CREATE OR REPLACE FUNCTION count_distinct_patients_today(today_start timestamptz)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT patient_id)
  FROM visits
  WHERE created_at >= today_start;
$$;

CREATE OR REPLACE FUNCTION count_low_stock_items()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM inventory_items
  WHERE qty_on_hand <= reorder_level;
$$;
