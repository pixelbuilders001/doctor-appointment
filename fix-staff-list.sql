-- Run this in your Supabase SQL Editor to fix the "infinite recursion" error
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 1. Create a helper function to fetch clinic_id without recursion
-- SECURITY DEFINER bypasses RLS for this specific query
CREATE OR REPLACE FUNCTION get_my_clinic_id()
RETURNS uuid AS $$
  SELECT clinic_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Reset RLS policies for 'users' table
DROP POLICY IF EXISTS "Users within same clinic can view each other" ON users;
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can view members of their own clinic" ON users;
DROP POLICY IF EXISTS "Users can view their own record" ON users;

-- 3. Create the non-recursive policy
CREATE POLICY "Users within same clinic can view each other"
ON public.users FOR SELECT
TO authenticated
USING (
    clinic_id = get_my_clinic_id()
);

-- Note: Also ensure doctors can view their own record if the above isn't enough
CREATE POLICY "Users can view their own record"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() = id);
