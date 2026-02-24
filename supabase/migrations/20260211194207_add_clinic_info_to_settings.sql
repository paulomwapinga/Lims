/*
  # Add Clinic Information Settings
  
  1. New Settings
    - `clinic_name` - Name of the clinic/laboratory
    - `clinic_address` - Physical address of the clinic
    - `clinic_phone` - Contact phone number
    - `clinic_email` - Contact email address
    - `clinic_logo_url` - URL to the clinic logo image
    - `clinic_website` - Clinic website URL
    
  2. Changes
    - Inserts default values for all new clinic settings
    - These settings can be updated by administrators through the Settings page
    
  3. Security
    - Uses existing RLS policies (all authenticated users can read, only admins can update)
*/

-- Insert default clinic information settings
INSERT INTO settings (key, value)
VALUES 
  ('clinic_name', 'Remtullah Medical Laboratory'),
  ('clinic_address', ''),
  ('clinic_phone', ''),
  ('clinic_email', ''),
  ('clinic_logo_url', '/20260201_200954.jpg'),
  ('clinic_website', '')
ON CONFLICT (key) DO NOTHING;
