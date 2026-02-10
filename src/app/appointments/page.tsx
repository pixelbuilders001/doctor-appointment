'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, ChevronRight, Filter, Calendar, Settings, Phone, MapPin, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

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
    const router = useRouter()
    const supabase = createClient()
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
    const [activeTab, setActiveTab] = useState<'new' | 'ongoing' | 'completed'>('new')
    const [clinicId, setClinicId] = useState<string | null>(null)
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

        setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User')

        const { data: userData } = await supabase
            .from('users')
            .select('clinic_id, clinics(clinic_owner)')
            .eq('id', session.user.id)
            .single()

        if (userData) {
            setClinicId(userData.clinic_id)
            if (userData.clinics) {
                const clinic = Array.isArray(userData.clinics) ? userData.clinics[0] : userData.clinics
                setDoctorImage((clinic as any)?.clinic_owner || null)
            }

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
            if (dateStr === selectedDate.toISOString().split('T')[0]) {
                fetchAppointments()
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
                fetchAppointments()
            }
            setUpdatingId(null)
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
                fetchAppointments()
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
                    title: "Deleted",
                    description: "Appointment has been removed.",
                })
                fetchAppointments()
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
            <div className="bg-white px-6 py-5 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden"
                        >
                            {doctorImage ? (
                                <img src={doctorImage} alt="Clinic" className="w-full h-full object-cover" />
                            ) : (
                                <Calendar className="w-5 h-5 text-blue-600" />
                            )}
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
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                            <User className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-black text-slate-600 truncate max-w-[80px]">{userName}</span>
                        </div>
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
                                className="bg-white p-4 rounded-3xl shadow-[0_4px_25px_rgba(0,0,0,0.02)] border border-slate-50 relative overflow-hidden group active:scale-[0.99] transition-transform"
                            >
                                {/* Background Accent */}
                                <div className={cn(
                                    "absolute top-0 left-0 w-1 h-full",
                                    app.status === 'completed' ? 'bg-green-500' :
                                        app.status === 'ongoing' ? 'bg-orange-400' : 'bg-blue-500'
                                )} />

                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex gap-3">
                                        {/* Token Badge */}
                                        <div className={cn(
                                            "flex flex-col items-center justify-center w-12 h-14 rounded-2xl text-white shadow-lg shrink-0",
                                            app.status === 'completed' ? 'bg-green-500 shadow-green-100' :
                                                app.status === 'ongoing' ? 'bg-orange-400 shadow-orange-100' :
                                                    'bg-blue-500 shadow-blue-100'
                                        )}>
                                            <span className="text-[8px] font-black opacity-70 uppercase tracking-tighter">Token</span>
                                            <span className="text-xl font-black leading-none">{String(app.token_number).padStart(2, '0')}</span>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-black text-slate-800 tracking-tight">{app.patient_name}</h3>
                                                <Badge className={cn(
                                                    "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border-0",
                                                    app.payment_status === 'paid' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-100' : 'bg-amber-100 text-amber-700'
                                                )}>
                                                    {app.payment_status || 'pending'}
                                                </Badge>
                                            </div>

                                            {/* Patient Details Grid */}
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-600">
                                                        {app.patient_age}Y • {app.patient_gender?.charAt(0)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                    {app.appointment_type || 'New'}
                                                </div>
                                                <div className="col-span-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                                                    <Phone className="w-2.5 h-2.5" />
                                                    <span>{app.patient_mobile}</span>
                                                </div>
                                                <div className="col-span-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-400 truncate max-w-[180px]">
                                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                                    <span className="truncate">{app.address || app.patient_address || 'No Address'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Right Status */}
                                    <div className={cn(
                                        "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                                        app.status === 'confirmed' ? 'bg-blue-50 text-blue-600' :
                                            app.status === 'ongoing' ? 'bg-orange-50 text-orange-600' :
                                                app.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'
                                    )}>
                                        {app.status}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-slate-50 my-4" />

                                {/* Actions Container */}
                                <div className="flex gap-2">
                                    {app.status === 'confirmed' && (
                                        <Button
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs h-10 rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-70"
                                            onClick={() => updateAppointmentStatus(app.id, 'ongoing')}
                                            disabled={updatingId === app.id}
                                        >
                                            {updatingId === app.id ? '...' : 'Check-in'}
                                        </Button>
                                    )}

                                    {app.status === 'ongoing' && (
                                        <Button
                                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs h-10 rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-95 disabled:opacity-70"
                                            onClick={() => updateAppointmentStatus(app.id, 'completed')}
                                            disabled={updatingId === app.id}
                                        >
                                            {updatingId === app.id ? '...' : 'Complete'}
                                        </Button>
                                    )}

                                    {app.payment_status !== 'paid' && (
                                        <Button
                                            variant="outline"
                                            className="flex-1 border-0 bg-emerald-50 text-emerald-600 font-black text-xs h-10 rounded-xl hover:bg-emerald-100 transition-all active:scale-95"
                                            onClick={() => updatePaymentStatus(app.id, 'paid')}
                                            disabled={updatingId === app.id}
                                        >
                                            Mark Paid
                                        </Button>
                                    )}

                                    {/* Action Icons */}
                                    <div className="flex gap-1">
                                        {app.payment_status !== 'paid' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50"
                                                onClick={() => {
                                                    setAppointmentToDelete(app.id)
                                                    setIsDeleteDialogOpen(true)
                                                }}
                                                disabled={updatingId === app.id}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
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
                            <h3 className="text-lg font-black text-slate-800">Delete Appointment?</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Are you sure you want to remove this appointment? This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3 w-full pt-2">
                            <Button
                                variant="outline"
                                className="flex-1 h-12 rounded-xl border-slate-100 font-bold text-slate-500"
                                onClick={() => setIsDeleteDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 font-bold shadow-lg shadow-red-100"
                                onClick={() => appointmentToDelete && deleteAppointment(appointmentToDelete)}
                                disabled={updatingId === appointmentToDelete}
                            >
                                {updatingId === appointmentToDelete ? '...' : 'Delete'}
                            </Button>
                        </div>
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
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600">Home</span>
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
                        <span className="text-[10px] font-black text-blue-600">Schedule</span>
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
                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600">Settings</span>
                    </button>
                </div>
            </nav>
        </PageTransition>
    )
}
