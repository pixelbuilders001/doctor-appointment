'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getClinicStaff() {
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return { error: 'Not authenticated' }

    // Get current user's clinic_id
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('clinic_id, role')
        .eq('id', session.user.id)
        .single()

    if (userError || !userData) return { error: 'Clinic not found' }
    if (userData.role !== 'doctor') return { error: 'Unauthorized: Only doctors can manage staff' }

    const adminSupabase = createAdminClient()
    const { data: staff, error: staffError } = await adminSupabase
        .from('users')
        .select('*')
        .eq('clinic_id', userData.clinic_id)
        .eq('role', 'staff')

    if (staffError) {
        console.error('Error fetching staff:', staffError)
        return { error: staffError.message }
    }

    return { staff }
}

export async function createStaffUser(formData: { email: string, name: string }) {
    const supabase = await createServerClient()
    const adminSupabase = createAdminClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return { error: 'Not authenticated' }

    // Get current user's clinic_id
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('clinic_id, role')
        .eq('id', session.user.id)
        .single()

    if (userError || !userData) return { error: 'Clinic not found' }
    if (userData.role !== 'doctor') return { error: 'Unauthorized: Only doctors can manage staff' }

    // 1. Create user in Auth using Admin SDK
    const tempPassword = 'Temp@' + Math.random().toString(36).substring(2, 10).toUpperCase()

    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email: formData.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: formData.name }
    })

    if (authError) return { error: authError.message }

    // 2. Link staff to clinic in our 'users' table
    const { error: linkError } = await adminSupabase
        .from('users')
        .insert({
            id: authUser.user.id,
            clinic_id: userData.clinic_id,
            role: 'staff',
            full_name: formData.name,
            email: formData.email,
            mobile: null
        })

    if (linkError) {
        console.error('Error linking staff to clinic:', linkError)
        // Cleanup auth user if linking fails
        await adminSupabase.auth.admin.deleteUser(authUser.user.id)
        return { error: linkError.message }
    }

    console.log('Staff created successfully:', {
        authId: authUser.user.id,
        clinicId: userData.clinic_id,
        email: formData.email
    })

    revalidatePath('/settings')
    return {
        success: true,
        tempPassword,
        email: formData.email
    }
}

export async function deleteStaffUser(staffUserId: string) {
    const supabase = await createServerClient()
    const adminSupabase = createAdminClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return { error: 'Not authenticated' }

    // Verify current user is doctor of the same clinic
    const { data: userData } = await supabase
        .from('users')
        .select('clinic_id, role')
        .eq('id', session.user.id)
        .single()

    if (!userData || userData.role !== 'doctor') return { error: 'Unauthorized' }

    // Delete from our users table and auth.users
    const { error: dbError } = await adminSupabase
        .from('users')
        .delete()
        .eq('id', staffUserId)
        .eq('clinic_id', userData.clinic_id)

    if (dbError) return { error: dbError.message }

    const { error: authError } = await adminSupabase.auth.admin.deleteUser(staffUserId)
    if (authError) return { error: authError.message }

    revalidatePath('/settings')
    return { success: true }
}
