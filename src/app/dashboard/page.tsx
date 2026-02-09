'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Bell, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'
import QRCodeDisplay from '@/components/QRCodeDisplay'
import { Globe } from 'lucide-react'

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

        const { data: userData } = await supabase
            .from('users')
            .select('clinic_id, clinics(name, doctor_name, clinic_status, slug)')
            .eq('id', session.user.id)
            .single()

        if (userData) {
            setClinicId(userData.clinic_id)
            if (userData.clinics) {
                const clinic = Array.isArray(userData.clinics) ? userData.clinics[0] : userData.clinics
                const clinicData = clinic as any

                if (clinicData) {
                    setClinicStatus(clinicData.clinic_status as any)
                    setDoctorName(clinicData.doctor_name || 'Dr. Sharma')
                    setClinicName(clinicData.name || 'Sharma Clinic')
                    setClinicSlug(clinicData.slug || '')
                }
            }
        }
    }

    const fetchDashboardData = async () => {
        if (!clinicId) return

        try {
            const today = new Date().toISOString().split('T')[0]

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

            const nextAppointments = appointments
                ?.filter(a => a.status !== 'completed' && a.status !== 'cancelled')
                .slice(0, 3)
                .map(a => ({
                    id: a.id,
                    token_number: a.token_number,
                    patient_name: a.patient_name,
                    appointment_time: a.appointment_time || 'Walk-in',
                    status: a.status,
                    visit_reason: a.visit_reason,
                    booking_source: a.booking_source,
                    payment_status: a.payment_status
                })) || []

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
            <div className="bg-white px-6 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm/50">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <motion.div
                            whileTap={{ scale: 0.95 }}
                            className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden"
                        >
                            <span className="text-blue-600 font-bold text-xl">{doctorName.charAt(0)}</span>
                        </motion.div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-tight">{doctorName}</h1>
                        <p className="text-xs text-slate-500 font-medium">{clinicName}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 relative">
                    <Bell className="h-6 w-6" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </Button>
            </div>

            <div className="px-6 py-6 space-y-7 max-w-lg mx-auto">

                {/* Clinic Status - Segmented Control */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-3"
                >
                    <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Clinic Status</h2>
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
                                {status.charAt(0).toUpperCase() + status.slice(1)}
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
                    <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">Today's Summary</h2>
                    <div className="flex gap-4">
                        <motion.div whileHover={{ y: -5 }} className="flex-1 bg-white p-4 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-50 flex flex-col items-center justify-center gap-1 aspect-square">
                            <span className="text-3xl font-extrabold text-blue-500">{dashboardData.totalAppointments}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">TOTAL</span>
                        </motion.div>
                        <motion.div whileHover={{ y: -5 }} className="flex-1 bg-white p-4 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-50 flex flex-col items-center justify-center gap-1 aspect-square">
                            <span className="text-3xl font-extrabold text-slate-700">{dashboardData.walkIns}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">WALK-INS</span>
                        </motion.div>
                        <motion.div whileHover={{ y: -5 }} className="flex-1 bg-white p-4 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-slate-50 flex flex-col items-center justify-center gap-1 aspect-square">
                            <span className="text-3xl font-extrabold text-green-500">{dashboardData.completed}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">DONE</span>
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
                        Add New Appointment
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full h-14 bg-white border-2 border-slate-100 hover:bg-slate-50 text-blue-600 rounded-2xl text-base font-bold tracking-wide transition-transform active:scale-95"
                        onClick={() => router.push('/appointments')}
                    >
                        View All Appointments
                    </Button>
                </motion.div>

                {/* Next in Queue */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                >
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Next in Queue</h2>
                        <button
                            onClick={() => router.push('/appointments')}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                            View All
                        </button>
                    </div>

                    <div className="space-y-3">
                        {dashboardData.nextAppointments.length === 0 ? (
                            <div className="bg-white p-8 rounded-3xl text-center shadow-sm border border-slate-50">
                                <p className="text-slate-400 font-medium">No upcoming appointments</p>
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
                                        className="bg-white p-4 rounded-3xl shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-slate-50 relative overflow-hidden active:scale-[0.99] transition-transform"
                                    >
                                        <div className={cn(
                                            "absolute top-0 left-0 w-1 h-full",
                                            appointment.status === 'ongoing' ? 'bg-orange-400' : 'bg-blue-500'
                                        )} />

                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black border-2",
                                                    appointment.status === 'ongoing' ? 'bg-orange-50 text-orange-500 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                                )}>
                                                    {appointment.patient_name.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                                        {appointment.patient_name}
                                                        {appointment.booking_source === 'online' && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                        )}
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">
                                                            T-{String(appointment.token_number).padStart(2, '0')}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-bold">
                                                            {appointment.patient_age}Y • {appointment.appointment_type || 'New'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {appointment.payment_status !== 'paid' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => updatePaymentStatus(appointment.id, 'paid')}
                                                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl px-3 font-black text-[9px] h-9"
                                                        disabled={updatingId === appointment.id}
                                                    >
                                                        {updatingId === appointment.id ? '...' : 'PAID'}
                                                    </Button>
                                                )}

                                                {appointment.status === 'ongoing' ? (
                                                    <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-100">
                                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="icon"
                                                        onClick={() => updateAppointmentStatus(appointment.id, 'ongoing')}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl w-9 h-9 shadow-lg shadow-blue-100 transition-all active:scale-90"
                                                        disabled={updatingId === appointment.id}
                                                    >
                                                        {updatingId === appointment.id ? (
                                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
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
                <motion.div
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
                </motion.div>

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
                        <span className="text-[10px] font-black text-blue-600">Home</span>
                    </button>

                    <button
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
                    </button>

                    <button
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
                    </button>
                </div>
            </nav>
        </PageTransition>
    )
}
