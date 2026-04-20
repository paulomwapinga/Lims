/*
  # Add search_visit_tests function

  Creates a database function that searches visit_tests by patient name or test name,
  bypassing the PostgREST default row limit of 1000. This enables proper full-text
  search across all records regardless of dataset size.

  1. New Functions
    - `search_visit_tests(search_term text, status_filter text, page_offset int, page_limit int)`
      Returns visit_tests rows matching the search term with proper pagination.
*/

CREATE OR REPLACE FUNCTION search_visit_tests(
  search_term text DEFAULT '',
  status_filter text DEFAULT 'all',
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  visit_id uuid,
  test_id uuid,
  results_status text,
  results_entered_at timestamptz,
  technician_notes text,
  sent_to_doctor_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz,
  visit_created_at timestamptz,
  visit_doctor_id uuid,
  visit_notes text,
  visit_diagnosis text,
  patient_id uuid,
  patient_name text,
  patient_phone text,
  test_name text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vt.id,
    vt.visit_id,
    vt.test_id,
    vt.results_status::text,
    vt.results_entered_at,
    vt.technician_notes,
    vt.sent_to_doctor_at,
    vt.sms_sent_at,
    vt.created_at,
    v.created_at AS visit_created_at,
    v.doctor_id AS visit_doctor_id,
    v.notes AS visit_notes,
    v.diagnosis AS visit_diagnosis,
    p.id AS patient_id,
    p.name AS patient_name,
    p.phone AS patient_phone,
    t.name AS test_name,
    COUNT(*) OVER() AS total_count
  FROM visit_tests vt
  JOIN visits v ON vt.visit_id = v.id
  JOIN patients p ON v.patient_id = p.id
  JOIN tests t ON vt.test_id = t.id
  WHERE
    (search_term = '' OR p.name ILIKE '%' || search_term || '%' OR t.name ILIKE '%' || search_term || '%')
    AND (status_filter = 'all' OR vt.results_status::text = status_filter)
  ORDER BY vt.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;
