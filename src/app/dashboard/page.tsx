'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, MapPin, User, Calendar, Settings, ArrowRight, CheckCircle2, Globe, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'
import QRCodeDisplay from '@/components/QRCodeDisplay'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

interface Appointment {
    id: string
    token_number: number
    patient_name: string
    patient_age?: number
    patient_gender?: string
    address?: string
    appointment_time: string
    appointment_type?: string
    status: string
    visit_reason?: string
    booking_source?: string
    payment_status?: 'pending' | 'paid'
}

interface DashboardData {
    totalAppointments: number
    walkIns: number
    completed: number
    nextAppointments: Appointment[]
}

export default function DashboardPage() {
    const { t } = useLanguage()
    const router = useRouter()
    const supabase = createClient()
    const [clinicStatus, setClinicStatus] = useState<'available' | 'busy' | 'closed'>('available')
    const [dashboardData, setDashboardData] = useState<DashboardData>({
        totalAppointments: 0,
        walkIns: 0,
        completed: 0,
        nextAppointments: [],
    })
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [isStatusLoading, setIsStatusLoading] = useState(false)
    const [clinicId, setClinicId] = useState<string | null>(null)
    const [doctorName, setDoctorName] = useState('Dr. Sharma')
    const [clinicName, setClinicName] = useState('Sharma Clinic')
    const [doctorImage, setDoctorImage] = useState<string | null>(null)
    const [userName, setUserName] = useState('')
    const [userRole, setUserRole] = useState<string | null>(null)
    const [clinicSlug, setClinicSlug] = useState<string>('')
    const [publicUrl, setPublicUrl] = useState<string>('')

    useEffect(() => {
        if (clinicSlug) {
            setPublicUrl(`${window.location.origin}/${clinicSlug}`)
        }
    }, [clinicSlug])

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (clinicId) {
            fetchDashboardData()

            const channel = supabase
                .channel('appointments-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'appointments',
                        filter: `clinic_id=eq.${clinicId}`,
                    },
                    () => {
                        fetchDashboardData()
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [clinicId])

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/login')
            return
        }

        setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User')

        const { data: userData } = await supabase
            .from('users')
            .select('clinic_id, role, clinics(name, doctor_name, clinic_status, slug, clinic_owner)')
            .eq('id', session.user.id)
            .single()

        if (userData) {
            setClinicId(userData.clinic_id)
            setUserRole(userData.role)
            if (userData.clinics) {
                const clinic = Array.isArray(userData.clinics) ? userData.clinics[0] : userData.clinics
                const clinicData = clinic as any

                if (clinicData) {
                    setClinicStatus(clinicData.clinic_status as any)
                    setDoctorName(clinicData.doctor_name || 'Dr. Sharma')
                    setClinicName(clinicData.name || 'Sharma Clinic')
                    setClinicSlug(clinicData.slug || '')
                    setDoctorImage(clinicData.clinic_owner || null)
                }
            }
        }
    }

    const fetchDashboardData = async () => {
        if (!clinicId) return

        try {
            const today = new Date().toLocaleDateString('en-CA')

            const { data: appointments, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('appointment_date', today)
                .order('token_number', { ascending: true })

            if (error) {
                console.error('Error fetching appointments:', error)
                return
            }

            const totalAppointments = appointments?.length || 0
            const walkIns = appointments?.filter(a => a.appointment_type === 'walkin').length || 0
            const completed = appointments?.filter(a => a.status === 'completed').length || 0

            const activeAppointments = appointments?.filter(a => a.status !== 'completed' && a.status !== 'cancelled') || []
            const ongoingIndex = activeAppointments.findIndex(a => a.status === 'ongoing')

            // Show ongoing + next, or just next 2 if no ongoing
            const nextAppointments = (ongoingIndex !== -1
                ? activeAppointments.slice(ongoingIndex, ongoingIndex + 2)
                : activeAppointments.slice(0, 2)
            ).map(a => ({
                id: a.id,
                token_number: a.token_number,
                patient_name: a.patient_name,
                appointment_time: a.appointment_time || 'Walk-in',
                status: a.status,
                visit_reason: a.visit_reason,
                booking_source: a.booking_source,
                payment_status: a.payment_status
            }))

            setDashboardData({
                totalAppointments,
                walkIns,
                completed,
                nextAppointments,
            })
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateClinicStatus = async (newStatus: 'available' | 'busy' | 'closed') => {
        if (!clinicId) return
        setIsStatusLoading(true)
        const oldStatus = clinicStatus
        setClinicStatus(newStatus)

        const { error } = await supabase
            .from('clinics')
            .update({ clinic_status: newStatus })
            .eq('id', clinicId)

        if (error) {
            console.error('Error updating status:', error)
            setClinicStatus(oldStatus) // Rollback
        }
        setIsStatusLoading(false)
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
                fetchDashboardData()
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
                fetchDashboardData()
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setUpdatingId(null)
        }
    }

    if (loading) {
        return <ModernLoader />
    }

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] pb-24 font-sans">
            {/* Header */}
            <div className="bg-white px-4 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm/50">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <motion.div
                            whileTap={{ scale: 0.95 }}
                            className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden"
                        >
                            {doctorImage ? (
                                <img src={doctorImage} alt={doctorName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-blue-600 font-bold text-xl">{doctorName.charAt(0)}</span>
                            )}
                        </motion.div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">{clinicName}</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{doctorName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                    <User className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">{userName}</span>
                </div>
            </div>

            <div className="px-6 py-6 space-y-7 max-w-lg mx-auto">


                {/* Clinic Status - Segmented Control */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-3"
                >
                    {/* <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Clinic Status</h2> */}
                    <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 flex">
                        {['available', 'busy', 'closed'].map((status) => (
                            <button
                                key={status}
                                onClick={() => updateClinicStatus(status as any)}
                                disabled={isStatusLoading}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${clinicStatus === status
                                    ? status === 'available' ? 'bg-green-50 text-green-600 shadow-sm ring-1 ring-green-100'
                                        : status === 'busy' ? 'bg-orange-50 text-orange-500 shadow-sm ring-1 ring-orange-100'
                                            : 'bg-slate-100 text-slate-600 shadow-sm'
                                    : 'text-slate-400 hover:bg-slate-50'
                                    } ${isStatusLoading && clinicStatus === status ? 'opacity-70' : ''}`}
                            >
                                {isStatusLoading && clinicStatus === status ? (
                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : null}
                                {status === 'available' ? t('available') : status === 'busy' ? t('busy') : t('closed')}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Today's Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3"
                >
                    <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t('todaysSummary')}</h2>
                    <div className="flex gap-4">
                        <motion.div whileHover={{ y: -5 }} className="flex-1 bg-white p-4 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-50 flex flex-col items-center justify-center gap-1 aspect-square">
                            <span className="text-3xl font-extrabold text-blue-500">{dashboardData.totalAppointments}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t('total')}</span>
                        </motion.div>
                        <motion.div whileHover={{ y: -5 }} className="flex-1 bg-white p-4 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-50 flex flex-col items-center justify-center gap-1 aspect-square">
                            <span className="text-3xl font-extrabold text-slate-700">{dashboardData.walkIns}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t('walkIns')}</span>
                        </motion.div>
                        <motion.div whileHover={{ y: -5 }} className="flex-1 bg-white p-4 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-50 flex flex-col items-center justify-center gap-1 aspect-square">
                            <span className="text-3xl font-extrabold text-green-500">{dashboardData.completed}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t('done')}</span>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-4"
                >
                    <Button
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-200 text-base font-bold tracking-wide transition-transform active:scale-95"
                        onClick={() => router.push('/appointments')}
                    >
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mr-3">
                            <Plus className="h-4 w-4 text-white" />
                        </div>
                        {t('addNewAppointment')}
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full h-14 bg-white border-2 border-slate-100 hover:bg-slate-50 text-blue-600 rounded-2xl text-base font-bold tracking-wide transition-transform active:scale-95"
                        onClick={() => router.push('/appointments')}
                    >
                        {t('viewAll')}
                    </Button>
                </motion.div>

                {/* Next in Queue */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                >
                    <div className="flex items-center justify-between px-1 mb-4">
                        <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            {t('nextInQueue')}
                        </h2>
                        <Button variant="ghost" size="sm" className="text-[10px] font-black text-blue-600 hover:bg-blue-50" onClick={() => router.push('/appointments')}>
                            {t('viewAll')}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {dashboardData.nextAppointments.length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl text-center shadow-sm border border-slate-50">
                                <p className="text-slate-400 font-medium">{t('noUpcomingAppointments')}</p>
                            </div>
                        ) : (
                            <AnimatePresence>
                                {dashboardData.nextAppointments.map((appointment) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        layout
                                        key={appointment.id}
                                        className="bg-white p-5 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100/50 hover:shadow-[0_15px_35px_rgba(0,0,0,0.03)] transition-all duration-300 relative overflow-hidden group"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                {/* Token Circle */}
                                                <div className={cn(
                                                    "w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-lg shadow-current/5 border border-white/20",
                                                    appointment.status === 'ongoing' ? 'bg-orange-400 text-white' : 'bg-blue-600 text-white'
                                                )}>
                                                    <span className="text-[7px] font-black uppercase opacity-70 tracking-tighter">T</span>
                                                    <span className="text-lg font-black leading-none">{String(appointment.token_number).padStart(2, '0')}</span>
                                                </div>

                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base font-black text-slate-800 tracking-tight truncate">
                                                            {appointment.patient_name}
                                                        </h3>
                                                        {appointment.status === 'ongoing' ? (
                                                            <span className="flex h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                                                        ) : (
                                                            <div className="bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">
                                                                {t('next')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                        <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100/50">
                                                            <Globe className="w-3 h-3 text-blue-400" />
                                                            {appointment.booking_source === 'online' ? t('online') : t('walkIn')}
                                                        </div>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                        <span>{appointment.appointment_time || 'Walk-in'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {appointment.payment_status !== 'paid' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updatePaymentStatus(appointment.id, 'paid')}
                                                        className="h-10 w-10 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl p-0 transition-colors"
                                                        disabled={updatingId === appointment.id}
                                                    >
                                                        {updatingId === appointment.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z" fill="currentColor" />
                                                            </svg>
                                                        )}
                                                    </Button>
                                                )}

                                                {appointment.status === 'ongoing' ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                                                        className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-100"
                                                        disabled={updatingId === appointment.id}
                                                    >
                                                        {updatingId === appointment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t('complete')}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="icon"
                                                        onClick={() => updateAppointmentStatus(appointment.id, 'ongoing')}
                                                        className="h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-90"
                                                        disabled={updatingId === appointment.id}
                                                    >
                                                        {updatingId === appointment.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <ArrowRight className="w-5 h-5" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </motion.div>

                {/* Map Placeholder */}
                {/* <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="h-32 rounded-3xl overflow-hidden relative shadow-sm"
                >
                    <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: "url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/77.2090,28.6139,13,0/600x300?access_token=YOUR_TOKEN')" }}>
                        <div className="w-full h-full bg-slate-200"></div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end p-4">
                        <div className="flex items-center gap-2 text-white">
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs font-bold">New Delhi, South Delhi</span>
                        </div>
                    </div>
                </motion.div> */}

                {/* QR Code Section */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <QRCodeDisplay
                        url={publicUrl}
                        clinicName={clinicName}
                        doctorName={doctorName}
                    />
                </motion.div>

            </div>

            {/* Modern Bottom Navigation */}
            <nav className="fixed bottom-6 left-6 right-6 h-16 bg-white/80 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-50">
                <div className="flex justify-around items-center h-full px-4 max-w-md mx-auto">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex flex-col items-center justify-center gap-1 group relative transition-all duration-300"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-blue-100",
                            "bg-blue-600 text-white"
                        )}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 9.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1V9.414l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                        </div>
                        <span className="text-[10px] font-black text-blue-600">{t('home')}</span>
                    </button>

                    {/* <button
                        onClick={() => router.push('/appointments')}
                        className="flex flex-col items-center justify-center gap-1 group relative transition-all duration-300"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                            "text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                        )}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600">Schedule</span>
                    </button> */}
                    <button
                        onClick={() => router.push('/appointments')}
                        className="flex flex-col items-center justify-center gap-1 group relative"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                            "text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                        )}>
                            <Calendar className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600">{t('schedule')}</span>
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

                    {/* <button
                        onClick={() => router.push('/settings')}
                        className="flex flex-col items-center justify-center gap-1 group relative transition-all duration-300"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                            "text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                        )}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="10" cy="10" r="3" /></svg>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600">Settings</span>
                    </button> */}
                </div>
            </nav>
        </PageTransition>
    )
}
