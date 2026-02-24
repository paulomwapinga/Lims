/*
  # Remtullah Medical Laboratory - Complete Database Schema

  ## Overview
  This migration creates the complete database schema for Remtullah Medical Laboratory,
  a dispensary + lab + inventory management system with two user roles: Admin and Doctor.

  ## Tables Created

  ### 1. users
  - Stores admin and doctor accounts
  - Fields: id, name, email, password_hash (managed by Supabase Auth), role (admin/doctor)
  - Links to auth.users for authentication

  ### 2. facility_settings
  - Stores facility branding and configuration
  - Fields: name, address, phone, footer_note

  ### 3. patients
  - Patient records with demographics
  - Fields: name, phone, gender, dob, age, address

  ### 4. inventory_items
  - Medicines and lab consumables with pricing
  - Fields: name, type (medicine/lab_consumable), unit, qty_on_hand, reorder_level, cost_price, sell_price

  ### 5. stock_movements
  - Audit trail for all inventory changes
  - Fields: item_id, movement_type (IN/OUT/ADJUST), qty, reason, reference_type, reference_id, performed_by

  ### 6. tests
  - Lab test definitions with pricing
  - Fields: name, price, notes

  ### 7. test_consumptions
  - Bill of Materials (BOM) for tests - defines which consumables each test uses
  - Fields: test_id, item_id (lab_consumable), qty_used

  ### 8. visits
  - Main transaction entity for patient consultations
  - Fields: patient_id, doctor_id, notes, diagnosis, subtotal, discount, total, paid, balance, payment_status

  ### 9. visit_tests
  - Tests ordered in a visit
  - Fields: visit_id, test_id, price, qty, result_text

  ### 10. visit_medicines
  - Medicines dispensed in a visit
  - Fields: visit_id, item_id, price, qty, instructions

  ## Security
  - RLS enabled on all tables
  - Admin has full access
  - Doctor has limited access based on role requirements
*/

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'doctor');
CREATE TYPE item_type AS ENUM ('medicine', 'lab_consumable');
CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'ADJUST');
CREATE TYPE payment_status AS ENUM ('paid', 'unpaid', 'partial');

-- 1. Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'doctor',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Facility settings (single row configuration)
CREATE TABLE IF NOT EXISTS facility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Remtullah Medical Laboratory',
  address text DEFAULT '',
  phone text DEFAULT '',
  footer_note text DEFAULT 'Thank you for your visit',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Patients
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text DEFAULT '',
  gender text DEFAULT '',
  dob date,
  age int,
  address text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT age_or_dob_required CHECK (age IS NOT NULL OR dob IS NOT NULL)
);

-- 4. Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  type item_type NOT NULL,
  unit text NOT NULL,
  qty_on_hand decimal(10,2) NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  reorder_level decimal(10,2) DEFAULT 0,
  cost_price decimal(10,2) DEFAULT 0,
  sell_price decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Stock movements (audit trail)
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type movement_type NOT NULL,
  qty decimal(10,2) NOT NULL,
  reason text DEFAULT '',
  reference_type text DEFAULT '',
  reference_id uuid,
  performed_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- 6. Tests
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Test consumptions (BOM)
CREATE TABLE IF NOT EXISTS test_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty_used decimal(10,2) NOT NULL CHECK (qty_used > 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(test_id, item_id)
);

-- 8. Visits
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES users(id),
  notes text DEFAULT '',
  diagnosis text DEFAULT '',
  subtotal decimal(10,2) NOT NULL DEFAULT 0,
  discount decimal(10,2) DEFAULT 0,
  total decimal(10,2) NOT NULL DEFAULT 0,
  paid decimal(10,2) DEFAULT 0,
  balance decimal(10,2) DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. Visit tests
CREATE TABLE IF NOT EXISTS visit_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES tests(id),
  price decimal(10,2) NOT NULL,
  qty int NOT NULL DEFAULT 1 CHECK (qty > 0),
  result_text text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 10. Visit medicines
CREATE TABLE IF NOT EXISTS visit_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id),
  price decimal(10,2) NOT NULL,
  qty decimal(10,2) NOT NULL CHECK (qty > 0),
  instructions text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_items(type);
CREATE INDEX IF NOT EXISTS idx_inventory_qty ON inventory_items(qty_on_hand);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);
CREATE INDEX IF NOT EXISTS idx_visit_tests_visit ON visit_tests(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_medicines_visit ON visit_medicines(visit_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_medicines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for facility_settings
CREATE POLICY "Authenticated users can view facility settings"
  ON facility_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update facility settings"
  ON facility_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert facility settings"
  ON facility_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for patients
CREATE POLICY "Authenticated users can view patients"
  ON patients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Doctors and admins can create patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Doctors and admins can update patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

-- RLS Policies for inventory_items
CREATE POLICY "Authenticated users can view inventory"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage inventory"
  ON inventory_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for stock_movements
CREATE POLICY "Authenticated users can view stock movements"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create stock movements"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

-- RLS Policies for tests
CREATE POLICY "Authenticated users can view tests"
  ON tests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage tests"
  ON tests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for test_consumptions
CREATE POLICY "Authenticated users can view test consumptions"
  ON test_consumptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage test consumptions"
  ON test_consumptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for visits
CREATE POLICY "Authenticated users can view visits"
  ON visits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Doctors can create visits"
  ON visits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Doctors can update visits"
  ON visits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

-- RLS Policies for visit_tests
CREATE POLICY "Authenticated users can view visit tests"
  ON visit_tests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Doctors can manage visit tests"
  ON visit_tests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

-- RLS Policies for visit_medicines
CREATE POLICY "Authenticated users can view visit medicines"
  ON visit_medicines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Doctors can manage visit medicines"
  ON visit_medicines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Insert default facility settings
INSERT INTO facility_settings (name, address, phone, footer_note)
VALUES ('Remtullah Medical Laboratory', '', '', 'Thank you for your visit')
ON CONFLICT DO NOTHING;