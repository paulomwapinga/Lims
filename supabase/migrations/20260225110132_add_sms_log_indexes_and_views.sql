/*
  # Add SMS Log Indexes and Monitoring

  1. Changes
    - Add indexes for better query performance
    - Create view for SMS monitoring

  2. Performance
    - Index on visit_id for fast lookups
    - Index on sent_at for time-based queries
*/

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_log_visit_id ON sms_log(visit_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_sent_at ON sms_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_type ON sms_log(sms_type);

-- Create a view for easy SMS monitoring (admins only)
CREATE OR REPLACE VIEW sms_activity AS
SELECT 
  sl.id,
  sl.visit_id,
  sl.phone_number,
  sl.message,
  sl.sent_at,
  sl.sms_type,
  p.name as patient_name,
  v.created_at as visit_date
FROM sms_log sl
JOIN visits v ON sl.visit_id = v.id
JOIN patients p ON v.patient_id = p.id
ORDER BY sl.sent_at DESC;

-- Grant access to authenticated users (RLS will control who can actually see data)
GRANT SELECT ON sms_activity TO authenticated;
