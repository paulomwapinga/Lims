/*
  # Add Delete Policy for SMS Logs

  1. Changes
    - Add DELETE policy for sms_logs table to allow admins to delete logs
    
  2. Security
    - Only admins can delete SMS logs
*/

CREATE POLICY "Admins can delete SMS logs"
  ON sms_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );