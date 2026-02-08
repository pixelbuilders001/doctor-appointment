-- Fix for RLS Policy - Allow clinic creation during signup
-- Run this in Supabase SQL Editor to fix the "new row violates row-level security policy" error

-- Drop the restrictive clinic insert policy
DROP POLICY IF EXISTS "Users can insert clinics" ON clinics;

-- Create a more permissive policy that allows authenticated users to create clinics
CREATE POLICY "Authenticated users can insert clinics"
    ON clinics FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Also update the select policy to allow users to see clinics they're creating
DROP POLICY IF EXISTS "Users can view their own clinic" ON clinics;

CREATE POLICY "Users can view their own clinic"
    ON clinics FOR SELECT
    TO authenticated
    USING (
        id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
        OR 
        -- Allow viewing during creation (before user record exists)
        NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
    );
