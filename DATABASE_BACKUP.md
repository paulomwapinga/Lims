# Database Schema Backup
**Generated:** 2026-02-25
**Database:** Remtullah Medical Laboratory System
**Total Tables:** 23
**Total Migrations:** 71

---

## Table of Contents
1. [Database Overview](#database-overview)
2. [Tables Summary](#tables-summary)
3. [Installed Extensions](#installed-extensions)
4. [Complete Table Definitions](#complete-table-definitions)
5. [Migration History](#migration-history)

---

## Database Overview

### Statistics
- **Total Tables:** 23
- **Total Rows:** ~2,890
- **RLS Enabled:** All tables
- **Custom Types:** 3 (user_role, item_type, movement_type, payment_status)
- **Total Migrations:** 71

### Core Modules
1. **User Management** - users, facility_settings, settings
2. **Patient Management** - patients
3. **Visit Management** - visits, visit_tests, visit_medicines, visit_test_results
4. **Laboratory System** - tests, test_parameters, test_consumables, test_parameter_rules
5. **Inventory Management** - inventory_items, stock_movements, purchases, purchase_items, units
6. **Communication System** - sms_campaigns, sms_campaign_recipients, sms_templates, sms_logs, sms_log
7. **Notifications** - notifications

---

## Tables Summary

| Table Name | Rows | RLS | Primary Key | Description |
|------------|------|-----|-------------|-------------|
| users | 3 | ✓ | id (uuid) | System users (admin, doctor, lab_tech) |
| patients | 132 | ✓ | id (uuid) | Patient records |
| visits | 148 | ✓ | id (uuid) | Patient visits |
| visit_tests | 299 | ✓ | id (uuid) | Tests ordered per visit |
| visit_test_results | 1195 | ✓ | id (uuid) | Individual test parameter results |
| visit_medicines | 4 | ✓ | id (uuid) | Medicines prescribed per visit |
| tests | 21 | ✓ | id (uuid) | Available laboratory tests |
| test_parameters | 60 | ✓ | id (uuid) | Parameters for each test |
| test_consumables | 13 | ✓ | id (uuid) | Bill of materials for tests |
| test_parameter_rules | 37 | ✓ | id (uuid) | Interpretation rules for results |
| inventory_items | 28 | ✓ | id (uuid) | Inventory (medicines & lab consumables) |
| stock_movements | 352 | ✓ | id (uuid) | Inventory transaction log |
| purchases | 1 | ✓ | id (uuid) | Purchase orders |
| purchase_items | 1 | ✓ | id (uuid) | Line items for purchases |
| units | 15 | ✓ | id (uuid) | Units of measurement |
| facility_settings | 1 | ✓ | id (uuid) | Clinic information & SMS settings |
| settings | 18 | ✓ | id (uuid) | System configuration |
| notifications | 644 | ✓ | id (uuid) | In-app notifications |
| sms_campaigns | 0 | ✓ | id (uuid) | SMS marketing campaigns |
| sms_campaign_recipients | 0 | ✓ | id (uuid) | Campaign recipient list |
| sms_templates | 0 | ✓ | id (uuid) | Reusable SMS templates |
| sms_logs | 4 | ✓ | id (uuid) | SMS sending history |
| sms_log | 0 | ✓ | id (uuid) | SMS log per visit |

---

## Installed Extensions

| Extension | Version | Schema | Purpose |
|-----------|---------|--------|---------|
| http | 1.6 | extensions | HTTP client for external API calls |
| pgcrypto | 1.3 | extensions | Cryptographic functions |
| pg_stat_statements | 1.11 | extensions | Query statistics |
| supabase_vault | 0.3.1 | vault | Secrets management |
| pg_net | 0.19.5 | extensions | Async HTTP requests |
| pg_graphql | 1.5.11 | graphql | GraphQL support |
| uuid-ossp | 1.1 | extensions | UUID generation |
| plpgsql | 1.0 | pg_catalog | Stored procedures |

---

## Complete Table Definitions

### 1. users
**Purpose:** System user accounts (admin, doctor, lab_tech)

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role DEFAULT 'doctor',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Custom Type
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'lab_tech');

-- RLS Enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to auth.users (Supabase Auth)
- Referenced by visits (doctor_id)
- Referenced by stock_movements (performed_by)
- Referenced by sms_campaigns (created_by)

---

### 2. patients
**Purpose:** Patient demographic information

```sql
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text DEFAULT '',
  gender text DEFAULT '',
  dob date,
  age integer,
  age_unit text DEFAULT 'years' CHECK (age_unit IN ('years', 'months')),
  marital_status text CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed', 'Separated')),
  address text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Referenced by visits (patient_id)

---

### 3. visits
**Purpose:** Patient visit records with billing information

```sql
CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id),
  doctor_id uuid REFERENCES users(id),
  notes text DEFAULT '',
  diagnosis text DEFAULT '',
  subtotal numeric DEFAULT 0,
  total numeric DEFAULT 0,
  paid numeric DEFAULT 0,
  balance numeric DEFAULT 0 CHECK (balance >= 0),
  payment_status payment_status DEFAULT 'unpaid',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Custom Type
CREATE TYPE payment_status AS ENUM ('paid', 'unpaid', 'partial');

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to patients (patient_id)
- Foreign key to users (doctor_id)
- Referenced by visit_tests, visit_medicines, sms_log

---

### 4. visit_tests
**Purpose:** Laboratory tests ordered during a visit

```sql
CREATE TABLE visit_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id),
  test_id uuid REFERENCES tests(id),
  price numeric NOT NULL,
  qty integer DEFAULT 1 CHECK (qty > 0),
  result_text text DEFAULT '',
  result text DEFAULT '',
  results_status text DEFAULT 'pending' CHECK (results_status IN ('pending', 'in_progress', 'completed')),
  results_entered_at timestamptz,
  results_entered_by uuid REFERENCES auth.users(id),
  technician_notes text,
  sent_to_doctor_at timestamptz,
  sent_to_doctor_by uuid REFERENCES auth.users(id),
  doctor_viewed_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE visit_tests ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to visits (visit_id)
- Foreign key to tests (test_id)
- Referenced by visit_test_results
- Referenced by notifications

---

### 5. visit_test_results
**Purpose:** Individual parameter results for each test

```sql
CREATE TABLE visit_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_test_id uuid REFERENCES visit_tests(id),
  test_parameter_id uuid REFERENCES test_parameters(id),
  value text NOT NULL,
  is_abnormal boolean DEFAULT false,
  abnormality_type text CHECK (abnormality_type IN ('L', 'H')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE visit_test_results ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to visit_tests (visit_test_id)
- Foreign key to test_parameters (test_parameter_id)

---

### 6. visit_medicines
**Purpose:** Medicines dispensed during a visit

```sql
CREATE TABLE visit_medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id),
  item_id uuid REFERENCES inventory_items(id),
  price numeric NOT NULL,
  qty numeric CHECK (qty > 0),
  unit text DEFAULT 'pc',
  instructions text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE visit_medicines ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to visits (visit_id)
- Foreign key to inventory_items (item_id)

---

### 7. tests
**Purpose:** Master list of available laboratory tests

```sql
CREATE TABLE tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  price numeric CHECK (price >= 0),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Referenced by visit_tests
- Referenced by test_consumables
- Referenced by test_parameters

---

### 8. test_parameters
**Purpose:** Configurable parameters for each laboratory test

```sql
CREATE TABLE test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES tests(id),
  parameter_name text NOT NULL,
  parameter_type text DEFAULT 'numeric' CHECK (parameter_type IN ('numeric', 'qualitative', 'boolean')),
  applicable_to_male boolean DEFAULT false,
  applicable_to_female boolean DEFAULT false,
  applicable_to_child boolean DEFAULT false,
  ref_range_from numeric,
  ref_range_to numeric,
  unit text,
  allowed_values jsonb, -- For qualitative/boolean types
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE test_parameters ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to tests (test_id)
- Referenced by visit_test_results
- Referenced by test_parameter_rules

---

### 9. test_consumables
**Purpose:** Bill of materials - items consumed per test

```sql
CREATE TABLE test_consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid REFERENCES tests(id),
  item_id uuid REFERENCES inventory_items(id),
  quantity numeric CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE test_consumables ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to tests (test_id)
- Foreign key to inventory_items (item_id)

---

### 10. test_parameter_rules
**Purpose:** Automated interpretation rules for test results

```sql
CREATE TABLE test_parameter_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_id uuid REFERENCES test_parameters(id),
  rule_type text CHECK (rule_type IN ('numeric_comparison', 'text_match', 'range', 'presence')),
  operator text CHECK (operator IN ('>', '<', '>=', '<=', '=', '!=', 'between', 'in', 'contains', 'exists', 'not_exists')),
  value text NOT NULL,
  result_status text CHECK (result_status IN ('normal', 'abnormal', 'critical')),
  priority integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE test_parameter_rules ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to test_parameters (parameter_id)

---

### 11. inventory_items
**Purpose:** Inventory master data (medicines & lab consumables)

```sql
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  type item_type NOT NULL,
  unit text NOT NULL,
  qty_on_hand numeric DEFAULT 0 CHECK (qty_on_hand >= 0),
  reorder_level numeric DEFAULT 0,
  cost_price numeric DEFAULT 0,
  sell_price numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Custom Type
CREATE TYPE item_type AS ENUM ('medicine', 'lab_consumable');

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Referenced by stock_movements
- Referenced by visit_medicines
- Referenced by test_consumables
- Referenced by purchase_items

---

### 12. stock_movements
**Purpose:** Inventory transaction audit trail

```sql
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id),
  movement_type movement_type NOT NULL,
  qty numeric NOT NULL,
  reason text DEFAULT '',
  reference_type text DEFAULT '',
  reference_id uuid,
  performed_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Custom Type
CREATE TYPE movement_type AS ENUM ('IN', 'OUT', 'ADJUST');

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to inventory_items (item_id)
- Foreign key to users (performed_by)

---

### 13. purchases
**Purpose:** Purchase order header

```sql
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date timestamptz DEFAULT now(),
  total_amount numeric CHECK (total_amount >= 0),
  supplier text DEFAULT '',
  notes text DEFAULT '',
  status text DEFAULT 'completed' CHECK (status IN ('draft', 'completed')),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to auth.users (created_by)
- Referenced by purchase_items

---

### 14. purchase_items
**Purpose:** Purchase order line items

```sql
CREATE TABLE purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES purchases(id),
  item_id uuid REFERENCES inventory_items(id),
  quantity numeric CHECK (quantity > 0),
  unit text NOT NULL,
  unit_price numeric CHECK (unit_price >= 0),
  total_amount numeric CHECK (total_amount >= 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to purchases (purchase_id)
- Foreign key to inventory_items (item_id)

---

### 15. units
**Purpose:** Master list of measurement units

```sql
CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;
```

---

### 16. facility_settings
**Purpose:** Clinic information and SMS configuration

```sql
CREATE TABLE facility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text DEFAULT 'Remtullah Medical Laboratory',
  address text DEFAULT '',
  phone text DEFAULT '',
  footer_note text DEFAULT 'Thank you for your visit',
  sms_enabled boolean DEFAULT false,
  sms_api_key text DEFAULT '',
  sms_secret_key text DEFAULT '',
  sms_source_addr text DEFAULT '',
  sms_template text DEFAULT 'Habari [PATIENT_NAME], majibu ya kipimo yako tayari. Tafadhali fika maabara.',
  welcome_sms_enabled boolean DEFAULT false,
  welcome_sms_template text DEFAULT 'Karibu [PATIENT_NAME]! Tunakushukuru kwa kuchagua [CLINIC_NAME]. Tunaomba afya njema.',
  supabase_url text DEFAULT 'https://rjjxheikbfzrmdvjfrva.supabase.co',
  supabase_anon_key text,
  service_role_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;
```

---

### 17. settings
**Purpose:** Key-value store for system configuration

```sql
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  signature_image text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
```

---

### 18. notifications
**Purpose:** In-app notification system

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text DEFAULT 'lab_result_ready',
  title text NOT NULL,
  message text NOT NULL,
  related_visit_test_id uuid REFERENCES visit_tests(id),
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to auth.users (user_id)
- Foreign key to visit_tests (related_visit_test_id)

---

### 19. sms_campaigns
**Purpose:** SMS marketing campaign management

```sql
CREATE TABLE sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_audience text CHECK (target_audience IN ('all_patients', 'selected_patients', 'all_users', 'custom')),
  recipient_count integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to users (created_by)
- Referenced by sms_campaign_recipients

---

### 20. sms_campaign_recipients
**Purpose:** Recipient list for SMS campaigns

```sql
CREATE TABLE sms_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES sms_campaigns(id),
  recipient_type text CHECK (recipient_type IN ('patient', 'user', 'custom')),
  recipient_id uuid,
  phone_number text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sms_campaign_recipients ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to sms_campaigns (campaign_id)

---

### 21. sms_templates
**Purpose:** Reusable SMS message templates

```sql
CREATE TABLE sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text CHECK (category IN ('marketing', 'notification', 'announcement', 'general')),
  message_template text NOT NULL,
  placeholders jsonb DEFAULT '[]',
  usage_count integer DEFAULT 0,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to users (created_by)

---

### 22. sms_logs
**Purpose:** SMS sending history and audit trail

```sql
CREATE TABLE sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text CHECK (recipient_type IN ('patient', 'user', 'custom')),
  recipient_id uuid,
  phone_number text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  sent_by uuid REFERENCES users(id),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to users (sent_by)

---

### 23. sms_log
**Purpose:** SMS log per visit (automated notifications)

```sql
CREATE TABLE sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id),
  phone_number text NOT NULL,
  message text NOT NULL,
  sms_type text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
```

**Key Relationships:**
- Foreign key to visits (visit_id)

---

## Migration History

### All Applied Migrations (71 total)

1. `20260208155308_create_remtullah_medical_schema.sql` - Initial schema
2. `20260208160218_seed_demo_data.sql` - Demo data
3. `20260208163820_fix_recursive_rls_policies.sql` - RLS fixes
4. `20260209142953_add_settings_table.sql` - Settings table
5. `20260209144113_create_purchases_table.sql` - Purchases
6. `20260209144541_create_test_consumables_bom.sql` - Test BOM
7. `20260209145606_restrict_edit_delete_to_admin.sql` - Admin restrictions
8. `20260209151427_create_test_parameters_table.sql` - Test parameters
9. `20260209163933_fix_database_security_and_performance.sql` - Security fixes
10. `20260209163954_fix_test_parameters_rls_policies.sql` - RLS policies
11. `20260209183653_restructure_purchases_with_items.sql` - Purchase restructure
12. `20260209190540_add_parameter_types_and_allowed_values.sql` - Parameter types
13. `20260209190837_seed_urinalysis_test_with_parameters.sql` - Urinalysis seed
14. `20260210094035_add_lab_tech_role.sql` - Lab tech role
15. `20260210094052_create_test_results_system.sql` - Test results
16. `20260210110235_add_marital_status_to_patients.sql` - Marital status
17. `20260210111519_add_unit_to_visit_medicines.sql` - Medicine units
18. `20260210175021_add_notifications_system.sql` - Notifications
19. `20260210181027_add_lab_tech_access_to_visit_tests.sql` - Lab tech access
20. `20260211140244_remove_discount_column.sql` - Remove discount
21. `20260211142336_allow_lab_tech_read_doctor_info.sql` - Lab tech permissions
22. `20260211143510_fix_users_delete_policy_recursion.sql` - Delete policy fix
23. `20260211143540_fix_lab_tech_policy_recursion.sql` - Lab tech policy fix
24. `20260211174254_allow_doctors_to_view_other_doctors.sql` - Doctor visibility
25. `20260211174708_fix_doctors_view_policy_recursion.sql` - View policy fix
26. `20260211192300_add_unit_to_purchase_items.sql` - Purchase item units
27. `20260211192552_add_draft_and_timestamp_to_purchases.sql` - Purchase status
28. `20260211194207_add_clinic_info_to_settings.sql` - Clinic settings
29. `20260212094153_create_units_table.sql` - Units table
30. `20260212140420_fix_users_update_policy.sql` - User update policy
31. `20260214103453_allow_doctors_to_update_inventory.sql` - Doctor inventory
32. `20260214111031_add_sort_order_to_test_parameters.sql` - Parameter sorting
33. `20260214135344_add_inventory_deduction_triggers.sql` - Inventory triggers
34. `20260214140410_add_age_unit_to_patients.sql` - Age units
35. `20260214151311_fix_trigger_ambiguous_doctor_id.sql` - Trigger fix
36. `20260214153449_add_abnormality_type_to_results.sql` - Abnormality tracking
37. `20260215085525_fix_users_update_policy_use_helper.sql` - Policy helper
38. `20260215091940_create_test_parameter_interpretation_rules.sql` - Interpretation rules
39. `20260215092235_seed_urine_microscopy_interpretation_rules.sql` - Microscopy rules
40. `20260218115450_allow_viewing_lab_tech_names.sql` - Lab tech visibility
41. `20260218120215_add_balance_constraint.sql` - Balance constraint
42. `20260218121038_add_signature_to_settings.sql` - Signature field
43. `20260218135440_allow_doctors_view_admins.sql` - Admin visibility
44. `20260219064021_allow_admins_to_delete_purchases.sql` - Purchase deletion
45. `20260219070052_allow_admins_to_delete_purchase_items.sql` - Item deletion
46. `20260219070621_create_delete_purchase_function.sql` - Delete function
47. `20260219070843_fix_delete_purchase_inventory_reversal.sql` - Inventory reversal
48. `20260221060001_add_user_self_update_policy.sql` - Self update policy
49. `20260224190740_add_sms_settings.sql` - SMS settings
50. `20260224190849_add_sms_trigger_on_test_completion.sql` - SMS trigger
51. `20260224190918_fix_sms_trigger_use_env_from_table.sql` - SMS env fix
52. `20260224192644_add_welcome_sms_settings.sql` - Welcome SMS
53. `20260224192716_add_welcome_sms_trigger.sql` - Welcome trigger
54. `20260224195232_fix_welcome_sms_trigger_use_http_extension.sql` - HTTP extension
55. `20260224195247_enable_http_extension.sql` - Enable HTTP
56. `20260224195321_fix_welcome_sms_trigger_use_name_column.sql` - Name column fix
57. `20260225060509_fix_sms_trigger_error_handling.sql` - Error handling
58. `20260225065731_fix_welcome_sms_use_pg_net.sql` - pg_net usage
59. `20260225070418_fix_welcome_sms_use_correct_patient_columns.sql` - Column fix
60. `20260225070430_fix_welcome_sms_phone_variable.sql` - Phone variable
61. `20260225073322_add_sms_triggers_for_lab_and_patients.sql` - SMS triggers
62. `20260225080904_fix_sms_triggers_parameters.sql` - Trigger parameters
63. `20260225082436_create_communication_tables.sql` - Communication tables
64. `20260225101859_fix_sms_trigger_use_beem_credentials.sql` - Beem credentials
65. `20260225104922_fix_send_to_doctor_sms_trigger.sql` - Doctor SMS
66. `20260225105915_fix_sms_only_on_send_to_doctor.sql` - SMS condition
67. `20260225110119_prevent_duplicate_sms_per_visit.sql` - Duplicate prevention
68. `20260225110132_add_sms_log_indexes_and_views.sql` - SMS indexes
69. `20260225114412_add_sms_sent_at_to_visit_tests.sql` - SMS timestamp
70. (Latest optimization) - Settings page performance
71. (Latest optimization) - Parallel query loading

---

## Database Security

### Row Level Security (RLS)
- **All tables have RLS enabled**
- **Policies enforce role-based access:**
  - Admin: Full access to all data
  - Doctor: Access to their own visits and patients
  - Lab Tech: Read access to tests, write access to results

### Authentication
- Uses Supabase Auth (`auth.users` table)
- Email/password authentication
- JWT-based session management

### Data Integrity
- Foreign key constraints throughout
- Check constraints on numeric values
- Unique constraints on business keys
- NOT NULL constraints on required fields

---

## Important Notes

1. **Backup this file** - Store securely outside the application
2. **Migration files** - All located in `supabase/migrations/`
3. **Restore process** - Apply migrations in order from oldest to newest
4. **Data export** - Use Supabase Dashboard or `pg_dump` for full backup
5. **Environment variables** - Stored in `.env` file (not in backup)

---

## Emergency Restore Procedure

If you need to restore the database:

1. **Create new Supabase project**
2. **Apply migrations in order:**
   ```bash
   supabase db reset
   ```
3. **Verify schema:**
   ```bash
   supabase db diff
   ```
4. **Import data backup** (if available)
5. **Test authentication and RLS policies**

---

**End of Database Backup Documentation**
