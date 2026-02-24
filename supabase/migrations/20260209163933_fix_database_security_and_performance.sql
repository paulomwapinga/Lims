/*
  # Fix Database Security and Performance Issues

  ## Overview
  This migration addresses critical security and performance issues identified in the database:
  - Adds missing indexes on foreign keys for better query performance
  - Optimizes RLS policies to use `(select auth.uid())` for better performance at scale
  - Fixes overly permissive RLS policies on test_consumables table

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes
  - Add index on `stock_movements.performed_by` for better join performance
  - Add index on `test_consumptions.item_id` for better join performance
  - Add index on `visit_medicines.item_id` for better join performance
  - Add index on `visit_tests.test_id` for better join performance

  ### 2. Optimize RLS Policies (Replace auth.uid() with (select auth.uid()))
  All RLS policies updated to use `(select auth.uid())` instead of `auth.uid()` to prevent
  re-evaluation for each row, significantly improving query performance at scale.

  Policies updated:
  - users: Users can view own profile
  - facility_settings: Admins can update/insert facility settings
  - patients: Doctors/admins can create patients, admins can update/delete
  - inventory_items: Admins can manage inventory
  - stock_movements: Authenticated users can create, admins can delete
  - tests: Admins can manage tests
  - test_consumptions: Admins can manage test consumptions
  - visits: Doctors can create, admins can update/delete
  - visit_tests: Doctors can insert, admins can update/delete
  - visit_medicines: Doctors can insert, admins can update/delete
  - purchases: Authenticated users can manage their own purchases

  ### 3. Fix Overly Permissive RLS Policies on test_consumables
  Replaced policies that used `USING (true)` with proper admin-only restrictions:
  - Only admins can insert/update/delete test consumables
  - All authenticated users can still view test consumables

  ## Security Notes
  - All changes maintain existing access control requirements
  - Significantly improves performance for row-level security checks
  - Eliminates overly permissive policies that bypassed RLS
*/

-- ============================================================================
-- SECTION 1: Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by ON stock_movements(performed_by);
CREATE INDEX IF NOT EXISTS idx_test_consumptions_item_id ON test_consumptions(item_id);
CREATE INDEX IF NOT EXISTS idx_visit_medicines_item_id ON visit_medicines(item_id);
CREATE INDEX IF NOT EXISTS idx_visit_tests_test_id ON visit_tests(test_id);

-- ============================================================================
-- SECTION 2: Optimize RLS Policies - Replace auth.uid() with (select auth.uid())
-- ============================================================================

-- Users Table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Facility Settings Table
DROP POLICY IF EXISTS "Admins can update facility settings" ON facility_settings;
CREATE POLICY "Admins can update facility settings"
  ON facility_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert facility settings" ON facility_settings;
CREATE POLICY "Admins can insert facility settings"
  ON facility_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Patients Table
DROP POLICY IF EXISTS "Doctors and admins can create patients" ON patients;
CREATE POLICY "Doctors and admins can create patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update patients" ON patients;
CREATE POLICY "Admins can update patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete patients" ON patients;
CREATE POLICY "Admins can delete patients"
  ON patients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Inventory Items Table
DROP POLICY IF EXISTS "Admins can manage inventory" ON inventory_items;
CREATE POLICY "Admins can manage inventory"
  ON inventory_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Stock Movements Table
DROP POLICY IF EXISTS "Authenticated users can create stock movements" ON stock_movements;
CREATE POLICY "Authenticated users can create stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can delete stock movements" ON stock_movements;
CREATE POLICY "Admins can delete stock movements"
  ON stock_movements FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Tests Table
DROP POLICY IF EXISTS "Admins can manage tests" ON tests;
CREATE POLICY "Admins can manage tests"
  ON tests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Test Consumptions Table
DROP POLICY IF EXISTS "Admins can manage test consumptions" ON test_consumptions;
CREATE POLICY "Admins can manage test consumptions"
  ON test_consumptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Visits Table
DROP POLICY IF EXISTS "Doctors can create visits" ON visits;
CREATE POLICY "Doctors can create visits"
  ON visits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update visits" ON visits;
CREATE POLICY "Admins can update visits"
  ON visits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete visits" ON visits;
CREATE POLICY "Admins can delete visits"
  ON visits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Visit Tests Table
DROP POLICY IF EXISTS "Doctors can insert visit tests" ON visit_tests;
CREATE POLICY "Doctors can insert visit tests"
  ON visit_tests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update visit tests" ON visit_tests;
CREATE POLICY "Admins can update visit tests"
  ON visit_tests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete visit tests" ON visit_tests;
CREATE POLICY "Admins can delete visit tests"
  ON visit_tests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Visit Medicines Table
DROP POLICY IF EXISTS "Doctors can insert visit medicines" ON visit_medicines;
CREATE POLICY "Doctors can insert visit medicines"
  ON visit_medicines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update visit medicines" ON visit_medicines;
CREATE POLICY "Admins can update visit medicines"
  ON visit_medicines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete visit medicines" ON visit_medicines;
CREATE POLICY "Admins can delete visit medicines"
  ON visit_medicines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

-- Purchases Table
DROP POLICY IF EXISTS "Authenticated users can insert purchases" ON purchases;
CREATE POLICY "Authenticated users can insert purchases"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Authenticated users can update their own purchases" ON purchases;
CREATE POLICY "Authenticated users can update their own purchases"
  ON purchases
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Authenticated users can delete their own purchases" ON purchases;
CREATE POLICY "Authenticated users can delete their own purchases"
  ON purchases
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = created_by);

-- ============================================================================
-- SECTION 3: Fix Overly Permissive RLS Policies on test_consumables
-- ============================================================================

-- Drop the overly permissive policies that use USING (true) or WITH CHECK (true)
DROP POLICY IF EXISTS "Authenticated users can insert test consumables" ON test_consumables;
DROP POLICY IF EXISTS "Authenticated users can update test consumables" ON test_consumables;
DROP POLICY IF EXISTS "Authenticated users can delete test consumables" ON test_consumables;

-- Create proper restrictive policies - only admins can manage test consumables
CREATE POLICY "Admins can insert test consumables"
  ON test_consumables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update test consumables"
  ON test_consumables
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete test consumables"
  ON test_consumables
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid()) AND users.role = 'admin'
    )
  );
