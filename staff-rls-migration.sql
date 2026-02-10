-- SQL to fix RLS Policies for the 'users' table 
-- allow doctors to see their staff and vice versa within the same clinic

-- First, drop restrictive policies
DROP POLICY IF EXISTS "Users can view their own user record" ON users;

-- Allow all authenticated users to view other users in the SAME clinic
CREATE POLICY "Users within same clinic can view each other"
ON users FOR SELECT
TO authenticated
USING (
    clinic_id IN (
        SELECT clinic_id FROM users WHERE id = auth.uid()
    )
);

-- Note: We use Admin SDK (Service Role) for INSERT/DELETE of staff, 
-- but listing needs this SELECT policy to work for the doctor in the frontend.
