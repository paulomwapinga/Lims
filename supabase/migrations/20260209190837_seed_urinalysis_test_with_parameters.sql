/*
  # Seed Urinalysis Test with Example Parameters

  This migration creates a sample Urinalysis test with various parameter types
  to demonstrate the new parameter type functionality.

  1. New Test
    - Urinalysis (Complete) test with appropriate price

  2. Sample Parameters
    - Color (Qualitative): Pale Yellow, Yellow, Amber
    - Appearance (Qualitative): Clear, Slightly Turbid, Turbid
    - Protein (Qualitative): Negative, Trace, +, ++, +++
    - Glucose (Qualitative): Negative, +, ++, +++
    - Nitrite (Boolean): Positive, Negative
    - pH (Numeric): 4.5-8.0
    - Specific Gravity (Numeric): 1.005-1.030

  3. Important Notes
    - Only creates the test if it doesn't already exist
    - Parameters demonstrate all three types: numeric, qualitative, boolean
    - Applicable to all patient types (Male, Female, Child)
*/

-- Insert Urinalysis test if it doesn't exist
DO $$
DECLARE
  v_test_id uuid;
BEGIN
  -- Check if Urinalysis test already exists
  SELECT id INTO v_test_id FROM tests WHERE name = 'Urinalysis (Complete)';
  
  -- If test doesn't exist, create it
  IF v_test_id IS NULL THEN
    INSERT INTO tests (name, price, notes)
    VALUES ('Urinalysis (Complete)', 150.00, 'Complete urinalysis with microscopic examination')
    RETURNING id INTO v_test_id;
    
    -- Add qualitative parameters
    INSERT INTO test_parameters (
      test_id, parameter_name, parameter_type, allowed_values,
      applicable_to_male, applicable_to_female, applicable_to_child,
      unit, description
    ) VALUES
    -- Color (Qualitative)
    (
      v_test_id, 'Color', 'qualitative',
      '["Pale Yellow", "Yellow", "Amber", "Red", "Brown"]'::jsonb,
      true, true, true,
      NULL,
      'Visual color of urine sample'
    ),
    -- Appearance (Qualitative)
    (
      v_test_id, 'Appearance', 'qualitative',
      '["Clear", "Slightly Turbid", "Turbid", "Cloudy"]'::jsonb,
      true, true, true,
      NULL,
      'Clarity of urine sample'
    ),
    -- Protein (Qualitative)
    (
      v_test_id, 'Protein', 'qualitative',
      '["Negative", "Trace", "+", "++", "+++", "++++"]'::jsonb,
      true, true, true,
      'mg/dL',
      'Protein content in urine'
    ),
    -- Glucose (Qualitative)
    (
      v_test_id, 'Glucose', 'qualitative',
      '["Negative", "+", "++", "+++", "++++"]'::jsonb,
      true, true, true,
      'mg/dL',
      'Glucose content in urine'
    ),
    -- Ketones (Qualitative)
    (
      v_test_id, 'Ketones', 'qualitative',
      '["Negative", "Trace", "Small", "Moderate", "Large"]'::jsonb,
      true, true, true,
      'mg/dL',
      'Ketone bodies in urine'
    ),
    -- Blood (Qualitative)
    (
      v_test_id, 'Blood', 'qualitative',
      '["Negative", "Trace", "+", "++", "+++"]'::jsonb,
      true, true, true,
      NULL,
      'Blood presence in urine'
    ),
    -- Nitrite (Boolean)
    (
      v_test_id, 'Nitrite', 'boolean',
      '["Negative", "Positive"]'::jsonb,
      true, true, true,
      NULL,
      'Presence of nitrite (bacterial infection indicator)'
    ),
    -- Leukocyte Esterase (Boolean)
    (
      v_test_id, 'Leukocyte Esterase', 'boolean',
      '["Negative", "Positive"]'::jsonb,
      true, true, true,
      NULL,
      'Presence of white blood cells'
    );
    
    -- Add numeric parameters
    INSERT INTO test_parameters (
      test_id, parameter_name, parameter_type, allowed_values,
      applicable_to_male, applicable_to_female, applicable_to_child,
      ref_range_from, ref_range_to, unit, description
    ) VALUES
    -- pH (Numeric)
    (
      v_test_id, 'pH', 'numeric', NULL,
      true, true, true,
      4.5, 8.0, '',
      'Acidity or alkalinity of urine'
    ),
    -- Specific Gravity (Numeric)
    (
      v_test_id, 'Specific Gravity', 'numeric', NULL,
      true, true, true,
      1.005, 1.030, '',
      'Concentration of dissolved substances in urine'
    );
  END IF;
END $$;
