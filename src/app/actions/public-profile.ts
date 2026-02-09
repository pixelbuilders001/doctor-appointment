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
    clinic_banner: string | null
    clinic_owner: string | null
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
    patient_age: number
    patient_gender: string
    patient_address: string
    appointment_date: string // YYYY-MM-DD
    appointment_type: string
}

export type AppointmentResponse = {
    success: boolean
    message?: string
    token_number?: number
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
      clinic_banner,
      clinic_owner,
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

    const settings = Array.isArray(clinic.clinic_settings)
        ? clinic.clinic_settings[0]
        : clinic.clinic_settings

    return {
        ...clinic,
        clinic_settings: settings || null
    }
}

export async function createPublicAppointment(data: AppointmentInput): Promise<AppointmentResponse> {
    const supabase = await createClient()
    const { slug, patient_name, patient_mobile, patient_age, patient_gender, patient_address, appointment_date, appointment_type } = data

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
            patient_age,
            patient_gender,
            address: patient_address,
            appointment_date,
            token_number: tokenNumber,
            booking_source: 'online',
            status: 'confirmed',
            appointment_type: appointment_type, // Use selected type
            appointment_time: null
        })

    if (insertError) {
        console.error('Error creating appointment:', insertError)
        return { success: false, message: 'Failed to book appointment' }
    }

    return { success: true, token_number: tokenNumber }
}
