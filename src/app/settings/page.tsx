'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, LogOut, Save, Building, Clock, Bell, User, Calendar, Home, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'
import { useToast } from '@/hooks/use-toast'

export default function SettingsPage() {
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [clinicId, setClinicId] = useState<string | null>(null)

    const [clinicData, setClinicData] = useState({
        name: '',
        doctor_name: '',
        mobile: '',
        address: '',
        consultation_fee: 500,
        slot_duration: 15,
    })

    const [settingsData, setSettingsData] = useState({
        morning_start: '09:00',
        morning_end: '13:00',
        evening_start: '17:00',
        evening_end: '21:00',
        send_confirmations: true,
        send_reminders: true,
    })

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
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

            if (!userData) return

            setClinicId(userData.clinic_id)

            const { data: clinic } = await supabase
                .from('clinics')
                .select('*')
                .eq('id', userData.clinic_id)
                .single()

            if (clinic) {
                setClinicData({
                    name: clinic.name || '',
                    doctor_name: clinic.doctor_name || '',
                    mobile: clinic.mobile || '',
                    address: clinic.address || '',
                    consultation_fee: clinic.consultation_fee || 500,
                    slot_duration: clinic.slot_duration || 15,
                })
            }

            const { data: settings } = await supabase
                .from('clinic_settings')
                .select('*')
                .eq('clinic_id', userData.clinic_id)
                .single()

            if (settings) {
                setSettingsData({
                    morning_start: settings.morning_start || '09:00',
                    morning_end: settings.morning_end || '13:00',
                    evening_start: settings.evening_start || '17:00',
                    evening_end: settings.evening_end || '21:00',
                    send_confirmations: settings.send_confirmations ?? true,
                    send_reminders: settings.send_reminders ?? true,
                })
            }
        } catch (error) {
            console.error('Error loading settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!clinicId) return
        setSaving(true)

        try {
            const { error: clinicError } = await supabase
                .from('clinics')
                .update({
                    name: clinicData.name,
                    doctor_name: clinicData.doctor_name,
                    address: clinicData.address,
                    consultation_fee: clinicData.consultation_fee,
                    slot_duration: clinicData.slot_duration,
                })
                .eq('id', clinicId)

            if (clinicError) throw clinicError

            const { error: settingsError } = await supabase
                .from('clinic_settings')
                .update({
                    morning_start: settingsData.morning_start,
                    morning_end: settingsData.morning_end,
                    evening_start: settingsData.evening_start,
                    evening_end: settingsData.evening_end,
                    send_confirmations: settingsData.send_confirmations,
                    send_reminders: settingsData.send_reminders,
                })
                .eq('clinic_id', clinicId)

            if (settingsError) throw settingsError

            toast({
                title: "Settings Saved",
                description: "Your clinic settings have been updated successfully.",
                duration: 3000,
            })
        } catch (error) {
            console.error('Error:', error)
            toast({
                title: "Error",
                description: "Failed to save settings. Please try again.",
                variant: "destructive",
            })
        } finally {
            setSaving(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) return <ModernLoader />

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] pb-24 font-sans">
            {/* Header */}
            <div className="bg-white px-6 py-5 sticky top-0 z-10 shadow-sm/50">
                <div className="flex items-center gap-4 mb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-xl hover:bg-slate-50 text-slate-400"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-xl font-bold text-slate-800">Settings</h1>
                </div>
            </div>

            <div className="px-6 py-6 max-w-lg mx-auto space-y-8">

                {/* Clinic Profile Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 px-1">
                        <Building className="h-4 w-4 text-blue-500" />
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Clinic Profile</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Clinic Name</Label>
                            <Input
                                value={clinicData.name}
                                onChange={(e) => setClinicData({ ...clinicData, name: e.target.value })}
                                className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Doctor Name</Label>
                            <Input
                                value={clinicData.doctor_name}
                                onChange={(e) => setClinicData({ ...clinicData, doctor_name: e.target.value })}
                                className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Address</Label>
                            <Textarea
                                value={clinicData.address}
                                onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                                className="bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 min-h-[80px]"
                            />
                        </div>
                    </div>
                </motion.section>

                {/* Consultation Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 px-1">
                        <User className="h-4 w-4 text-blue-500" />
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consultation</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Fee (₹)</Label>
                                <Input
                                    type="number"
                                    value={clinicData.consultation_fee}
                                    onChange={(e) => setClinicData({ ...clinicData, consultation_fee: parseInt(e.target.value) || 0 })}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-bold text-slate-700 focus-visible:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Slot (Mins)</Label>
                                <select
                                    value={clinicData.slot_duration}
                                    onChange={(e) => setClinicData({ ...clinicData, slot_duration: parseInt(e.target.value) })}
                                    className="w-full h-12 px-3 bg-slate-50 border-0 rounded-xl font-bold text-slate-700 focus-visible:ring-blue-500 outline-none"
                                >
                                    <option value="10">10 Mins</option>
                                    <option value="15">15 Mins</option>
                                    <option value="20">20 Mins</option>
                                    <option value="30">30 Mins</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Timings Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 px-1">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Clinic Timings</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-6">
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-400 uppercase block pl-1">Morning Shift</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="time"
                                    value={settingsData.morning_start}
                                    onChange={(e) => setSettingsData({ ...settingsData, morning_start: e.target.value })}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center"
                                />
                                <span className="text-slate-300 font-bold">-</span>
                                <Input
                                    type="time"
                                    value={settingsData.morning_end}
                                    onChange={(e) => setSettingsData({ ...settingsData, morning_end: e.target.value })}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-400 uppercase block pl-1">Evening Shift</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="time"
                                    value={settingsData.evening_start}
                                    onChange={(e) => setSettingsData({ ...settingsData, evening_start: e.target.value })}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center"
                                />
                                <span className="text-slate-300 font-bold">-</span>
                                <Input
                                    type="time"
                                    value={settingsData.evening_end}
                                    onChange={(e) => setSettingsData({ ...settingsData, evening_end: e.target.value })}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center"
                                />
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Notifications Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 px-1">
                        <Bell className="h-4 w-4 text-blue-500" />
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notifications</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">WhatsApp Confirmations</Label>
                                <p className="text-xs text-slate-400 font-medium">Send appointment details via WhatsApp</p>
                            </div>
                            <Switch
                                checked={settingsData.send_confirmations}
                                onCheckedChange={(checked) => setSettingsData({ ...settingsData, send_confirmations: checked })}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">Auto Reminders</Label>
                                <p className="text-xs text-slate-400 font-medium">Send reminder 1 hour before</p>
                            </div>
                            <Switch
                                checked={settingsData.send_reminders}
                                onCheckedChange={(checked) => setSettingsData({ ...settingsData, send_reminders: checked })}
                            />
                        </div>
                    </div>
                </motion.section>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="pt-4 space-y-4"
                >
                    <Button
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-200 text-base font-bold tracking-wide transition-transform active:scale-95"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Saving...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Save className="w-5 h-5" />
                                <span>Save Changes</span>
                            </div>
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full h-14 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-2xl text-sm font-bold tracking-wide"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-5 h-5 mr-2" />
                        Log Out
                    </Button>
                </motion.div>
            </div>

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
                        className="flex flex-col items-center gap-1.5 p-2 text-slate-400 hover:text-slate-600 transition-colors group"
                    >
                        <motion.div whileTap={{ scale: 0.9 }}>
                            <Calendar className="h-6 w-6" />
                        </motion.div>
                        <span className="text-[10px] font-bold group-hover:text-slate-600">Schedule</span>
                    </button>

                    <button
                        className="flex flex-col items-center gap-1.5 p-2 text-slate-300 pointer-events-none"
                    >
                        <div className="h-6 w-6 rounded-full border-2 border-slate-200"></div>
                        <span className="text-[10px] font-bold">Patients</span>
                    </button>

                    <button
                        onClick={() => router.push('/settings')}
                        className="flex flex-col items-center gap-1.5 p-2 text-blue-600 transition-colors"
                    >
                        <motion.div
                            whileTap={{ scale: 0.9 }}
                            className="bg-blue-50 p-2.5 rounded-xl text-blue-600"
                        >
                            <Settings className="h-6 w-6" />
                        </motion.div>
                        <span className="text-[10px] font-bold">Settings</span>
                    </button>
                </div>
            </nav>
        </PageTransition>
    )
}
