/*
  # Add Server-Side Pagination RPCs for VisitHistory and TestResults

  ## Purpose
  Eliminate Supabase's 1,000-row API cap from VisitHistory and TestResults pages.
  Also eliminates the N+1 query pattern in VisitHistory (was making one extra
  query per visit to get test status counts).

  ## New Functions

  ### 1. `get_visit_history_paginated`
  Returns paginated visits with patient name, doctor name, and test status counts
  in a single query via aggregation. Supports search and payment_status filter.

  ### 2. `get_visit_history_count`
  Returns total count for the same filters (for pagination display).

  ### 3. `get_visit_history_totals`
  Returns financial totals (revenue, collected, balance) for the current filter set,
  used by the stat cards.

  ### 4. `get_doctor_test_results_paginated`
  Returns paginated visit_tests for a specific doctor. Filters by results_status
  and search term.

  ### 5. `get_doctor_test_results_count`
  Returns total count for the same doctor + filters.

  ### 6. `get_doctor_test_results_status_counts`
  Returns per-status counts and "new results" count for the doctor's stat cards.
*/

-- VisitHistory: paginated visits with test counts embedded
CREATE OR REPLACE FUNCTION get_visit_history_paginated(
  p_search text DEFAULT '',
  p_status text DEFAULT 'all',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  total numeric,
  payment_status text,
  paid numeric,
  balance numeric,
  diagnosis text,
  notes text,
  patient_name text,
  doctor_name text,
  tests_count bigint,
  pending_tests bigint,
  in_progress_tests bigint,
  completed_tests bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.created_at,
    v.total,
    v.payment_status::text,
    v.paid,
    v.balance,
    v.diagnosis,
    v.notes,
    p.name AS patient_name,
    u.name AS doctor_name,
    COUNT(vt.id) AS tests_count,
    COUNT(vt.id) FILTER (WHERE vt.results_status = 'pending') AS pending_tests,
    COUNT(vt.id) FILTER (WHERE vt.results_status = 'in_progress') AS in_progress_tests,
    COUNT(vt.id) FILTER (WHERE vt.results_status = 'completed') AS completed_tests
  FROM visits v
  JOIN patients p ON p.id = v.patient_id
  JOIN users u ON u.id = v.doctor_id
  LEFT JOIN visit_tests vt ON vt.visit_id = v.id
  WHERE
    (p_status = 'all' OR v.payment_status::text = p_status)
    AND (
      p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR u.name ILIKE '%' || p_search || '%'
      OR v.diagnosis ILIKE '%' || p_search || '%'
    )
  GROUP BY v.id, p.name, u.name
  ORDER BY v.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_visit_history_count(
  p_search text DEFAULT '',
  p_status text DEFAULT 'all'
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT v.id)
  FROM visits v
  JOIN patients p ON p.id = v.patient_id
  JOIN users u ON u.id = v.doctor_id
  WHERE
    (p_status = 'all' OR v.payment_status::text = p_status)
    AND (
      p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR u.name ILIKE '%' || p_search || '%'
      OR v.diagnosis ILIKE '%' || p_search || '%'
    );
$$;

CREATE OR REPLACE FUNCTION get_visit_history_totals(
  p_search text DEFAULT '',
  p_status text DEFAULT 'all'
)
RETURNS TABLE (total_revenue numeric, total_collected numeric, total_balance numeric, total_visits bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(v.total), 0) AS total_revenue,
    COALESCE(SUM(v.paid), 0) AS total_collected,
    COALESCE(SUM(v.balance), 0) AS total_balance,
    COUNT(v.id) AS total_visits
  FROM visits v
  JOIN patients p ON p.id = v.patient_id
  JOIN users u ON u.id = v.doctor_id
  WHERE
    (p_status = 'all' OR v.payment_status::text = p_status)
    AND (
      p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR u.name ILIKE '%' || p_search || '%'
      OR v.diagnosis ILIKE '%' || p_search || '%'
    );
$$;

-- TestResults: paginated visit_tests for a specific doctor
CREATE OR REPLACE FUNCTION get_doctor_test_results_paginated(
  p_doctor_id uuid,
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
  sent_to_doctor_at timestamptz,
  doctor_viewed_at timestamptz,
  created_at timestamptz,
  patient_id uuid,
  patient_name text,
  visit_created_at timestamptz,
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
    vt.sent_to_doctor_at,
    vt.doctor_viewed_at,
    vt.created_at,
    p.id AS patient_id,
    p.name AS patient_name,
    v.created_at AS visit_created_at,
    t.name AS test_name
  FROM visit_tests vt
  JOIN visits v ON v.id = vt.visit_id
  JOIN patients p ON p.id = v.patient_id
  JOIN tests t ON t.id = vt.test_id
  WHERE
    v.doctor_id = p_doctor_id
    AND (p_status = 'all' OR vt.results_status = p_status)
    AND (
      p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR t.name ILIKE '%' || p_search || '%'
      OR vt.visit_id::text ILIKE '%' || p_search || '%'
    )
  ORDER BY vt.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_doctor_test_results_count(
  p_doctor_id uuid,
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
    v.doctor_id = p_doctor_id
    AND (p_status = 'all' OR vt.results_status = p_status)
    AND (
      p_search = ''
      OR p.name ILIKE '%' || p_search || '%'
      OR t.name ILIKE '%' || p_search || '%'
      OR vt.visit_id::text ILIKE '%' || p_search || '%'
    );
$$;

CREATE OR REPLACE FUNCTION get_doctor_test_results_status_counts(p_doctor_id uuid)
RETURNS TABLE (results_status text, count bigint, new_results bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vt.results_status,
    COUNT(*) AS count,
    COUNT(*) FILTER (WHERE vt.sent_to_doctor_at IS NOT NULL AND vt.doctor_viewed_at IS NULL) AS new_results
  FROM visit_tests vt
  JOIN visits v ON v.id = vt.visit_id
  WHERE v.doctor_id = p_doctor_id
  GROUP BY vt.results_status;
$$;
