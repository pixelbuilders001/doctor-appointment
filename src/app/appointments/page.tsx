'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, ChevronRight, Filter, Calendar, Settings, Phone, MapPin, User, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { getAppointments } from '@/app/actions/appointments'
import { useRef, useCallback } from 'react'

interface Appointment {
    id: string
    token_number: number
    patient_name: string
    patient_mobile: string
    patient_age?: number
    patient_gender?: string
    patient_address?: string
    appointment_time?: string
    address?: string
    visit_reason?: string
    status: string
    appointment_type: string
    payment_status?: 'pending' | 'paid'
}

export default function AppointmentsPage() {
    const { t } = useLanguage()
    const router = useRouter()
    const supabase = createClient()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
    const [activeTab, setActiveTab] = useState<'new' | 'ongoing' | 'completed'>('new')
    const [counts, setCounts] = useState({ new: 0, ongoing: 0, completed: 0 })
    const [loading, setLoading] = useState(true)
    const [isFilterLoading, setIsFilterLoading] = useState(false)
    // const [searchQuery, setSearchQuery] = useState('') // Main list doesn't use search anymore

    // Bottom Sheet Search State
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [sheetSearchQuery, setSheetSearchQuery] = useState('')
    const [sheetResults, setSheetResults] = useState<Appointment[]>([])
    const [isSheetLoading, setIsSheetLoading] = useState(false)
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [totalCount, setTotalCount] = useState(0)
    const observer = useRef<IntersectionObserver | null>(null)
    const [clinicId, setClinicId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [doctorImage, setDoctorImage] = useState<string | null>(null)
    const [userName, setUserName] = useState('')
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null)
    const { toast } = useToast()

    const [newAppointment, setNewAppointment] = useState({
        patient_name: '',
        patient_mobile: '',
        patient_age: '',
        patient_gender: 'Male',
        patient_address: '',
        appointment_type: 'New',
        appointment_date: new Date().toISOString().split('T')[0],
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (clinicId) {
            // Initial fetch
            fetchAppointments(true)

            const channel = supabase
                .channel('appointments-realtime')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'appointments',
                        filter: `clinic_id=eq.${clinicId}`,
                    },
                    () => {
                        // Refresh current view on changes
                        fetchAppointments(true)
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [clinicId, selectedDate, activeTab])
    // Debounce search in sheet
    useEffect(() => {
        if (!clinicId || !isSearchOpen) return

        const timer = setTimeout(() => {
            if (sheetSearchQuery.trim()) {
                performSheetSearch()
            } else {
                setSheetResults([])
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [sheetSearchQuery, isSearchOpen])

    // Infinite scroll observer
    const lastAppointmentElementRef = useCallback((node: HTMLDivElement) => {
        if (loading || loadingMore) return
        if (observer.current) observer.current.disconnect()
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore()
            }
        })
        if (node) observer.current.observe(node)
    }, [loading, loadingMore, hasMore])

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/login')
            return
        }

        setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User')

        const { data: userData } = await supabase
            .from('users')
            .select('clinic_id, role, clinics(clinic_owner)')
            .eq('id', session.user.id)
            .single()

        if (userData) {
            setClinicId(userData.clinic_id)
            setUserRole(userData.role)
            if (userData.clinics) {
                const clinic = Array.isArray(userData.clinics) ? userData.clinics[0] : userData.clinics
                setDoctorImage((clinic as any)?.clinic_owner || null)
            }

            // Keep loading true until first fetch
            if (!appointments.length) {
                // fetchAppointments() // Initial fetch is already called in useEffect
            }
        }
    }

    const fetchAppointments = async (reset = false) => {
        if (!clinicId) return

        try {
            if (reset) {
                setIsFilterLoading(true)
                setPage(0)
            }

            // Use local date string to avoid UTC shifting
            const dateStr = selectedDate.toLocaleDateString('en-CA') // YYYY-MM-DD in local time
            const currentPage = reset ? 0 : page

            const result = await getAppointments({
                clinicId,
                date: dateStr,
                // searchQuery: searchQuery, // Removed
                page: currentPage,
                limit: 10,
                status: activeTab === 'new' ? 'booked' : activeTab as any
            })

            if (result.error) {
                console.error('Error fetching appointments:', result.error)
                return
            }

            if (reset) {
                setAppointments(result.appointments as any)
                if (result.counts) setCounts(result.counts)
            } else {
                setAppointments(prev => [...prev, ...result.appointments as any])
                // Update counts on load more? Usually not needed unless deep pagination.
                // But if they change, good to update.
                if (result.counts) setCounts(result.counts)
            }

            setTotalCount(result.count)
            setHasMore(result.hasMore)
            setPage(currentPage)
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
            setIsFilterLoading(false)
            setLoadingMore(false)
        }
    }

    const loadMore = async () => {
        if (!hasMore || loadingMore) return
        setLoadingMore(true)
        setPage(prev => prev + 1)

        // We need to call fetch logic but with new page. 
        // Reusing logic in loadMore to avoid state closure issues or duplication.
        if (!clinicId) return

        try {
            const dateStr = selectedDate.toLocaleDateString('en-CA')
            const nextPage = page + 1

            const result = await getAppointments({
                clinicId,
                date: dateStr,
                // searchQuery: searchQuery, // Removed
                page: nextPage,
                limit: 10,
                status: activeTab === 'new' ? 'booked' : activeTab as any
            })

            if (result.error) return

            setAppointments(prev => [...prev, ...result.appointments as any])
            setHasMore(result.hasMore)
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoadingMore(false)
        }
    }

    const performSheetSearch = async () => {
        if (!clinicId || !sheetSearchQuery.trim()) return

        setIsSheetLoading(true)
        try {
            const result = await getAppointments({
                clinicId,
                date: selectedDate.toLocaleDateString('en-CA'), // Passed but ignored if query exists
                searchQuery: sheetSearchQuery,
                page: 0,
                limit: 50,
                status: undefined
            })

            if (result.error) {
                console.error(result.error)
                return
            }

            setSheetResults(result.appointments as any)
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            setIsSheetLoading(false)
        }
    }


    const validateNewAppointment = () => {
        const newErrors: Record<string, string> = {}
        if (!newAppointment.patient_name.trim()) newErrors.patient_name = 'Name is required'
        else if (newAppointment.patient_name.length < 2) newErrors.patient_name = 'Name must be at least 2 characters'

        if (!newAppointment.patient_mobile.trim()) newErrors.patient_mobile = 'Mobile number is required'
        else if (!/^[6-9]\d{9}$/.test(newAppointment.patient_mobile)) newErrors.patient_mobile = 'Enter a valid 10-digit Indian mobile number'

        if (!newAppointment.patient_age) newErrors.patient_age = 'Age is required'
        else if (parseInt(newAppointment.patient_age) < 1 || parseInt(newAppointment.patient_age) > 120) newErrors.patient_age = 'Enter a valid age (1-120)'

        if (!newAppointment.patient_gender) newErrors.patient_gender = 'Gender is required'

        if (!newAppointment.patient_address.trim()) newErrors.patient_address = 'Address is required'
        else if (newAppointment.patient_address.length < 5) newErrors.patient_address = 'Please enter a more descriptive address'

        if (!newAppointment.appointment_type) newErrors.appointment_type = 'Select appointment type'

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleAddAppointment = async () => {
        if (!clinicId) return

        if (!validateNewAppointment()) {
            return
        }

        setIsAdding(true)
        try {
            const dateStr = newAppointment.appointment_date

            const { data: tokenData, error: tokenError } = await supabase.rpc('get_next_token_number', {
                p_clinic_id: clinicId,
                p_date: dateStr,
            })

            if (tokenError) {
                console.error('Error getting token:', tokenError)
                toast({
                    title: "Error",
                    description: "Failed to generate token number.",
                    variant: "destructive"
                })
                return
            }

            const { error } = await supabase.from('appointments').insert({
                clinic_id: clinicId,
                patient_name: newAppointment.patient_name,
                patient_mobile: newAppointment.patient_mobile,
                patient_age: newAppointment.patient_age ? parseInt(newAppointment.patient_age) : null,
                patient_gender: newAppointment.patient_gender,
                address: newAppointment.patient_address,
                appointment_date: dateStr,
                token_number: tokenData,
                appointment_type: newAppointment.appointment_type,
                status: 'confirmed',
                booking_source: 'manual',
                payment_status: 'pending',
            })

            if (error) {
                console.error('Error creating appointment:', error)
                toast({
                    title: "Error",
                    description: "Failed to create appointment.",
                    variant: "destructive"
                })
                return
            }

            toast({
                title: "Success",
                description: "Appointment created successfully!",
            })

            setShowAddDialog(false)
            setNewAppointment({
                patient_name: '',
                patient_mobile: '',
                patient_age: '',
                patient_gender: 'Male',
                patient_address: '',
                appointment_type: 'New',
                appointment_date: new Date().toISOString().split('T')[0],
            })
            // Fetch will happen via realtime
            // Fetch will happen via realtime, but manual fetch is safer for immediate feedback
            if (dateStr === selectedDate.toLocaleDateString('en-CA')) {
                fetchAppointments(true)
            }
        } catch (error) {
            console.error('Error:', error)
            toast({
                title: "Error",
                description: "An unexpected error occurred.",
                variant: "destructive"
            })
        } finally {
            setIsAdding(false)
        }
    }

    const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
        setUpdatingId(appointmentId)
        try {
            const updates: any = { status: newStatus }

            if (newStatus === 'ongoing') {
                updates.checked_in_at = new Date().toISOString()
            } else if (newStatus === 'completed') {
                updates.completed_at = new Date().toISOString()
            }

            const { error } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', appointmentId)

            if (error) {
                console.error('Error updating appointment:', error)
            } else {
                const targetTab =
                    newStatus === 'ongoing' ? 'ongoing' :
                        newStatus === 'completed' ? 'completed' :
                            (newStatus === 'booked' || newStatus === 'confirmed') ? 'new' :
                                activeTab;

                if (targetTab !== activeTab) {
                    setActiveTab(targetTab as any);
                } else {
                    fetchAppointments(true);
                }
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setUpdatingId(null)
        }
    }

    const updatePaymentStatus = async (appointmentId: string, newStatus: string) => {
        setUpdatingId(appointmentId)
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ payment_status: newStatus })
                .eq('id', appointmentId)

            if (error) {
                console.error('Error updating payment status:', error)
            } else {
                fetchAppointments(true)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setUpdatingId(null)
        }
    }

    const deleteAppointment = async (appointmentId: string) => {
        setUpdatingId(appointmentId)
        try {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', appointmentId)

            if (error) {
                console.error('Error deleting appointment:', error)
                toast({
                    title: "Error",
                    description: "Failed to delete appointment.",
                    variant: "destructive"
                })
            } else {
                toast({
                    title: "Success",
                    description: "Appointment deleted successfully!",
                })
                fetchAppointments(true)
                setShowAddDialog(false)
            }
        } catch (error) {
            console.error('Error:', error)
            toast({
                title: "Error",
                description: "An unexpected error occurred.",
                variant: "destructive"
            })
        } finally {
            setUpdatingId(null)
            setIsDeleteDialogOpen(false)
            setAppointmentToDelete(null)
        }
    }

    if (loading) {
        return <ModernLoader />
    }

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] pb-24 font-sans">
            {/* Header */}
            <div className="bg-white px-4 py-5 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3 min-w-0">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0"
                        >
                            {doctorImage ? (
                                <img src={doctorImage} alt="Clinic" className="w-full h-full object-cover" />
                            ) : (
                                <Calendar className="w-5 h-5 text-blue-600" />
                            )}
                        </motion.div>
                        {/* <div className="min-w-0">
                            <h1 className="text-xl font-black text-slate-800 tracking-tight">{t('appointments')}</h1>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 truncate">
                                {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div> */}
                        <Input
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="w-28 h-9 text-[10px] font-bold border-slate-100 rounded-lg bg-slate-50 focus:ring-blue-500 px-2"
                        />
                    </div>
                    {/* <div className="flex items-center gap-1.5 shrink-0"> */}
                    {/* Search Trigger */}
                    <button
                        onClick={() => {
                            setIsSearchOpen(true)
                            // setTimeout(() => document.getElementById('sheet-search-input')?.focus(), 100)
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                    >
                        <Search className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-full border border-slate-100">
                        <User className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[9px] font-black text-slate-600 truncate max-w-[60px]">{userName}</span>
                    </div>
                    {/* </div> */}
                </div>

                {/* Modern Tab Switcher */}
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                    {(['new', 'ongoing', 'completed'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 capitalize",
                                activeTab === tab
                                    ? "bg-white text-blue-600 shadow-md shadow-blue-900/5 translate-y-[-1px]"
                                    : "text-slate-400 hover:text-slate-500"
                            )}
                        >
                            {tab === 'new' ? t('tabNew') : tab === 'ongoing' ? t('tabOngoing') : t('tabCompleted')}
                            <span className={cn(
                                "ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] min-w-[20px] inline-flex items-center justify-center",
                                activeTab === tab ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-500"
                            )}>
                                {isFilterLoading && activeTab === tab ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                    counts[tab]
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            </div>



            {/* List */}
            <div className="space-y-4 px-6 py-6 max-w-lg mx-auto pb-32">

                {!isFilterLoading && appointments.length === 0 && !loading ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-medium text-sm">{t('noAppointments').replace('{tab}', t(activeTab === 'new' ? 'tabNew' : activeTab === 'ongoing' ? 'tabOngoing' : 'tabCompleted'))}</p>
                    </div>
                ) : (
                    <AnimatePresence mode='popLayout'>
                        {appointments.map((app, index) => {
                            // attach ref to last element
                            if (index === appointments.length - 1) {
                                return (
                                    <div ref={lastAppointmentElementRef} key={app.id}>
                                        <AppointmentCard app={app} index={index}
                                            updatingId={updatingId}
                                            userRole={userRole}
                                            updateAppointmentStatus={updateAppointmentStatus}
                                            updatePaymentStatus={updatePaymentStatus}
                                            setAppointmentToDelete={setAppointmentToDelete}
                                            setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                                        />
                                    </div>
                                )
                            }
                            return (
                                <AppointmentCard key={app.id} app={app} index={index}
                                    updatingId={updatingId}
                                    userRole={userRole}
                                    updateAppointmentStatus={updateAppointmentStatus}
                                    updatePaymentStatus={updatePaymentStatus}
                                    setAppointmentToDelete={setAppointmentToDelete}
                                    setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                                />
                            )
                        })}
                    </AnimatePresence>
                )}

                {loadingMore && (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    </div>
                )}
            </div>

            {/* FAB */}
            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-[320px] rounded-3xl p-6 border-0 shadow-2xl">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-black text-slate-800">{t('deleteAppointmentTitle')}</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                {t('deleteAppointmentDescription')}
                            </p>
                        </div>
                        <div className="flex gap-3 w-full pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 h-12 rounded-xl border-slate-100 font-bold text-slate-500"
                                onClick={() => setIsDeleteDialogOpen(false)}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 font-bold shadow-lg shadow-red-100"
                                onClick={() => appointmentToDelete && deleteAppointment(appointmentToDelete)}
                                disabled={updatingId === appointmentToDelete}
                            >
                                {updatingId === appointmentToDelete ? '...' : t('delete')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <DialogContent
                    showCloseButton={false}
                    className="fixed !bottom-0 !top-auto !left-0 !translate-x-0 !translate-y-0 w-full max-w-none h-[80vh] rounded-t-[2rem] border-0 p-0 gap-0 bg-[#F8F9FD] outline-none"
                >
                    <div className="pt-5 pb-1 px-6 rounded-t-[2rem] shadow-sm relative z-10">
                        <div className="w-12 h-1.5 bg-slate-200/50 rounded-full mx-auto mb-4" />

                        <div className="flex items-center gap-3 relative">
                            <Search className="w-5 h-5 text-blue-500 absolute left-4" />
                            <input
                                id="sheet-search-input"
                                value={sheetSearchQuery}
                                onChange={(e) => setSheetSearchQuery(e.target.value)}
                                placeholder={t('searchPlaceholder')}
                                className="w-full h-14 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl text-base font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100/50 transition-all shadow-sm"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 pt-2 space-y-4 pb-20">
                        {isSheetLoading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            </div>
                        ) : sheetResults.length > 0 ? (
                            sheetResults.map((app, index) => (
                                <AppointmentCard
                                    key={app.id}
                                    app={app}
                                    index={index}
                                    updatingId={updatingId}
                                    userRole={userRole}
                                    updateAppointmentStatus={updateAppointmentStatus}
                                    updatePaymentStatus={updatePaymentStatus}
                                    setAppointmentToDelete={setAppointmentToDelete}
                                    setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                                />
                            ))
                        ) : sheetSearchQuery.trim() ? (
                            <div className="text-center py-10 text-slate-400">
                                <p className="font-medium">{t('noResultsFound') || 'No results found'}</p>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-slate-300">
                                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium text-sm">{t('searchInstruction') || 'Search by name or mobile number'}</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="fixed bottom-24 right-6 z-40"
                    >
                        <Button
                            className="h-16 w-16 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-300 flex items-center justify-center"
                            size="icon"
                        >
                            <Plus className="h-7 w-7 text-white" />
                        </Button>
                    </motion.div>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-800">{t('addNewPatient')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('patientName')}</Label>
                            <Input
                                value={newAppointment.patient_name}
                                onChange={(e) => {
                                    setNewAppointment({ ...newAppointment, patient_name: e.target.value })
                                    if (errors.patient_name) setErrors({ ...errors, patient_name: '' })
                                }}
                                className={cn(
                                    errors.patient_name && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                )}
                                placeholder={t('patientNamePlaceholder')}
                            />
                            {errors.patient_name && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_name}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</Label>
                            <Input
                                value={newAppointment.patient_address}
                                onChange={(e) => {
                                    setNewAppointment({ ...newAppointment, patient_address: e.target.value })
                                    if (errors.patient_address) setErrors({ ...errors, patient_address: '' })
                                }}
                                className={cn(
                                    errors.patient_address && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                )}
                                placeholder={t('addressPlaceholder')}
                            />
                            {errors.patient_address && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_address}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('appointmentDate')}</Label>
                                <Input
                                    type="date"
                                    value={newAppointment.appointment_date}
                                    onChange={(e) => {
                                        setNewAppointment({ ...newAppointment, appointment_date: e.target.value })
                                        if (errors.appointment_date) setErrors({ ...errors, appointment_date: '' })
                                    }}
                                    className={cn(
                                        "h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500",
                                        errors.appointment_date && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                    )}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('mobileNumber')}</Label>
                                <Input
                                    value={newAppointment.patient_mobile}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                        setNewAppointment({ ...newAppointment, patient_mobile: val })
                                        if (errors.patient_mobile) setErrors({ ...errors, patient_mobile: '' })
                                    }}
                                    className={cn(
                                        "h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500",
                                        errors.patient_mobile && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                    )}
                                    placeholder={t('mobileNumberPlaceholder')}
                                    maxLength={10}
                                />
                                {errors.patient_mobile && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_mobile}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('age')}</Label>
                                <Input
                                    type="number"
                                    value={newAppointment.patient_age}
                                    onChange={(e) => {
                                        setNewAppointment({ ...newAppointment, patient_age: e.target.value })
                                        if (errors.patient_age) setErrors({ ...errors, patient_age: '' })
                                    }}
                                    className={cn(
                                        "h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500",
                                        errors.patient_age && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                    )}
                                    placeholder={t('agePlaceholder')}
                                />
                                {errors.patient_age && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_age}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('gender')}</Label>
                                <select
                                    value={newAppointment.patient_gender}
                                    onChange={(e) => {
                                        setNewAppointment({ ...newAppointment, patient_gender: e.target.value })
                                        if (errors.patient_gender) setErrors({ ...errors, patient_gender: '' })
                                    }}
                                    className={cn(
                                        "w-full h-12 px-3 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 outline-none",
                                        errors.patient_gender && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                    )}
                                >
                                    <option value="Male">{t('male')}</option>
                                    <option value="Female">{t('female')}</option>
                                    <option value="Other">{t('other')}</option>
                                </select>
                                {errors.patient_gender && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_gender}</p>}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('appointmentType')}</Label>
                                <select
                                    value={newAppointment.appointment_type}
                                    onChange={(e) => {
                                        setNewAppointment({ ...newAppointment, appointment_type: e.target.value })
                                        if (errors.appointment_type) setErrors({ ...errors, appointment_type: '' })
                                    }}
                                    className={cn(
                                        "w-full h-12 px-3 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 appearance-none outline-none",
                                        errors.appointment_type && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                    )}
                                >
                                    <option value="New">{t('newConsultation')}</option>
                                    <option value="Follow-up">{t('followUp')}</option>
                                    <option value="Other">{t('other')}</option>
                                </select>
                                {errors.appointment_type && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.appointment_type}</p>}
                            </div>
                        </div>
                        <Button
                            className="w-full h-14 bg-blue-600 text-white font-bold rounded-xl mt-4 shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-70"
                            onClick={handleAddAppointment}
                            disabled={isAdding}
                        >
                            {isAdding ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{t('creating')}</span>
                                </div>
                            ) : t('addAppointment')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modern Bottom Navigation */}
            <nav className="fixed bottom-6 left-6 right-6 h-16 bg-white/80 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-50">
                <div className="flex justify-around items-center h-full px-4 max-w-md mx-auto">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex flex-col items-center justify-center gap-1 group relative transition-all duration-300"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                            "text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                        )}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 9.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1V9.414l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600">{t('home')}</span>
                    </button>

                    <button
                        onClick={() => router.push('/appointments')}
                        className="flex flex-col items-center justify-center gap-1 group relative"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-blue-100",
                            "bg-blue-600 text-white"
                        )}>
                            <Calendar className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-blue-600">{t('schedule')}</span>
                    </button>

                    <button
                        onClick={() => router.push('/settings')}
                        className="flex flex-col items-center justify-center gap-1 group relative transition-all duration-300"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                            "text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                        )}>
                            <Settings className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600">{t('settings')}</span>
                    </button>
                </div>
            </nav>
        </PageTransition >
    )
}

function AppointmentCard({ app, index, updatingId, userRole, updateAppointmentStatus, updatePaymentStatus, setAppointmentToDelete, setIsDeleteDialogOpen }: any) {
    const { t } = useLanguage()

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-emerald-500'
            case 'ongoing': return 'bg-orange-400'
            default: return 'bg-blue-500'
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            layout
            className="group relative bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] transition-all duration-300"
        >
            {/* Top Row: Token & Status */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "h-10 px-3 rounded-xl flex items-center justify-center gap-2 text-white shadow-lg shadow-current/10",
                        getStatusColor(app.status)
                    )}>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('token')}</span>
                        <span className="text-lg font-black">{String(app.token_number).padStart(2, '0')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                        app.booking_source === 'online' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'
                    )}>
                        {app.booking_source === 'online' ? t('online') : t('walkIn')}
                    </div>
                    {app.payment_status === 'paid' && (
                        <div className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('paid')}
                        </div>
                    )}
                </div>
            </div>

            {/* Middle Row: Patient Main Info */}
            <div className="flex justify-between items-start gap-4 mb-5">
                <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">
                        {app.patient_name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-0",
                            app.appointment_type === 'Emergency' ? 'bg-red-500 text-white' : 'bg-blue-50 text-blue-600'
                        )}>
                            {app.appointment_type || 'New'}
                        </Badge>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                            <User className="w-3 h-3" />
                            {app.patient_age}{t('ageYearsAbbr')} • {app.patient_gender}
                        </div>
                    </div>
                </div>

                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setAppointmentToDelete(app.id)
                            setIsDeleteDialogOpen(true)
                        }}
                        className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        disabled={updatingId === app.id}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </Button>
                </div>
            </div>

            {/* Secondary Info: Contact & Address */}
            <div className="bg-slate-50/50 rounded-2xl p-3.5 space-y-2 mb-5">
                <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                        <Phone className="w-3 h-3 text-blue-500" />
                    </div>
                    <span className="text-[11px] font-bold tracking-tight">{app.patient_mobile}</span>
                </div>
                <div className="flex items-start gap-2 text-slate-500">
                    <div className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                        <MapPin className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-[10px] font-medium leading-relaxed line-clamp-2">
                        {app.address || app.patient_address || t('noAddress')}
                    </span>
                </div>
            </div>

            {/* Bottom Row: Actions */}
            <div className="flex gap-3">
                {(app.status === 'confirmed' || app.status === 'booked') && (
                    <Button
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest h-12 rounded-2xl shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                        onClick={() => updateAppointmentStatus(app.id, 'ongoing')}
                        disabled={updatingId === app.id}
                    >
                        {updatingId === app.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <span className="flex items-center gap-2">
                                {t('checkIn')}
                                <ArrowRight className="w-3 h-3" />
                            </span>
                        )}
                    </Button>
                )}

                {app.status === 'ongoing' && (
                    <Button
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest h-12 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-[0.98]"
                        onClick={() => updateAppointmentStatus(app.id, 'completed')}
                        disabled={updatingId === app.id}
                    >
                        {updatingId === app.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t('complete')}
                            </span>
                        )}
                    </Button>
                )}

                {app.payment_status !== 'paid' && (
                    <Button
                        variant="outline"
                        className="flex-1 border-2 border-emerald-100 bg-white text-emerald-600 font-black text-[10px] uppercase tracking-widest h-12 rounded-2xl hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-[0.98]"
                        onClick={() => updatePaymentStatus(app.id, 'paid')}
                        disabled={updatingId === app.id}
                    >
                        {updatingId === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t('markPaid')}
                    </Button>
                )}
            </div>
        </motion.div>
    )
}
