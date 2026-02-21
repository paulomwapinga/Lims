/*
  # Allow Users to Update Their Own Profile

  ## Changes
  - Adds RLS policy to allow authenticated users to update their own profile information
  - Users can only update their own record (where auth.uid() = id)
  - This fixes the "invalid or expired token" error when users try to update their information

  ## Security
  - Policy is restrictive: users can ONLY update their own data
  - Auth check ensures the user is authenticated
  - ID matching prevents users from updating other users' data
*/

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
