/*
  # Seed Urine Microscopy Interpretation Rules

  1. Purpose
    - Add interpretation rules for urine microscopy parameters
    - Implement automated abnormality detection based on standard reference ranges

  2. Rules Added
    - WBC (White Blood Cells): >5/HPF = Abnormal
    - RBC (Red Blood Cells): >5/HPF = Abnormal
    - Epithelial Cells: >5/HPF = Abnormal
    - Bacteria: Presence-based detection (Seen/Present/Few/Moderate/Many = Abnormal)
    - Casts: Presence-based detection (Seen/Present/Few/Moderate/Many = Abnormal)
    - Crystals: Presence-based detection

  3. Notes
    - These rules follow standard clinical laboratory guidelines
    - Rules can be modified through the Settings interface
    - Priority is set to ensure proper evaluation order
*/

DO $$
DECLARE
  v_urinalysis_id uuid;
  v_wbc_param_id uuid;
  v_rbc_param_id uuid;
  v_epithelial_param_id uuid;
  v_bacteria_param_id uuid;
  v_casts_param_id uuid;
  v_crystals_param_id uuid;
BEGIN
  SELECT id INTO v_urinalysis_id FROM tests WHERE name = 'Urinalysis' LIMIT 1;
  
  IF v_urinalysis_id IS NOT NULL THEN
    SELECT id INTO v_wbc_param_id FROM test_parameters 
    WHERE test_id = v_urinalysis_id AND parameter_name ILIKE '%WBC%' OR parameter_name ILIKE '%White%Blood%Cell%' 
    LIMIT 1;
    
    SELECT id INTO v_rbc_param_id FROM test_parameters 
    WHERE test_id = v_urinalysis_id AND parameter_name ILIKE '%RBC%' OR parameter_name ILIKE '%Red%Blood%Cell%' 
    LIMIT 1;
    
    SELECT id INTO v_epithelial_param_id FROM test_parameters 
    WHERE test_id = v_urinalysis_id AND parameter_name ILIKE '%Epithelial%' 
    LIMIT 1;
    
    SELECT id INTO v_bacteria_param_id FROM test_parameters 
    WHERE test_id = v_urinalysis_id AND parameter_name ILIKE '%Bacteria%' 
    LIMIT 1;
    
    SELECT id INTO v_casts_param_id FROM test_parameters 
    WHERE test_id = v_urinalysis_id AND parameter_name ILIKE '%Cast%' 
    LIMIT 1;
    
    SELECT id INTO v_crystals_param_id FROM test_parameters 
    WHERE test_id = v_urinalysis_id AND parameter_name ILIKE '%Crystal%' 
    LIMIT 1;

    IF v_wbc_param_id IS NOT NULL THEN
      INSERT INTO test_parameter_rules (parameter_id, rule_type, operator, value, result_status, priority, active)
      VALUES (v_wbc_param_id, 'numeric_comparison', '>', '5', 'abnormal', 10, true)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_rbc_param_id IS NOT NULL THEN
      INSERT INTO test_parameter_rules (parameter_id, rule_type, operator, value, result_status, priority, active)
      VALUES (v_rbc_param_id, 'numeric_comparison', '>', '5', 'abnormal', 10, true)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_epithelial_param_id IS NOT NULL THEN
      INSERT INTO test_parameter_rules (parameter_id, rule_type, operator, value, result_status, priority, active)
      VALUES (v_epithelial_param_id, 'numeric_comparison', '>', '5', 'abnormal', 10, true)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_bacteria_param_id IS NOT NULL THEN
      INSERT INTO test_parameter_rules (parameter_id, rule_type, operator, value, result_status, priority, active)
      VALUES 
        (v_bacteria_param_id, 'text_match', 'in', 'few|seen|present|moderate|many|numerous|+|++|+++|++++', 'abnormal', 10, true),
        (v_bacteria_param_id, 'text_match', 'in', 'nil|none|negative|-', 'normal', 20, true)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_casts_param_id IS NOT NULL THEN
      INSERT INTO test_parameter_rules (parameter_id, rule_type, operator, value, result_status, priority, active)
      VALUES 
        (v_casts_param_id, 'text_match', 'in', 'few|seen|present|moderate|many|numerous|+|++|+++|++++', 'abnormal', 10, true),
        (v_casts_param_id, 'text_match', 'in', 'nil|none|negative|-', 'normal', 20, true)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_crystals_param_id IS NOT NULL THEN
      INSERT INTO test_parameter_rules (parameter_id, rule_type, operator, value, result_status, priority, active)
      VALUES 
        (v_crystals_param_id, 'text_match', 'in', 'few|seen|present|moderate|many|numerous|+|++|+++|++++', 'abnormal', 10, true),
        (v_crystals_param_id, 'text_match', 'in', 'nil|none|negative|-', 'normal', 20, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;