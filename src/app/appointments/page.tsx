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
import { cn } from '@/lib/utils'

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
}

export default function AppointmentsPage() {
    const router = useRouter()
    const supabase = createClient()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
    const [activeTab, setActiveTab] = useState<'new' | 'ongoing' | 'completed'>('new')
    const [loading, setLoading] = useState(true)
    const [clinicId, setClinicId] = useState<string | null>(null)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

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
    }, [appointments, activeTab])

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
        const mapping = {
            new: 'confirmed',
            ongoing: 'ongoing',
            completed: 'completed'
        }
        setFilteredAppointments(appointments.filter(a => a.status === mapping[activeTab]))
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
                alert('Failed to generate token number')
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
                patient_gender: 'Male',
                patient_address: '',
                appointment_type: 'New',
                appointment_date: new Date().toISOString().split('T')[0],
            })
            // Fetch will happen via realtime
            if (dateStr === selectedDate.toISOString().split('T')[0]) {
                fetchAppointments()
            }
        } catch (error) {
            console.error('Error:', error)
            alert('Failed to create appointment')
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
                fetchAppointments()
            }
            setUpdatingId(null)
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
            <div className="bg-white px-6 py-5 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100"
                        >
                            <Calendar className="w-5 h-5 text-white" />
                        </motion.div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Appointments</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                                {selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="w-32 h-9 text-xs font-bold border-slate-100 rounded-lg bg-slate-50 focus:ring-blue-500"
                        />
                    </div>
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
                            {tab === 'new' ? 'New' : tab === 'ongoing' ? 'Ongoing' : 'Completed'}
                            <span className={cn(
                                "ml-1.5 px-1.5 py-0.5 rounded-md text-[9px]",
                                activeTab === tab ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-500"
                            )}>
                                {appointments.filter(a => {
                                    const m = { new: 'confirmed', ongoing: 'ongoing', completed: 'completed' }
                                    return a.status === m[tab]
                                }).length}
                            </span>
                        </button>
                    ))}
                </div>
            </div>


            {/* List */}
            <div className="space-y-4 px-6 py-6 max-w-lg mx-auto pb-32">
                {filteredAppointments.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-medium text-sm">No {activeTab} appointments</p>
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
                                                app.status === 'ongoing' ? 'bg-orange-400 shadow-orange-200' :
                                                    'bg-blue-500 shadow-blue-200'}
                                    `}>
                                            <span className="text-[9px] font-bold opacity-80 uppercase">Token</span>
                                            <span className="text-2xl font-bold leading-none">{String(app.token_number).padStart(2, '0')}</span>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">{app.patient_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex items-center gap-1.5 text-blue-600 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                    {app.appointment_type || 'New'}
                                                </div>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-slate-500 text-xs font-medium">
                                                    {app.patient_age}y • {app.patient_gender} • {app.address || app.patient_address || 'No Address'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <Badge className={`
                                    px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border-0 shadow-none
                                    ${app.status === 'confirmed' ? 'bg-blue-50 text-blue-600' : ''}
                                    ${app.status === 'ongoing' ? 'bg-orange-50 text-orange-600' : ''}
                                    ${app.status === 'completed' ? 'bg-green-50 text-green-600' : ''}
                                    ${app.status === 'cancelled' ? 'bg-slate-50 text-slate-500' : ''}
                                `}>
                                        {app.status.replace('_', ' ')}
                                    </Badge>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 mt-2">
                                    {app.status === 'confirmed' && (
                                        <Button
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl shadow-md shadow-blue-100 transition-transform active:scale-95 disabled:opacity-70"
                                            onClick={() => updateAppointmentStatus(app.id, 'ongoing')}
                                            disabled={updatingId === app.id}
                                        >
                                            {updatingId === app.id ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Processing...</span>
                                                </div>
                                            ) : 'Check-in'}
                                        </Button>
                                    )}

                                    {app.status === 'ongoing' && (
                                        <Button
                                            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold h-11 rounded-xl shadow-md shadow-green-100 transition-transform active:scale-95 disabled:opacity-70"
                                            onClick={() => updateAppointmentStatus(app.id, 'completed')}
                                            disabled={updatingId === app.id}
                                        >
                                            {updatingId === app.id ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Processing...</span>
                                                </div>
                                            ) : 'Complete'}
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
                                onChange={(e) => {
                                    setNewAppointment({ ...newAppointment, patient_name: e.target.value })
                                    if (errors.patient_name) setErrors({ ...errors, patient_name: '' })
                                }}
                                className={cn(
                                    "h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500",
                                    errors.patient_name && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                )}
                                placeholder="Ex. Rajesh Kumar"
                            />
                            {errors.patient_name && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_name}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Address (Short)</Label>
                            <Input
                                value={newAppointment.patient_address}
                                onChange={(e) => {
                                    setNewAppointment({ ...newAppointment, patient_address: e.target.value })
                                    if (errors.patient_address) setErrors({ ...errors, patient_address: '' })
                                }}
                                className={cn(
                                    "h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500",
                                    errors.patient_address && "border-red-500 ring-1 ring-red-500 bg-red-50/10"
                                )}
                                placeholder="Ex. Sector 44, Gurgaon"
                            />
                            {errors.patient_address && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_address}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Appointment Date</Label>
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
                                <Label className="text-xs font-bold text-slate-500 uppercase">Mobile Number</Label>
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
                                    placeholder="10-digit number"
                                    maxLength={10}
                                />
                                {errors.patient_mobile && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_mobile}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Age</Label>
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
                                    placeholder="Age"
                                />
                                {errors.patient_age && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_age}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Gender</Label>
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
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                {errors.patient_gender && <p className="text-red-500 text-[10px] font-bold mt-1 ml-1">{errors.patient_gender}</p>}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Appointment Type</Label>
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
                                    <option value="New">New Consultation</option>
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Other">Other</option>
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
                                    <span>Creating Appointment...</span>
                                </div>
                            ) : 'Add Appointment'}
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
