-- Migration: Add payment_status to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';

-- Update existing records if any have NULL (though default should handle it)
UPDATE appointments SET payment_status = 'pending' WHERE payment_status IS NULL;

-- Enable RLS for this column (it inherits table level RLS usually but good to keep in mind)
-- Ensure policies allow update for payment_status
DROP POLICY IF EXISTS "Users can update appointments in their clinic" ON appointments;
CREATE POLICY "Users can update appointments in their clinic"
    ON appointments FOR UPDATE
    TO authenticated
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));
