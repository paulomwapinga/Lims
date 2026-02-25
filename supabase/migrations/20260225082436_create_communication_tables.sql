/*
  # Create SMS Communication System

  1. New Tables
    - `sms_logs`
      - `id` (uuid, primary key)
      - `recipient_type` (text) - patient/user/custom
      - `recipient_id` (uuid, nullable) - references patients or users
      - `phone_number` (text) - recipient phone number
      - `message` (text) - SMS message content
      - `status` (text) - pending/sent/failed
      - `error_message` (text, nullable) - error details if failed
      - `sent_by` (uuid) - references users who sent the SMS
      - `sent_at` (timestamptz, nullable) - when SMS was actually sent
      - `created_at` (timestamptz) - when record was created

    - `sms_templates`
      - `id` (uuid, primary key)
      - `name` (text) - template name
      - `category` (text) - marketing/notification/announcement
      - `message_template` (text) - template content with placeholders
      - `placeholders` (jsonb) - available placeholders
      - `usage_count` (integer) - how many times used
      - `created_by` (uuid) - references users
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sms_campaigns`
      - `id` (uuid, primary key)
      - `name` (text) - campaign name
      - `description` (text, nullable)
      - `target_audience` (text) - all_patients/selected_patients/all_users/custom
      - `recipient_count` (integer) - total recipients
      - `sent_count` (integer) - successfully sent
      - `failed_count` (integer) - failed sends
      - `status` (text) - draft/scheduled/sending/completed/failed
      - `scheduled_at` (timestamptz, nullable)
      - `completed_at` (timestamptz, nullable)
      - `created_by` (uuid) - references users
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sms_campaign_recipients`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid) - references sms_campaigns
      - `recipient_type` (text) - patient/user/custom
      - `recipient_id` (uuid, nullable)
      - `phone_number` (text)
      - `status` (text) - pending/sent/failed
      - `sent_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Only admins can access communication features
    - Add policies for admins to manage SMS logs, templates, and campaigns

  3. Indexes
    - Add indexes for quick filtering and searching
*/

-- Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text NOT NULL CHECK (recipient_type IN ('patient', 'user', 'custom')),
  recipient_id uuid,
  phone_number text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  sent_by uuid NOT NULL REFERENCES users(id),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create sms_templates table
CREATE TABLE IF NOT EXISTS sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('marketing', 'notification', 'announcement', 'general')),
  message_template text NOT NULL,
  placeholders jsonb DEFAULT '[]'::jsonb,
  usage_count integer DEFAULT 0,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sms_campaigns table
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_audience text NOT NULL CHECK (target_audience IN ('all_patients', 'selected_patients', 'all_users', 'custom')),
  recipient_count integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sms_campaign_recipients table
CREATE TABLE IF NOT EXISTS sms_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('patient', 'user', 'custom')),
  recipient_id uuid,
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient_type ON sms_logs(recipient_type);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_by ON sms_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_sms_templates_category ON sms_templates(category);
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON sms_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sms_campaign_recipients_campaign_id ON sms_campaign_recipients(campaign_id);

-- Enable Row Level Security
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_logs (admin only)
CREATE POLICY "Admins can view all SMS logs"
  ON sms_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert SMS logs"
  ON sms_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update SMS logs"
  ON sms_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for sms_templates (admin only)
CREATE POLICY "Admins can view all SMS templates"
  ON sms_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert SMS templates"
  ON sms_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update SMS templates"
  ON sms_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete SMS templates"
  ON sms_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for sms_campaigns (admin only)
CREATE POLICY "Admins can view all SMS campaigns"
  ON sms_campaigns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert SMS campaigns"
  ON sms_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update SMS campaigns"
  ON sms_campaigns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete SMS campaigns"
  ON sms_campaigns FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- RLS Policies for sms_campaign_recipients (admin only)
CREATE POLICY "Admins can view all SMS campaign recipients"
  ON sms_campaign_recipients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert SMS campaign recipients"
  ON sms_campaign_recipients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update SMS campaign recipients"
  ON sms_campaign_recipients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete SMS campaign recipients"
  ON sms_campaign_recipients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
