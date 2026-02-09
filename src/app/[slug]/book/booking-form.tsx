'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { createPublicAppointment, type ClinicData } from '@/app/actions/public-profile'
import { useToast } from '@/hooks/use-toast'

interface BookingFormProps {
    clinic: ClinicData
    slug: string
}

export default function BookingForm({ clinic, slug }: BookingFormProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [date, setDate] = useState<Date>()
    const [formData, setFormData] = useState({
        patient_name: '',
        patient_mobile: '',
        appointment_time: '',
        visit_reason: ''
    })

    const generateTimeSlots = () => {
        if (!clinic.clinic_settings) return []
        const slots = []
        const { morning_start, morning_end, evening_start, evening_end } = clinic.clinic_settings

        // Helper to format time
        const formatTime = (timeStr: string) => timeStr.slice(0, 5)

        if (morning_start && morning_end) {
            let current = new Date(`2000-01-01T${morning_start}`)
            const end = new Date(`2000-01-01T${morning_end}`)
            while (current < end) {
                slots.push(format(current, 'HH:mm'))
                current = new Date(current.getTime() + 15 * 60000) // 15 min slots
            }
        }

        if (evening_start && evening_end) {
            let current = new Date(`2000-01-01T${evening_start}`)
            const end = new Date(`2000-01-01T${evening_end}`)
            while (current < end) {
                slots.push(format(current, 'HH:mm'))
                current = new Date(current.getTime() + 15 * 60000) // 15 min slots
            }
        }
        return slots
    }

    const timeSlots = generateTimeSlots()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!date || !formData.appointment_time) {
            toast({
                title: "Incomplete details",
                description: "Please select a date and time.",
                variant: "destructive"
            })
            return
        }

        setLoading(true)
        try {
            const result = await createPublicAppointment({
                slug,
                patient_name: formData.patient_name,
                patient_mobile: formData.patient_mobile,
                appointment_date: format(date, 'yyyy-MM-dd'),
                appointment_time: formData.appointment_time,
                visit_reason: formData.visit_reason
            })

            if (result.success) {
                setSuccess(true)
                toast({
                    title: "Booking Confirmed",
                    description: "Your appointment has been successfully booked.",
                })
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

    if (success) {
        return (
            <Card className="max-w-md mx-auto mt-8 border-none shadow-lg">
                <CardContent className="pt-6 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Booking Confirmed!</h2>
                    <p className="text-slate-600">
                        Appointment with {clinic.doctor_name}<br />
                        on {date ? format(date, 'PPP') : ''} at {formData.appointment_time}
                    </p>
                    <div className="bg-slate-50 p-4 rounded-lg mt-4 text-sm text-slate-500">
                        <p>✅ Appointment booked successfully</p>
                        <p>Please arrive 10 minutes early.</p>
                    </div>
                    <Button
                        onClick={() => router.push(`/${slug}`)}
                        className="w-full mt-4"
                        variant="outline"
                    >
                        Return to Profile
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="max-w-md mx-auto mt-8 border-none shadow-lg">
            <CardHeader>
                <CardTitle>Book Appointment</CardTitle>
                <CardDescription>Fill in your details to schedule a visit.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="patient_name">Patient Name *</Label>
                        <Input
                            id="patient_name"
                            required
                            value={formData.patient_name}
                            onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                            placeholder="Enter your full name"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="patient_mobile">Mobile Number *</Label>
                        <Input
                            id="patient_mobile"
                            required
                            type="tel"
                            value={formData.patient_mobile}
                            onChange={(e) => setFormData({ ...formData, patient_mobile: e.target.value })}
                            placeholder="10-digit mobile number"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="date">Preferred Date *</Label>
                        <Input
                            id="date"
                            type="date"
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={date ? format(date, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                const selected = e.target.value ? new Date(e.target.value) : undefined
                                setDate(selected)
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="time">Preferred Time Slot *</Label>
                        <Select
                            onValueChange={(val) => setFormData({ ...formData, appointment_time: val })}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a time slot" />
                            </SelectTrigger>
                            <SelectContent>
                                {timeSlots.length > 0 ? (
                                    timeSlots.map((time) => (
                                        <SelectItem key={time} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="no-slots" disabled>No slots available</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="visit_reason">Reason for Visit</Label>
                        <Textarea
                            id="visit_reason"
                            value={formData.visit_reason}
                            onChange={(e) => setFormData({ ...formData, visit_reason: e.target.value })}
                            placeholder="Briefly describe your symptoms (optional)"
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Booking...
                            </>
                        ) : (
                            'Confirm Booking'
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
