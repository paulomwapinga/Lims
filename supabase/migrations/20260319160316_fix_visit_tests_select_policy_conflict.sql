/*
  # Fix Visit Tests SELECT Policy Conflict

  ## Problem
  Two conflicting SELECT policies exist on visit_tests table:
  1. "Authenticated users can view visit tests" - allows all authenticated users (USING true)
  2. "Doctors can view completed tests for their visits" - restricts doctors to only their own visits
  
  This causes doctors to only see tests from their own visits when viewing Visit History,
  even though admins and lab techs can see all tests.

  ## Solution
  Remove the restrictive doctor-specific SELECT policy since the general authenticated
  users policy already allows all authenticated users (including doctors) to view all tests.

  ## Security Impact
  - Doctors will be able to see all visit tests (not just their own)
  - This is acceptable as they could already see this data through other views
  - Lab techs and admins already have this access
  - Visit History page needs this access to display test counts correctly
*/

-- Remove the restrictive doctor-specific SELECT policy
DROP POLICY IF EXISTS "Doctors can view completed tests for their visits" ON visit_tests;
