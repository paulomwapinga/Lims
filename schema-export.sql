-- ============================================================================
-- Remtullah Medical Laboratory Database Schema Export
-- Generated: 2026-02-25
-- Total Tables: 23
-- ============================================================================

-- Custom Types
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'lab_tech');
CREATE TYPE item_type AS ENUM ('medicine', 'lab_consumable');
CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'ADJUST');
CREATE TYPE payment_status AS ENUM ('paid', 'unpaid', 'partial');

-- Core Tables
-- ============================================================================

-- Users table (linked to Supabase Auth)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role DEFAULT 'doctor'::user_role,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Patients
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text DEFAULT ''::text,
  gender text DEFAULT ''::text,
  dob date,
  age integer,
  age_unit text DEFAULT 'years'::text,
  marital_status text,
  address text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT age_unit_check CHECK (age_unit = ANY (ARRAY['years'::text, 'months'::text])),
  CONSTRAINT marital_status_check CHECK (marital_status = ANY (ARRAY['Single'::text, 'Married'::text, 'Divorced'::text, 'Widowed'::text, 'Separated'::text]))
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Visits
CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(id),
  notes text DEFAULT ''::text,
  diagnosis text DEFAULT ''::text,
  subtotal numeric DEFAULT 0,
  total numeric DEFAULT 0,
  paid numeric DEFAULT 0,
  balance numeric DEFAULT 0,
  payment_status payment_status DEFAULT 'unpaid'::payment_status,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT balance_check CHECK (balance >= 0::numeric)
);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Tests
CREATE TABLE tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  price numeric,
  notes text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT price_check CHECK (price >= 0::numeric)
);

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

-- Test Parameters
CREATE TABLE test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES tests(id) ON DELETE CASCADE,
  parameter_name text NOT NULL,
  parameter_type text DEFAULT 'numeric'::text,
  applicable_to_male boolean DEFAULT false,
  applicable_to_female boolean DEFAULT false,
  applicable_to_child boolean DEFAULT false,
  ref_range_from numeric,
  ref_range_to numeric,
  unit text,
  allowed_values jsonb,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT parameter_type_check CHECK (parameter_type = ANY (ARRAY['numeric'::text, 'qualitative'::text, 'boolean'::text]))
);

ALTER TABLE test_parameters ENABLE ROW LEVEL SECURITY;

-- Visit Tests
CREATE TABLE visit_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  test_id uuid REFERENCES tests(id),
  price numeric NOT NULL,
  qty integer DEFAULT 1,
  result_text text DEFAULT ''::text,
  result text DEFAULT ''::text,
  results_status text DEFAULT 'pending'::text,
  results_entered_at timestamptz,
  results_entered_by uuid REFERENCES auth.users(id),
  technician_notes text,
  sent_to_doctor_at timestamptz,
  sent_to_doctor_by uuid REFERENCES auth.users(id),
  doctor_viewed_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT qty_check CHECK (qty > 0),
  CONSTRAINT results_status_check CHECK (results_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text]))
);

ALTER TABLE visit_tests ENABLE ROW LEVEL SECURITY;

-- Visit Test Results
CREATE TABLE visit_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_test_id uuid REFERENCES visit_tests(id) ON DELETE CASCADE,
  test_parameter_id uuid REFERENCES test_parameters(id) ON DELETE CASCADE,
  value text NOT NULL,
  is_abnormal boolean DEFAULT false,
  abnormality_type text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT abnormality_type_check CHECK ((abnormality_type = ANY (ARRAY['L'::text, 'H'::text])) OR abnormality_type IS NULL)
);

ALTER TABLE visit_test_results ENABLE ROW LEVEL SECURITY;

-- Inventory Items
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  type item_type NOT NULL,
  unit text NOT NULL,
  qty_on_hand numeric DEFAULT 0,
  reorder_level numeric DEFAULT 0,
  cost_price numeric DEFAULT 0,
  sell_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT qty_check CHECK (qty_on_hand >= 0::numeric)
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Visit Medicines
CREATE TABLE visit_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id),
  price numeric NOT NULL,
  qty numeric,
  unit text DEFAULT 'pc'::text,
  instructions text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT qty_check CHECK (qty > 0::numeric)
);

ALTER TABLE visit_medicines ENABLE ROW LEVEL SECURITY;

-- Stock Movements
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type movement_type NOT NULL,
  qty numeric NOT NULL,
  reason text DEFAULT ''::text,
  reference_type text DEFAULT ''::text,
  reference_id uuid,
  performed_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Purchases
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date timestamptz DEFAULT now(),
  total_amount numeric,
  supplier text DEFAULT ''::text,
  notes text DEFAULT ''::text,
  status text DEFAULT 'completed'::text,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT total_amount_check CHECK (total_amount >= 0::numeric),
  CONSTRAINT status_check CHECK (status = ANY (ARRAY['draft'::text, 'completed'::text]))
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Purchase Items
CREATE TABLE purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id),
  quantity numeric,
  unit text NOT NULL,
  unit_price numeric,
  total_amount numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT quantity_check CHECK (quantity > 0::numeric),
  CONSTRAINT unit_price_check CHECK (unit_price >= 0::numeric),
  CONSTRAINT total_amount_check CHECK (total_amount >= 0::numeric)
);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- Test Consumables (Bill of Materials)
CREATE TABLE test_consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES tests(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id),
  quantity numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT quantity_check CHECK (quantity > 0::numeric)
);

ALTER TABLE test_consumables ENABLE ROW LEVEL SECURITY;

-- Test Parameter Rules
CREATE TABLE test_parameter_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id uuid REFERENCES test_parameters(id) ON DELETE CASCADE,
  rule_type text,
  operator text,
  value text NOT NULL,
  result_status text,
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT rule_type_check CHECK (rule_type = ANY (ARRAY['numeric_comparison'::text, 'text_match'::text, 'range'::text, 'presence'::text])),
  CONSTRAINT operator_check CHECK (operator = ANY (ARRAY['>'::text, '<'::text, '>='::text, '<='::text, '='::text, '!='::text, 'between'::text, 'in'::text, 'contains'::text, 'exists'::text, 'not_exists'::text])),
  CONSTRAINT result_status_check CHECK (result_status = ANY (ARRAY['normal'::text, 'abnormal'::text, 'critical'::text]))
);

ALTER TABLE test_parameter_rules ENABLE ROW LEVEL SECURITY;

-- Units
CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT ''::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Settings
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  signature_image text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Facility Settings
CREATE TABLE facility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text DEFAULT 'Remtullah Medical Laboratory'::text,
  address text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  footer_note text DEFAULT 'Thank you for your visit'::text,
  sms_enabled boolean DEFAULT false,
  sms_api_key text DEFAULT ''::text,
  sms_secret_key text DEFAULT ''::text,
  sms_source_addr text DEFAULT ''::text,
  sms_template text DEFAULT 'Habari [PATIENT_NAME], majibu ya kipimo yako tayari. Tafadhali fika maabara.'::text,
  welcome_sms_enabled boolean DEFAULT false,
  welcome_sms_template text DEFAULT 'Karibu [PATIENT_NAME]! Tunakushukuru kwa kuchagua [CLINIC_NAME]. Tunaomba afya njema.'::text,
  supabase_url text DEFAULT 'https://rjjxheikbfzrmdvjfrva.supabase.co'::text,
  supabase_anon_key text,
  service_role_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text DEFAULT 'lab_result_ready'::text,
  title text NOT NULL,
  message text NOT NULL,
  related_visit_test_id uuid REFERENCES visit_tests(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SMS Communication Tables
CREATE TABLE sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_audience text,
  recipient_count integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  status text DEFAULT 'draft'::text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT target_audience_check CHECK (target_audience = ANY (ARRAY['all_patients'::text, 'selected_patients'::text, 'all_users'::text, 'custom'::text])),
  CONSTRAINT status_check CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'completed'::text, 'failed'::text]))
);

ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE sms_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  recipient_type text,
  recipient_id uuid,
  phone_number text NOT NULL,
  status text DEFAULT 'pending'::text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT recipient_type_check CHECK (recipient_type = ANY (ARRAY['patient'::text, 'user'::text, 'custom'::text])),
  CONSTRAINT status_check CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))
);

ALTER TABLE sms_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE TABLE sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  message_template text NOT NULL,
  placeholders jsonb DEFAULT '[]'::jsonb,
  usage_count integer DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT category_check CHECK (category = ANY (ARRAY['marketing'::text, 'notification'::text, 'announcement'::text, 'general'::text]))
);

ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text,
  recipient_id uuid,
  phone_number text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending'::text,
  error_message text,
  sent_by uuid REFERENCES users(id),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT recipient_type_check CHECK (recipient_type = ANY (ARRAY['patient'::text, 'user'::text, 'custom'::text])),
  CONSTRAINT status_check CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))
);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  message text NOT NULL,
  sms_type text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;

-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_visits_patient_id ON visits(patient_id);
CREATE INDEX idx_visits_doctor_id ON visits(doctor_id);
CREATE INDEX idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX idx_visit_tests_visit_id ON visit_tests(visit_id);
CREATE INDEX idx_visit_tests_test_id ON visit_tests(test_id);
CREATE INDEX idx_visit_tests_results_status ON visit_tests(results_status);
CREATE INDEX idx_visit_test_results_visit_test_id ON visit_test_results(visit_test_id);
CREATE INDEX idx_stock_movements_item_id ON stock_movements(item_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_sms_log_visit_id ON sms_log(visit_id);

-- ============================================================================
-- End of Schema Export
-- ============================================================================
