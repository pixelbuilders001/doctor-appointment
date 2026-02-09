-- Migration for Public Doctor Profile & Booking
-- Run this in Supabase SQL Editor

-- 1. Add new columns to clinics table
ALTER TABLE clinics 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS specialization VARCHAR(255),
ADD COLUMN IF NOT EXISTS maps_link TEXT;

-- 2. Add booking_source to appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS booking_source VARCHAR(50) DEFAULT 'manual'; -- manual (dashboard), online (public link)

-- 3. Create index for faster slug lookup
CREATE INDEX IF NOT EXISTS idx_clinics_slug ON clinics(slug);

-- 4. RLS Policies for Public Access
-- Allow public read access to clinics (for public profile)
DROP POLICY IF EXISTS "Public can view clinics" ON clinics;
CREATE POLICY "Public can view clinics"
    ON clinics FOR SELECT
    TO anon
    USING (true);

-- Allow public read access to clinic_settings (for slots/timings)
DROP POLICY IF EXISTS "Public can view clinic settings" ON clinic_settings;
CREATE POLICY "Public can view clinic settings"
    ON clinic_settings FOR SELECT
    TO anon
    USING (true);

-- Allow public to INSERT appointments (booking flow)
DROP POLICY IF EXISTS "Public can insert appointments" ON appointments;
CREATE POLICY "Public can insert appointments"
    ON appointments FOR INSERT
    TO anon
    WITH CHECK (booking_source = 'online');

-- 5. Helper function to find clinic by slug (optional, but good for validation)
CREATE OR REPLACE FUNCTION get_clinic_by_slug(p_slug TEXT)
RETURNS SETOF clinics AS $$
BEGIN
    RETURN QUERY SELECT * FROM clinics WHERE slug = p_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
