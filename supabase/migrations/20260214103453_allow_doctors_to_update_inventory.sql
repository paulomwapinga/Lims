/*
  # Allow Doctors to Update Inventory

  ## Overview
  This migration grants doctors the ability to update inventory items,
  which is necessary when dispensing medicine during patient visits.

  ## Changes Made

  ### 1. Security Changes
  - Drop the "Admins can manage inventory" FOR ALL policy
  - Add separate INSERT, UPDATE, and DELETE policies
  - Allow doctors and admins to update inventory quantities
  - Restrict INSERT and DELETE to admins only
  - This enables doctors to:
    - Update inventory quantities when dispensing medicine
    - Record stock movements for audit trail

  ## Security Notes
  - Doctors can only update inventory (not delete or insert)
  - INSERT and DELETE operations remain admin-only
  - SELECT policy already exists for all authenticated users
*/

-- Drop the existing admin-only FOR ALL policy
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory_items;

-- Allow doctors and admins to update inventory
CREATE POLICY "Doctors and admins can update inventory"
  ON inventory_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('doctor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('doctor', 'admin')
    )
  );

-- Allow admins to insert and delete inventory items
CREATE POLICY "Admins can insert inventory"
  ON inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete inventory"
  ON inventory_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.role = 'admin'
    )
  );
