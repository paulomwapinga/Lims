/*
  # Create function to get visit test counts
  
  ## Purpose
  This function aggregates test counts by visit_id to avoid the 1000 row limit
  when fetching individual visit_tests rows.
  
  ## Returns
  For each visit_id that has tests:
  - visit_id
  - total: total number of tests
  - pending: tests with results_status = 'pending'
  - in_progress: tests with results_status = 'in_progress'
  - completed: tests with results_status = 'completed'
*/

CREATE OR REPLACE FUNCTION get_visit_test_counts()
RETURNS TABLE (
  visit_id uuid,
  total bigint,
  pending bigint,
  in_progress bigint,
  completed bigint
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    visit_id,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE results_status = 'pending') as pending,
    COUNT(*) FILTER (WHERE results_status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE results_status = 'completed') as completed
  FROM visit_tests
  GROUP BY visit_id;
$$;