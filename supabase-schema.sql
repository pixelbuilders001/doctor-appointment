-- ClinicFlow Simplified Schema for Appointment Booking & Queue Management
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Clinics Table
CREATE TABLE IF NOT EXISTS clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15),
    address TEXT,
    consultation_fee INTEGER DEFAULT 500,
    slot_duration INTEGER DEFAULT 15, -- in minutes
    clinic_status VARCHAR(20) DEFAULT 'available', -- available, busy, closed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users Table (Doctors/Staff)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    mobile VARCHAR(15),
    role VARCHAR(20) DEFAULT 'doctor', -- doctor, staff
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Appointments Table (Simplified)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    
    -- Patient basic info (no separate patient table)
    patient_name VARCHAR(255) NOT NULL,
    patient_mobile VARCHAR(15) NOT NULL,
    patient_age INTEGER,
    patient_gender VARCHAR(10),
    
    -- Appointment details
    appointment_date DATE NOT NULL,
    appointment_time TIME,
    token_number INTEGER NOT NULL,
    appointment_type VARCHAR(20) DEFAULT 'scheduled', -- scheduled, walkin
    visit_reason TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'booked', -- booked, checked_in, in_consultation, completed, cancelled, no_show
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checked_in_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT unique_clinic_date_token UNIQUE (clinic_id, appointment_date, token_number)
);

-- 4. Clinic Settings Table
CREATE TABLE IF NOT EXISTS clinic_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,
    
    -- Timings
    morning_start TIME DEFAULT '09:00',
    morning_end TIME DEFAULT '13:00',
    evening_start TIME DEFAULT '17:00',
    evening_end TIME DEFAULT '21:00',
    
    -- WhatsApp settings
    whatsapp_enabled BOOLEAN DEFAULT true,
    send_confirmations BOOLEAN DEFAULT true,
    send_reminders BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON appointments(clinic_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_mobile ON appointments(patient_mobile);
CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);

-- Enable Row Level Security
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own clinic" ON clinics;
DROP POLICY IF EXISTS "Users can update their own clinic" ON clinics;
DROP POLICY IF EXISTS "Users can insert clinics" ON clinics;
DROP POLICY IF EXISTS "Authenticated users can insert clinics" ON clinics;
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can insert their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;
DROP POLICY IF EXISTS "Users can view appointments in their clinic" ON appointments;
DROP POLICY IF EXISTS "Users can create appointments in their clinic" ON appointments;
DROP POLICY IF EXISTS "Users can update appointments in their clinic" ON appointments;
DROP POLICY IF EXISTS "Users can delete appointments in their clinic" ON appointments;
DROP POLICY IF EXISTS "Users can view their clinic settings" ON clinic_settings;
DROP POLICY IF EXISTS "Users can update their clinic settings" ON clinic_settings;
DROP POLICY IF EXISTS "Users can insert clinic settings" ON clinic_settings;

-- RLS Policies for Users (FIXED - no circular reference)
CREATE POLICY "Users can view their own user record"
    ON users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own user record"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- RLS Policies for Clinics (FIXED - allow creation during signup)
CREATE POLICY "Authenticated users can insert clinics"
    ON clinics FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can view their own clinic"
    ON clinics FOR SELECT
    TO authenticated
    USING (
        id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
        OR 
        -- Allow viewing during creation (before user record exists)
        NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Users can update their own clinic"
    ON clinics FOR UPDATE
    TO authenticated
    USING (id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policies for Appointments
CREATE POLICY "Users can view appointments in their clinic"
    ON appointments FOR SELECT
    TO authenticated
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create appointments in their clinic"
    ON appointments FOR INSERT
    TO authenticated
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update appointments in their clinic"
    ON appointments FOR UPDATE
    TO authenticated
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete appointments in their clinic"
    ON appointments FOR DELETE
    TO authenticated
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policies for Clinic Settings
CREATE POLICY "Users can view their clinic settings"
    ON clinic_settings FOR SELECT
    TO authenticated
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their clinic settings"
    ON clinic_settings FOR UPDATE
    TO authenticated
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert clinic settings"
    ON clinic_settings FOR INSERT
    TO authenticated
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- Function to auto-generate token numbers
CREATE OR REPLACE FUNCTION get_next_token_number(p_clinic_id UUID, p_date DATE)
RETURNS INTEGER AS $$
DECLARE
    next_token INTEGER;
BEGIN
    SELECT COALESCE(MAX(token_number), 0) + 1
    INTO next_token
    FROM appointments
    WHERE clinic_id = p_clinic_id
    AND appointment_date = p_date;
    
    RETURN next_token;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_clinics_updated_at ON clinics;
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
DROP TRIGGER IF EXISTS update_clinic_settings_updated_at ON clinic_settings;

-- Triggers for updated_at
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_settings_updated_at BEFORE UPDATE ON clinic_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
