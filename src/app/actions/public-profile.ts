'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ClinicData = {
    id: string
    name: string
    doctor_name: string
    specialization: string | null
    address: string | null
    mobile: string | null
    maps_link: string | null
    clinic_settings: {
        morning_start: string | null
        morning_end: string | null
        evening_start: string | null
        evening_end: string | null
    } | null
}

export type AppointmentInput = {
    slug: string
    patient_name: string
    patient_mobile: string
    appointment_date: string // YYYY-MM-DD
    appointment_time: string // HH:mm
    visit_reason?: string
}

export async function getClinicBySlug(slug: string): Promise<ClinicData | null> {
    const supabase = await createClient()

    const { data: clinic, error } = await supabase
        .from('clinics')
        .select(`
      id,
      name,
      doctor_name,
      specialization,
      address,
      mobile,
      maps_link,
      clinic_settings (
        morning_start,
        morning_end,
        evening_start,
        evening_end
      )
    `)
        .eq('slug', slug)
        .single()

    if (error) {
        console.error('Error fetching clinic via slug:', error)
        return null
    }

    // Handle array or object return for relation
    const settings = Array.isArray(clinic.clinic_settings)
        ? clinic.clinic_settings[0]
        : clinic.clinic_settings

    return {
        ...clinic,
        clinic_settings: settings || null
    }
}

export async function createPublicAppointment(data: AppointmentInput) {
    const supabase = await createClient()
    const { slug, patient_name, patient_mobile, appointment_date, appointment_time, visit_reason } = data

    // 1. Get Clinic ID
    const clinic = await getClinicBySlug(slug)
    if (!clinic) {
        return { success: false, message: 'Clinic not found' }
    }

    // 2. Get Next Token Number
    const { data: tokenNumber, error: tokenError } = await supabase.rpc('get_next_token_number', {
        p_clinic_id: clinic.id,
        p_date: appointment_date
    })

    if (tokenError) {
        console.error('Error getting token number:', tokenError)
        return { success: false, message: 'Failed to generate token' }
    }

    // 3. Create Appointment
    const { error: insertError } = await supabase
        .from('appointments')
        .insert({
            clinic_id: clinic.id,
            patient_name,
            patient_mobile,
            appointment_date,
            appointment_time,
            visit_reason,
            token_number: tokenNumber,
            booking_source: 'online', // Ensure this matches migration default/check
            status: 'confirmed', // As requested: CONFIRMED
            appointment_type: 'scheduled'
        })

    if (insertError) {
        console.error('Error creating appointment:', insertError)
        return { success: false, message: 'Failed to book appointment' }
    }

    return { success: true }
}
