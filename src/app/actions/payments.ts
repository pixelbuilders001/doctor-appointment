'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getClinicId(supabase: any) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: 'Not authenticated' }

    const adminSupabase = createAdminClient()
    const { data: userData, error: userError } = await adminSupabase
        .from('users')
        .select('clinic_id, role')
        .eq('id', user.id)
        .single()

    if (userError || !userData) return { error: 'Clinic not found' }
    if (userData.role !== 'doctor') return { error: 'Unauthorized: Only doctors can manage payments' }

    return { clinicId: userData.clinic_id }
}

export async function getClinicQrCodes() {
    const supabase = await createServerClient()
    const { clinicId, error } = await getClinicId(supabase)
    if (error) return { error }

    const { data, error: dbError } = await supabase
        .from('clinic_upi_qr_codes')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })

    if (dbError) return { error: dbError.message }
    return { data }
}

export async function createQrCode(formData: {
    qr_image_url: string,
    upi_id?: string,
    is_primary?: boolean
}) {
    const supabase = await createServerClient()
    const { clinicId, error } = await getClinicId(supabase)
    if (error) return { error }

    // If setting as primary, unset others for this clinic
    if (formData.is_primary) {
        await supabase
            .from('clinic_upi_qr_codes')
            .update({ is_primary: false })
            .eq('clinic_id', clinicId)
    }

    const { data, error: dbError } = await supabase
        .from('clinic_upi_qr_codes')
        .insert({
            clinic_id: clinicId,
            ...formData
        })
        .select()
        .single()

    if (dbError) return { error: dbError.message }

    revalidatePath('/settings')
    return { data }
}

export async function updateQrCode(id: string, formData: {
    upi_id?: string,
    status?: 'active' | 'inactive'
}) {
    const supabase = await createServerClient()
    const { clinicId, error } = await getClinicId(supabase)
    if (error) return { error }

    const { data, error: dbError } = await supabase
        .from('clinic_upi_qr_codes')
        .update(formData)
        .eq('id', id)
        .eq('clinic_id', clinicId)
        .select()
        .single()

    if (dbError) return { error: dbError.message }

    revalidatePath('/settings')
    return { data }
}

export async function setPrimaryQrCode(id: string) {
    const supabase = await createServerClient()
    const { clinicId, error } = await getClinicId(supabase)
    if (error) return { error }

    // Unset all primary
    await supabase
        .from('clinic_upi_qr_codes')
        .update({ is_primary: false })
        .eq('clinic_id', clinicId)

    // Set this one as primary
    const { data, error: dbError } = await supabase
        .from('clinic_upi_qr_codes')
        .update({ is_primary: true })
        .eq('id', id)
        .eq('clinic_id', clinicId)
        .select()
        .single()

    if (dbError) return { error: dbError.message }

    revalidatePath('/settings')
    return { data }
}

export async function deleteQrCode(id: string, imageUrl: string) {
    const supabase = await createServerClient()
    const { clinicId, error } = await getClinicId(supabase)
    if (error) return { error }

    // 1. Delete from DB
    const { error: dbError } = await supabase
        .from('clinic_upi_qr_codes')
        .delete()
        .eq('id', id)
        .eq('clinic_id', clinicId)

    if (dbError) return { error: dbError.message }

    // 2. Delete from Storage
    // Extract path from public URL if it's the full URL
    // Public URL format: .../storage/v1/object/public/upi_qr/filename
    const path = imageUrl.split('upi_qr/')[1]
    if (path) {
        await supabase.storage
            .from('upi_qr')
            .remove([path])
    }

    revalidatePath('/settings')
    return { success: true }
}
