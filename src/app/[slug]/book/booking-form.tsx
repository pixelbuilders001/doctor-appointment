'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Loader2, CheckCircle2, ChevronLeft, Calendar as CalendarIcon, User, Phone as PhoneIcon, FileText, ChevronRight, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createPublicAppointment, type ClinicData } from '@/app/actions/public-profile'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface BookingFormProps {
    clinic: ClinicData
    slug: string
}

export default function BookingForm({ clinic, slug }: BookingFormProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [tokenNumber, setTokenNumber] = useState<number | null>(null)
    const [step, setStep] = useState(1)

    // Form State
    const [date, setDate] = useState<Date | undefined>(new Date())

    const [formData, setFormData] = useState({
        patient_name: '',
        patient_mobile: '',
        patient_age: '',
        patient_gender: '',
        patient_address: '',
        appointment_type: 'New'
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const validateForm = () => {
        const newErrors: Record<string, string> = {}
        if (!formData.patient_name.trim()) newErrors.patient_name = 'Name is required'
        else if (formData.patient_name.length < 2) newErrors.patient_name = 'Name must be at least 2 characters'

        if (!formData.patient_mobile.trim()) newErrors.patient_mobile = 'Mobile number is required'
        else if (!/^[6-9]\d{9}$/.test(formData.patient_mobile)) newErrors.patient_mobile = 'Enter a valid 10-digit Indian mobile number'

        if (!formData.patient_age) newErrors.patient_age = 'Age is required'
        else if (parseInt(formData.patient_age) < 1 || parseInt(formData.patient_age) > 120) newErrors.patient_age = 'Enter a valid age (1-120)'

        if (!formData.patient_gender) newErrors.patient_gender = 'Gender is required'

        if (!formData.patient_address.trim()) newErrors.patient_address = 'Address is required'
        else if (formData.patient_address.length < 5) newErrors.patient_address = 'Please enter a more descriptive address'

        if (!formData.appointment_type) newErrors.appointment_type = 'Select appointment type'

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!date) {
            toast({ title: "Required", description: "Please select a date.", variant: "destructive" })
            return
        }
        if (!validateForm()) {
            toast({ title: "Validation Error", description: "Please check the highlighted fields.", variant: "destructive" })
            return
        }

        setLoading(true)
        try {
            const result = await createPublicAppointment({
                slug,
                patient_name: formData.patient_name,
                patient_mobile: formData.patient_mobile,
                patient_age: parseInt(formData.patient_age),
                patient_gender: formData.patient_gender,
                patient_address: formData.patient_address,
                appointment_date: format(date, 'yyyy-MM-dd'),
                appointment_type: formData.appointment_type
            })

            if (result.success) {
                setTokenNumber(result.token_number || null)
                setSuccess(true)
            } else {
                toast({
                    title: "Booking Failed",
                    description: result.message || "An error occurred.",
                    variant: "destructive"
                })
            }
        } catch (error) {
            console.error(error)
            toast({
                title: "Error",
                description: "Something went wrong. Please try again.",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const nextStep = () => {
        if (step === 1 && !date) {
            toast({ title: "Required", description: "Please select a date.", variant: "destructive" })
            return
        }
        if (step === 2 && !validateForm()) {
            toast({ title: "Validation Error", description: "Please check all fields.", variant: "destructive" })
            return
        }
        if (step === 2) {
            handleSubmit()
        } else {
            setStep(step + 1)
        }
    }

    const prevStep = () => setStep(step - 1)

    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center"
            >
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200">
                    <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>

                <h2 className="text-3xl font-bold text-slate-800 mb-2">Booked!</h2>

                {/* Dynamic Token Display */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 my-6 w-full max-w-xs relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-bl-full -mr-8 -mt-8"></div>
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-blue-800 uppercase tracking-widest mb-2">Your Token Number</p>
                        <p className="text-6xl font-black text-blue-600 tabular-nums">{tokenNumber}</p>
                    </div>
                </div>

                <p className="text-slate-500 mb-2 max-w-xs mx-auto text-sm">
                    Doctor sees patients in order of token numbers.
                </p>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm font-medium">
                    Please arrive during clinic hours.
                </p>

                <div className="w-full max-w-xs space-y-3">
                    {clinic.maps_link && (
                        <Button
                            onClick={() => window.open(clinic.maps_link || '', '_blank')}
                            className="w-full h-14 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-lg shadow-blue-200"
                        >
                            Get Directions
                        </Button>
                    )}
                    <Button
                        onClick={() => router.push(`/${slug}`)}
                        className="w-full h-14 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold"
                    >
                        Back to Profile
                    </Button>
                </div>
            </motion.div>
        )
    }

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] font-sans">
            {/* Header */}
            <div className="bg-white p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => step === 1 ? router.back() : prevStep()}>
                        <ChevronLeft className="w-6 h-6 text-slate-600" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Book Appointment</h1>
                        {/* Progress Dots */}
                        <div className="flex gap-1.5 mt-1">
                            <div className={cn("h-1 rounded-full transition-all duration-300", step >= 1 ? "w-8 bg-blue-600" : "w-2 bg-slate-200")}></div>
                            <div className={cn("h-1 rounded-full transition-all duration-300", step >= 2 ? "w-8 bg-blue-600" : "w-2 bg-slate-200")}></div>
                        </div>
                    </div>
                </div>

                {clinic.clinic_owner && (
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-slate-100">
                        <img src={clinic.clinic_owner} alt={clinic.doctor_name} className="w-full h-full object-cover" />
                    </div>
                )}
            </div>


            <div className="p-6 max-w-lg mx-auto pb-32">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                                    Select Date
                                </h2>
                                {/* Native Date Picker styled as a large card */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                    <Input
                                        type="date"
                                        required
                                        min={new Date().toISOString().split('T')[0]}
                                        value={date ? format(date, 'yyyy-MM-dd') : ''}
                                        onChange={(e) => setDate(e.target.value ? new Date(e.target.value) : undefined)}
                                        className="h-14 text-xl font-bold text-center border-slate-200 focus:ring-blue-500 rounded-xl"
                                    />
                                    <p className="text-xs text-slate-400 text-center mt-4">
                                        Tokens are generated based on the selected date.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <User className="w-5 h-5 text-blue-600" />
                                    Patient Details
                                </h2>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 font-medium text-sm">Full Name</Label>
                                        <Input
                                            value={formData.patient_name}
                                            onChange={(e) => {
                                                setFormData({ ...formData, patient_name: e.target.value })
                                                if (errors.patient_name) setErrors({ ...errors, patient_name: '' })
                                            }}
                                            placeholder="e.g. Rahul Kumar"
                                            className={cn(
                                                "h-14 rounded-2xl border-slate-200 focus:ring-blue-500 text-lg bg-white",
                                                errors.patient_name && "border-red-500 focus:ring-red-500"
                                            )}
                                        />
                                        {errors.patient_name && <p className="text-red-500 text-xs mt-1 ml-2 font-medium">{errors.patient_name}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-500 font-medium text-sm">Age</Label>
                                            <Input
                                                type="number"
                                                value={formData.patient_age}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, patient_age: e.target.value })
                                                    if (errors.patient_age) setErrors({ ...errors, patient_age: '' })
                                                }}
                                                placeholder="Age"
                                                className={cn(
                                                    "h-14 rounded-2xl border-slate-200 focus:ring-blue-500 text-lg bg-white",
                                                    errors.patient_age && "border-red-500 focus:ring-red-500"
                                                )}
                                            />
                                            {errors.patient_age && <p className="text-red-500 text-xs mt-1 ml-2 font-medium">{errors.patient_age}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-500 font-medium text-sm">Gender</Label>
                                            <Select
                                                value={formData.patient_gender}
                                                onValueChange={(value) => {
                                                    setFormData({ ...formData, patient_gender: value })
                                                    if (errors.patient_gender) setErrors({ ...errors, patient_gender: '' })
                                                }}
                                            >
                                                <SelectTrigger className={cn(
                                                    "h-14 rounded-2xl border-slate-200 focus:ring-blue-500 text-lg bg-white",
                                                    errors.patient_gender && "border-red-500 focus:ring-red-500"
                                                )}>
                                                    <SelectValue placeholder="Gender" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {errors.patient_gender && <p className="text-red-500 text-xs mt-1 ml-2 font-medium">{errors.patient_gender}</p>}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 font-medium text-sm">Patient Address (Short)</Label>
                                        <Input
                                            value={formData.patient_address}
                                            onChange={(e) => {
                                                setFormData({ ...formData, patient_address: e.target.value })
                                                if (errors.patient_address) setErrors({ ...errors, patient_address: '' })
                                            }}
                                            placeholder="e.g. Sector 44, Gurgaon"
                                            className={cn(
                                                "h-14 rounded-2xl border-slate-200 focus:ring-blue-500 text-lg bg-white",
                                                errors.patient_address && "border-red-500 focus:ring-red-500"
                                            )}
                                        />
                                        {errors.patient_address && <p className="text-red-500 text-xs mt-1 ml-2 font-medium">{errors.patient_address}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 font-medium text-sm">Mobile Number</Label>
                                        <div className="relative">
                                            <PhoneIcon className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                                            <Input
                                                type="tel"
                                                value={formData.patient_mobile}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                                                    setFormData({ ...formData, patient_mobile: val })
                                                    if (errors.patient_mobile) setErrors({ ...errors, patient_mobile: '' })
                                                }}
                                                placeholder="9876543210"
                                                className={cn(
                                                    "h-14 rounded-2xl border-slate-200 focus:ring-blue-500 text-lg bg-white pl-12",
                                                    errors.patient_mobile && "border-red-500 focus:ring-red-500"
                                                )}
                                            />
                                        </div>
                                        {errors.patient_mobile && <p className="text-red-500 text-xs mt-1 ml-2 font-medium">{errors.patient_mobile}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    Appointment Details
                                </h2>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 font-medium text-sm">Appointment Type</Label>
                                        <Select
                                            value={formData.appointment_type}
                                            onValueChange={(value) => {
                                                setFormData({ ...formData, appointment_type: value })
                                                if (errors.appointment_type) setErrors({ ...errors, appointment_type: '' })
                                            }}
                                        >
                                            <SelectTrigger className={cn(
                                                "h-14 rounded-2xl border-slate-200 focus:ring-blue-500 text-lg bg-white",
                                                errors.appointment_type && "border-red-500 focus:ring-red-500"
                                            )}>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="New">New Consultation</SelectItem>
                                                <SelectItem value="Follow-up">Follow-up</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors.appointment_type && <p className="text-red-500 text-xs mt-1 ml-2 font-medium">{errors.appointment_type}</p>}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 z-50">
                <div className="max-w-md mx-auto flex gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">
                            {step === 1 ? "Selected Date" : "Confirm Details"}
                        </p>
                        <p className="text-sm font-bold text-slate-800 truncate">
                            {step === 1
                                ? (date ? format(date, 'MMM d, yyyy') : "Tap to Select")
                                : `${formData.patient_name || 'Patient'} • ${formData.patient_mobile || 'Mobile'}`
                            }
                        </p>
                    </div>
                    <Button
                        size="lg"
                        onClick={nextStep}
                        disabled={loading}
                        className={cn("h-14 rounded-2xl px-8 font-bold text-lg shadow-lg transition-all active:scale-95", step === 2 ? "bg-green-600 hover:bg-green-700 shadow-green-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200")}
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            step === 1 ? <>Next <ChevronRight className="ml-2 w-5 h-5" /></> : "Confirm"
                        )}
                    </Button>
                </div>
            </div>
        </PageTransition>
    )
}
