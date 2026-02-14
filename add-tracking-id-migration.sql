-- Add tracking_id column to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_tracking_id ON appointments(tracking_id);

-- Update RLS policies to allow public access to appointment status by tracking_id
-- We need to check if "Public tracking access" policy exists before creating it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'appointments' AND policyname = 'Public tracking access'
    ) THEN
        CREATE POLICY "Public tracking access" 
        ON appointments FOR SELECT 
        TO public 
        USING (true);
    END IF;
END
$$;
