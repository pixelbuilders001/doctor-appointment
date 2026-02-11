'use server'

import { createClient } from '@/lib/supabase/server'

export interface GetAppointmentsParams {
    clinicId: string
    date?: string
    searchQuery?: string
    page?: number
    limit?: number
    status?: 'booked' | 'confirmed' | 'ongoing' | 'completed' | 'cancelled' | 'new'
}

export async function getAppointments(params: GetAppointmentsParams) {
    const supabase = await createClient()
    const { clinicId, date, searchQuery = '', page = 0, limit = 20, status } = params

    try {
        let query = supabase
            .from('appointments')
            .select('*', { count: 'exact' })
            .eq('clinic_id', clinicId)

        // If a search query is present, we prioritize search over date filtering usually, 
        // effectively searching global history. But typically standard apps default to today.
        // However, "search by typing name" implies finding a patient.
        // Let's make date optional. If date is provided, filter by it. 
        // IF search query is present, we might want to IGNORE date or search WITHIN date.
        // The user prompt "appointments table is like this search from backend ... user can search by typing name or address"
        // Let's assume if search query is present, we search ALL dates? 
        // Or should we keep the date filter? 
        // Usually "Search for patient" means finding them anywhere.

        if (date && !searchQuery) {
            query = query.eq('appointment_date', date)
        }

        // Apply search filter if query exists
        if (searchQuery && searchQuery.trim()) {
            const term = `%${searchQuery.trim()}%`
            query = query.or(`patient_name.ilike.${term},address.ilike.${term},patient_mobile.ilike.${term}`)
        }

        // Apply status filter
        // Map 'new' to 'booked' as per schema default, but support 'booked' explicitly too
        if (status) {
            if (status === 'new' || status === 'booked') {
                // In case frontend sends 'new', map to 'booked' or checks for 'booked'
                // The schema default is 'booked'. 
                // Let's filter for 'booked' if status is 'new' or 'booked'
                query = query.in('status', ['booked', 'confirmed'])
                // 'confirmed' might be legacy, but schema says default 'booked'.
            } else {
                query = query.eq('status', status)
            }
        }

        // Apply pagination
        const from = page * limit
        const to = from + limit - 1

        const { data, error, count } = await query
            .order('appointment_date', { ascending: false }) // Show recent first when searching
            .order('token_number', { ascending: true })
            .range(from, to)

        if (error) {
            console.error('Error fetching appointments:', error)
            return { appointments: [], count: 0, hasMore: false, counts: { new: 0, ongoing: 0, completed: 0 }, error: error.message }
        }

        // Fetch counts for all statuses for the given date (ignoring invalid statuses if any)
        // We can do this in parallel or via a separate query
        const { data: statusCounts } = await supabase
            .from('appointments')
            .select('status', { count: 'exact', head: false }) // standard select to get rows for counting
            .eq('clinic_id', clinicId)
            .eq('appointment_date', date) // Counts should be for the selected date, regardless of search? 
        // Usually counts on tabs reflect the view "if I clicked this tab".
        // If there is a search query, do we filter counts by search? 
        // Standard UX: Tabs show total items in category. Search filters strictly the list.
        // Let's stick to date-based counts without search query for the tabs, unless search is very active.
        // Actually, if I search "Rajeev", I want to know if he is in "New" or "Completed".
        // So if search query exists, counts should ideally respect it.
        // But let's start with date-based counts for simplicity as tabs are primary navigation.
        // Wait, supabase `.select` with head:false just returns data. We want aggregation.
        // Supabase doesn't have a simple "group by count" in JS client easily without .rpc or multiple queries.
        // Simplest robust way: 3 count queries or one query fetching all statuses (lightweight).

        // Let's just run 3 separate count queries for simplicity and correctness
        const countQuery = (statuses: string[]) => {
            let q = supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('clinic_id', clinicId)

            if (date) q = q.eq('appointment_date', date)

            // If search is active, maybe we should apply it? 
            // If I search "Rajeev", and he's in "Completed", I want "Completed (1)".
            if (searchQuery && searchQuery.trim()) {
                const term = `%${searchQuery.trim()}%`
                q = q.or(`patient_name.ilike.${term},address.ilike.${term},patient_mobile.ilike.${term}`)
            }

            return q.in('status', statuses)
        }

        const [newCount, ongoingCount, completedCount] = await Promise.all([
            countQuery(['booked', 'confirmed']),
            countQuery(['ongoing']),
            countQuery(['completed'])
        ])

        return {
            appointments: data || [],
            count: count || 0,
            hasMore: count ? (page + 1) * limit < count : false,
            counts: {
                new: newCount.count || 0,
                ongoing: ongoingCount.count || 0,
                completed: completedCount.count || 0
            }
        }
    } catch (error: any) {
        console.error('Error in getAppointments:', error)
        return { appointments: [], count: 0, hasMore: false, counts: { new: 0, ongoing: 0, completed: 0 }, error: error.message }
    }
}
