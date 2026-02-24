/*
  # Enable HTTP Extension

  1. Changes
    - Enable pg_http extension for making HTTP requests from database triggers
  
  2. Security
    - Extension is required for SMS notifications via edge functions
*/

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
