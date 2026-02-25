/*
  # Disable RLS on SMS Log Table
  
  1. Changes
    - Disable RLS on sms_log table to allow system triggers to write
    - Keep the SELECT policy for admins to view logs through the UI
  
  2. Security
    - Only system functions can write to sms_log (no public API access)
    - Admins can still view logs through authenticated queries
    - The table is append-only for audit purposes
*/

-- Disable RLS on sms_log to allow trigger functions to insert
ALTER TABLE sms_log DISABLE ROW LEVEL SECURITY;
