'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, Bell, ChevronRight, Filter, Calendar, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'

interface Appointment {
    id: string
    token_number: number
    patient_name: string
    patient_mobile: string
    patient_age?: number
    patient_gender?: string
    appointment_time?: string
    visit_reason?: string
    status: string
    appointment_type: string
}

export default function AppointmentsPage() {
    const router = useRouter()
    const supabase = createClient()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [loading, setLoading] = useState(true)
    const [clinicId, setClinicId] = useState<string | null>(null)
    const [showAddDialog, setShowAddDialog] = useState(false)

    const [newAppointment, setNewAppointment] = useState({
        patient_name: '',
        patient_mobile: '',
        patient_age: '',
        patient_gender: 'M',
        visit_reason: '',
    })

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (clinicId) {
            fetchAppointments()

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
                        fetchAppointments()
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [clinicId, selectedDate])

    useEffect(() => {
        filterAppointments()
    }, [appointments, statusFilter])

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            router.push('/login')
            return
        }

        const { data: userData } = await supabase
            .from('users')
            .select('clinic_id')
            .eq('id', session.user.id)
            .single()

        if (userData) {
            setClinicId(userData.clinic_id)

            // Keep loading true until first fetch
            if (!appointments.length) {
                fetchAppointments()
            }
        }
    }

    const fetchAppointments = async () => {
        if (!clinicId) return

        try {
            const dateStr = selectedDate.toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('clinic_id', clinicId)
                .eq('appointment_date', dateStr)
                .order('token_number', { ascending: true })

            if (error) {
                console.error('Error fetching appointments:', error)
                return
            }

            setAppointments(data || [])
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const filterAppointments = () => {
        if (statusFilter === 'all') {
            setFilteredAppointments(appointments)
        } else {
            setFilteredAppointments(appointments.filter(a => a.status === statusFilter))
        }
    }

    const handleAddAppointment = async () => {
        if (!clinicId || !newAppointment.patient_name || !newAppointment.patient_mobile) {
            alert('Please fill in required fields')
            return
        }

        try {
            const dateStr = selectedDate.toISOString().split('T')[0]

            const { data: tokenData, error: tokenError } = await supabase.rpc('get_next_token_number', {
                p_clinic_id: clinicId,
                p_date: dateStr,
            })

            if (tokenError) {
                console.error('Error getting token:', tokenError)
                alert('Failed to generate token number')
                return
            }

            const { error } = await supabase.from('appointments').insert({
                clinic_id: clinicId,
                patient_name: newAppointment.patient_name,
                patient_mobile: newAppointment.patient_mobile,
                patient_age: newAppointment.patient_age ? parseInt(newAppointment.patient_age) : null,
                patient_gender: newAppointment.patient_gender,
                visit_reason: newAppointment.visit_reason,
                appointment_date: dateStr,
                token_number: tokenData,
                appointment_type: 'walkin',
                status: 'booked',
            })

            if (error) {
                console.error('Error creating appointment:', error)
                alert('Failed to create appointment')
                return
            }

            setShowAddDialog(false)
            setNewAppointment({
                patient_name: '',
                patient_mobile: '',
                patient_age: '',
                patient_gender: 'M',
                visit_reason: '',
            })
            // Fetch will happen via realtime
        } catch (error) {
            console.error('Error:', error)
            alert('Failed to create appointment')
        }
    }

    const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
        const updates: any = { status: newStatus }

        if (newStatus === 'checked_in') {
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
        }
    }

    // Get rolling dates for horizontal scroll
    const getRollingDates = () => {
        const dates = []
        const start = new Date()
        start.setDate(start.getDate() - 2) // Start from 2 days ago

        for (let i = 0; i < 14; i++) {
            const d = new Date(start)
            d.setDate(start.getDate() + i)
            dates.push(d)
        }
        return dates
    }

    const rollingDates = getRollingDates()

    if (loading) {
        return <ModernLoader />
    }

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] pb-24 font-sans">
            {/* Heavy Header */}
            <div className="bg-white px-6 py-5 sticky top-0 z-10 shadow-sm/50">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-blue-500 p-2.5 rounded-xl shadow-lg shadow-blue-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                        </motion.div>
                        <h1 className="text-xl font-bold text-slate-800">Daily Appointments</h1>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"><Search className="h-6 w-6" /></button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"><Bell className="h-6 w-6" /></button>
                    </div>
                </div>

                {/* Month Label */}
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                    <span>{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    <button className="text-blue-500 flex items-center gap-1 hover:underline">View Calendar <ChevronRight className="h-3 w-3" /></button>
                </div>

                {/* Horizontal Date Scroll */}
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-6 px-6">
                    {rollingDates.map((date, i) => {
                        const isSelected = date.getDate() === selectedDate.getDate()
                        return (
                            <motion.button
                                key={i}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setSelectedDate(date)}
                                className={`
                            flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300
                            ${isSelected
                                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-105'
                                        : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
                                    }
                        `}
                            >
                                <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                <span className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{date.getDate()}</span>
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            <div className="px-6 py-4 max-w-lg mx-auto space-y-5">

                {/* Stats / Tabs */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div className="flex gap-3">
                        <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border border-blue-100">
                            {appointments.filter(a => a.status === 'booked').length} Booked
                        </div>
                        <div className="bg-green-50 text-green-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm border border-green-100">
                            {appointments.filter(a => a.status === 'completed').length} Done
                        </div>
                    </div>
                    <button className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-lg shadow-sm border border-slate-50 hover:bg-slate-50">
                        <Filter className="h-4 w-4" />
                    </button>
                </motion.div>

                {/* List */}
                <div className="space-y-4">
                    {filteredAppointments.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <p className="font-medium">No appointments for this day</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {filteredAppointments.map((app, index) => (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05 }}
                                    layout
                                    key={app.id}
                                    className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden group"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-4">
                                            {/* Token Badge */}
                                            <div className={`
                                        flex flex-col items-center justify-center w-14 h-16 rounded-2xl text-white shadow-lg
                                        ${app.status === 'completed' ? 'bg-green-500 shadow-green-200' :
                                                    app.status === 'checked_in' ? 'bg-orange-400 shadow-orange-200' :
                                                        'bg-blue-500 shadow-blue-200'}
                                    `}>
                                                <span className="text-[9px] font-bold opacity-80 uppercase">Token</span>
                                                <span className="text-2xl font-bold leading-none">{String(app.token_number).padStart(2, '0')}</span>
                                            </div>

                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">{app.patient_name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold bg-slate-50 px-2 py-1 rounded-md">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {app.appointment_time || 'Walk-in'}
                                                    </div>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-slate-500 text-xs font-medium">{app.visit_reason || 'Checkup'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <Badge className={`
                                    px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border-0 shadow-none
                                    ${app.status === 'booked' ? 'bg-blue-50 text-blue-600' : ''}
                                    ${app.status === 'checked_in' ? 'bg-orange-50 text-orange-600' : ''}
                                    ${app.status === 'completed' ? 'bg-green-50 text-green-600' : ''}
                                    ${app.status === 'cancelled' ? 'bg-slate-50 text-slate-500' : ''}
                                `}>
                                            {app.status.replace('_', ' ')}
                                        </Badge>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 mt-2">
                                        {app.status === 'booked' && (
                                            <Button
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl shadow-md shadow-blue-100 transition-transform active:scale-95"
                                                onClick={() => updateAppointmentStatus(app.id, 'checked_in')}
                                            >
                                                Check-in
                                            </Button>
                                        )}

                                        {app.status === 'checked_in' && (
                                            <Button
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold h-11 rounded-xl shadow-md shadow-green-100 transition-transform active:scale-95"
                                                onClick={() => updateAppointmentStatus(app.id, 'completed')}
                                            >
                                                Complete
                                            </Button>
                                        )}

                                        <Button variant="outline" className="flex-1 h-11 rounded-xl border-slate-100 font-bold text-slate-500 hover:bg-slate-50">
                                            Details
                                        </Button>
                                    </div>

                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>

            </div>

            {/* FAB */}
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
                        <DialogTitle className="text-xl font-bold text-slate-800">Add New Patient</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Patient Name</Label>
                            <Input
                                value={newAppointment.patient_name}
                                onChange={(e) => setNewAppointment({ ...newAppointment, patient_name: e.target.value })}
                                className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500"
                                placeholder="Ex. Rajesh Kumar"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Mobile Number</Label>
                            <Input
                                value={newAppointment.patient_mobile}
                                onChange={(e) => setNewAppointment({ ...newAppointment, patient_mobile: e.target.value })}
                                className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500"
                                placeholder="10-digit number"
                                maxLength={10}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Age</Label>
                                <Input
                                    type="number"
                                    value={newAppointment.patient_age}
                                    onChange={(e) => setNewAppointment({ ...newAppointment, patient_age: e.target.value })}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500"
                                    placeholder="Age"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Gender</Label>
                                <select
                                    value={newAppointment.patient_gender}
                                    onChange={(e) => setNewAppointment({ ...newAppointment, patient_gender: e.target.value })}
                                    className="w-full h-12 px-3 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500"
                                >
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                    <option value="O">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Reason</Label>
                            <Textarea
                                value={newAppointment.visit_reason}
                                onChange={(e) => setNewAppointment({ ...newAppointment, visit_reason: e.target.value })}
                                className="bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500"
                                placeholder="Checkup, Fever, etc."
                                rows={2}
                            />
                        </div>
                        <Button
                            className="w-full h-14 bg-blue-600 text-white font-bold rounded-xl mt-4 shadow-lg shadow-blue-200 hover:bg-blue-700"
                            onClick={handleAddAppointment}
                        >
                            Add Appointment
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-50 px-6 py-3 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-50">
                <div className="flex justify-between items-center max-w-md mx-auto relative">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex flex-col items-center gap-1.5 p-2 text-slate-400 hover:text-slate-600 transition-colors group"
                    >
                        <motion.div whileTap={{ scale: 0.9 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" /><path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" /></svg>
                        </motion.div>
                        <span className="text-[10px] font-bold group-hover:text-slate-600">Dashboard</span>
                    </button>

                    <button
                        onClick={() => router.push('/appointments')}
                        className="flex flex-col items-center gap-1.5 p-2 text-blue-600 transition-colors"
                    >
                        <motion.div
                            whileTap={{ scale: 0.9 }}
                            className="bg-blue-50 p-2.5 rounded-xl text-blue-600"
                        >
                            <Calendar className="h-6 w-6" />
                        </motion.div>
                        <span className="text-[10px] font-bold">Schedule</span>
                    </button>

                    <button
                        className="flex flex-col items-center gap-1.5 p-2 text-slate-300 pointer-events-none"
                    >
                        <div className="h-6 w-6 rounded-full border-2 border-slate-200"></div>
                        <span className="text-[10px] font-bold">Patients</span>
                    </button>

                    <button
                        onClick={() => router.push('/settings')}
                        className="flex flex-col items-center gap-1.5 p-2 text-slate-400 hover:text-slate-600 transition-colors group"
                    >
                        <motion.div whileTap={{ scale: 0.9 }}>
                            <Settings className="h-6 w-6" />
                        </motion.div>
                        <span className="text-[10px] font-bold group-hover:text-slate-600">Settings</span>
                    </button>
                </div>
            </nav>
        </PageTransition>
    )
}
