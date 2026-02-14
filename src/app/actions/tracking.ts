'use server'

import { createClient } from '@/lib/supabase/server'

export interface TrackingData {
    appointment: {
        token_number: number
        patient_name: string
        status: string
        appointment_date: string
        clinic_id: string
    }
    current_token: number | null
    clinic_name: string
    clinic_slug: string
}

export async function getTrackingData(trackingId: string): Promise<{ data?: TrackingData, error?: string }> {
    const supabase = await createClient()

    try {
        // 1. Get Appointment details
        const { data: appointment, error: appError } = await supabase
            .from('appointments')
            .select(`
                token_number,
                patient_name,
                status,
                appointment_date,
                clinic_id,
                clinics (
                    name,
                    slug
                )
            `)
            .eq('tracking_id', trackingId)
            .single()

        if (appError || !appointment) {
            return { error: 'Appointment not found' }
        }

        // 2. Get currently ongoing token for the same clinic and date
        const { data: ongoingApp, error: ongoingError } = await supabase
            .from('appointments')
            .select('token_number')
            .eq('clinic_id', appointment.clinic_id)
            .eq('appointment_date', appointment.appointment_date)
            .eq('status', 'ongoing')
            .limit(1)
            .single()

        // If no one is ongoing, check for last completed or just return null
        let currentToken = null
        if (ongoingApp) {
            currentToken = ongoingApp.token_number
        } else {
            // Optionally find the latest completed token
            const { data: lastCompleted } = await supabase
                .from('appointments')
                .select('token_number')
                .eq('clinic_id', appointment.clinic_id)
                .eq('appointment_date', appointment.appointment_date)
                .eq('status', 'completed')
                .order('token_number', { ascending: false })
                .limit(1)
                .single()

            if (lastCompleted) {
                currentToken = lastCompleted.token_number
            }
        }

        return {
            data: {
                appointment: {
                    token_number: appointment.token_number,
                    patient_name: appointment.patient_name,
                    status: appointment.status,
                    appointment_date: appointment.appointment_date,
                    clinic_id: appointment.clinic_id
                },
                current_token: currentToken,
                clinic_name: (appointment.clinics as any)?.name || 'Clinic',
                clinic_slug: (appointment.clinics as any)?.slug || ''
            }
        }
    } catch (error: any) {
        console.error('Error fetching tracking data:', error)
        return { error: error.message }
    }
}
