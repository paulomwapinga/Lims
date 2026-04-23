/*
  # Add Lab Results Search RPC Functions

  ## Purpose
  Create server-side pagination and search functions for the Lab Results page.
  The current client-side approach is capped by Supabase's 1,000 row API limit,
  causing only ~994 records to appear despite 2,216+ existing records.

  ## New Functions

  ### 1. `get_lab_results_paginated`
  Returns a paginated, filtered page of visit_tests with patient and test info.
  Parameters:
  - `p_search` (text): Search string matched against patient name or test name
  - `p_status` (text): Filter by results_status ('pending', 'in_progress', 'completed', or 'all')
  - `p_limit` (int): Number of rows per page
  - `p_offset` (int): Row offset for pagination

  ### 2. `get_lab_results_count`
  Returns the total count matching the same filters (for pagination display).
  Parameters:
  - `p_search` (text)
  - `p_status` (text)

  ### 3. `get_lab_results_status_counts`
  Returns counts grouped by results_status for the stat cards (always all records).
*/

CREATE OR REPLACE FUNCTION get_lab_results_paginated(
  p_search text DEFAULT '',
  p_status text DEFAULT 'all',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  visit_id uuid,
  test_id uuid,
  results_status text,
  results_entered_at timestamptz,
  technician_notes text,
  sent_to_doctor_at timestamptz,
  created_at timestamptz,
  patient_id uuid,
  patient_name text,
  visit_created_at timestamptz,
  doctor_id uuid,
  test_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vt.id,
    vt.visit_id,
    vt.test_id,
    vt.results_status,
    vt.results_entered_at,
    vt.technician_notes,
    vt.sent_to_doctor_at,
    vt.created_at,
    p.id AS patient_id,
    p.name AS patient_name,
    v.created_at AS visit_created_at,
    v.doctor_id,
    t.name AS test_name
  FROM visit_tests vt
  JOIN visits v ON v.id = vt.visit_id
  JOIN patients p ON p.id = v.patient_id
  JOIN tests t ON t.id = vt.test_id
  WHERE
    (p_status = 'all' OR vt.results_status = p_status)
    AND (
      p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR t.name ILIKE '%' || p_search || '%'
      OR vt.visit_id::text ILIKE '%' || p_search || '%'
      OR p.id::text ILIKE '%' || p_search || '%'
    )
  ORDER BY vt.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_lab_results_count(
  p_search text DEFAULT '',
  p_status text DEFAULT 'all'
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM visit_tests vt
  JOIN visits v ON v.id = vt.visit_id
  JOIN patients p ON p.id = v.patient_id
  JOIN tests t ON t.id = vt.test_id
  WHERE
    (p_status = 'all' OR vt.results_status = p_status)
    AND (
      p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR t.name ILIKE '%' || p_search || '%'
      OR vt.visit_id::text ILIKE '%' || p_search || '%'
      OR p.id::text ILIKE '%' || p_search || '%'
    );
$$;

CREATE OR REPLACE FUNCTION get_lab_results_status_counts()
RETURNS TABLE (results_status text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT results_status, COUNT(*) AS count
  FROM visit_tests
  GROUP BY results_status;
$$;
