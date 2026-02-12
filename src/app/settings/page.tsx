'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, LogOut, Save, Building, Clock, Bell, User, Calendar, Home, Settings, ShieldCheck, Plus, Trash2, Users, Lock, Key, Eye, EyeOff, Copy, CheckCircle2, Languages } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getClinicStaff, createStaffUser, deleteStaffUser, updateStaffStatus } from '@/app/actions/staff'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { motion, AnimatePresence } from 'framer-motion'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

export default function SettingsPage() {
    const { t, language, setLanguage } = useLanguage()
    const router = useRouter()
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [clinicId, setClinicId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [staffList, setStaffList] = useState<any[]>([])
    const [showAddStaffDialog, setShowAddStaffDialog] = useState(false)
    const [newStaffData, setNewStaffData] = useState({ name: '', email: '' })
    const [creatingStaff, setCreatingStaff] = useState(false)
    const [showPasswordDialog, setShowPasswordDialog] = useState(false)
    const [createdStaffCredentials, setCreatedStaffCredentials] = useState<{ email: string, password: string } | null>(null)
    const [passwordCopied, setPasswordCopied] = useState(false)

    const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false)
    const [passwords, setPasswords] = useState({ new: '', confirm: '' })
    const [updatingPassword, setUpdatingPassword] = useState(false)
    const [showPass, setShowPass] = useState(false)
    const [showConfirmPass, setShowConfirmPass] = useState(false)

    const isReadOnly = userRole !== 'doctor'

    const [clinicData, setClinicData] = useState({
        name: '',
        doctor_name: '',
        mobile: '',
        address: '',
        consultation_fee: 500,
        slot_duration: 15,
        clinic_banner: '',
        clinic_owner: '',
        specialization: '',
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
                .select('clinic_id, role')
                .eq('id', session.user.id)
                .single()

            if (!userData) return

            setClinicId(userData.clinic_id)
            setUserRole(userData.role)

            // Load staff if user is a doctor
            if (userData.role === 'doctor') {
                const { staff } = await getClinicStaff()
                if (staff) setStaffList(staff)
            }

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
                    clinic_banner: clinic.clinic_banner || '',
                    clinic_owner: clinic.clinic_owner || '',
                    specialization: clinic.specialization || '',
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

    const uploadImage = async (file: File, path: string) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${clinicId}/${path}-${Date.now()}.${fileExt}`
        const { data, error } = await supabase.storage
            .from('clinic-image')
            .upload(fileName, file)

        if (error) throw error

        const { data: { publicUrl } } = supabase.storage
            .from('clinic-image')
            .getPublicUrl(fileName)

        return publicUrl
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
                    clinic_banner: clinicData.clinic_banner,
                    clinic_owner: clinicData.clinic_owner,
                    specialization: clinicData.specialization,
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

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newStaffData.email || !newStaffData.name) return
        setCreatingStaff(true)
        try {
            const res = await createStaffUser(newStaffData)
            if (res.error) throw new Error(res.error)

            // Store credentials and show success dialog
            setCreatedStaffCredentials({
                email: res.email!,
                password: res.tempPassword!
            })
            setShowPasswordDialog(true)
            setShowAddStaffDialog(false)
            setNewStaffData({ name: '', email: '' })

            // Refresh staff list
            const { staff } = await getClinicStaff()
            if (staff) setStaffList(staff)
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setCreatingStaff(false)
        }
    }

    const handleCopyPassword = async () => {
        if (!createdStaffCredentials) return
        try {
            await navigator.clipboard.writeText(createdStaffCredentials.password)
            setPasswordCopied(true)
            setTimeout(() => setPasswordCopied(false), 2000)
        } catch (error) {
            toast({
                title: "Failed to copy",
                description: "Please copy the password manually",
                variant: "destructive"
            })
        }
    }

    const handleToggleStaffStatus = async (id: string, currentStatus: boolean) => {
        try {
            const res = await updateStaffStatus(id, !currentStatus)
            if (res.error) throw new Error(res.error)
            setStaffList(staffList.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s))
            toast({ title: !currentStatus ? "Staff Activated" : "Staff Deactivated" })
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    const handleDeleteStaff = async (id: string) => {
        if (!confirm('Are you sure you want to remove this staff member?')) return
        try {
            const res = await deleteStaffUser(id)
            if (res.error) throw new Error(res.error)
            toast({ title: "Staff Removed" })
            setStaffList(staffList.filter(s => s.id !== id))
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        }
    }

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (passwords.new !== passwords.confirm) {
            toast({ title: "Passwords don't match", variant: "destructive" })
            return
        }
        if (passwords.new.length < 6) {
            toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" })
            return
        }

        setUpdatingPassword(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.new
            })
            if (error) throw error

            toast({ title: "Password Updated", description: "Your password has been changed successfully." })
            setShowPasswordDialog(false)
            setPasswords({ new: '', confirm: '' })
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" })
        } finally {
            setUpdatingPassword(false)
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
            <div className="bg-white px-6 py-3 sticky top-0 z-10 shadow-sm/50">
                <div className="flex items-center gap-4 mb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-xl hover:bg-slate-50 text-slate-400"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-xl font-bold text-slate-800">{t('settings')}</h1>
                </div>
                {/* {isReadOnly && (
                    <div className="mx-6 mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-sm font-black text-amber-900 leading-none">{t('viewOnlyMode')}</p>
                            <p className="text-[10px] font-bold text-amber-700/80">{t('adminAccess')}</p>
                        </div>
                    </div>
                )} */}
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
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('profile')}</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('clinicName')}</Label>
                            <Input
                                value={clinicData.name}
                                onChange={(e) => setClinicData({ ...clinicData, name: e.target.value })}
                                disabled={isReadOnly}
                                className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 disabled:opacity-70"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('doctorName')}</Label>
                            <Input
                                value={clinicData.doctor_name}
                                onChange={(e) => setClinicData({ ...clinicData, doctor_name: e.target.value })}
                                disabled={isReadOnly}
                                className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 disabled:opacity-70"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('specialization')}</Label>
                            <Input
                                value={clinicData.specialization}
                                onChange={(e) => setClinicData({ ...clinicData, specialization: e.target.value })}
                                placeholder={t('specializationPlaceholder')}
                                disabled={isReadOnly}
                                className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 disabled:opacity-70"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</Label>
                            <Textarea
                                value={clinicData.address}
                                onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                                disabled={isReadOnly}
                                className="bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 min-h-[80px] disabled:opacity-70"
                            />
                        </div>

                        {/* Visuals */}
                        <div className="grid grid-cols-1 gap-5 pt-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('clinicBannerImage')}</Label>
                                <div className="flex flex-col gap-3">
                                    <div
                                        onClick={() => !isReadOnly && document.getElementById('banner-upload')?.click()}
                                        className={cn(
                                            "h-32 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-center items-center justify-center transition-colors overflow-hidden relative",
                                            !isReadOnly ? "cursor-pointer hover:bg-slate-100" : "cursor-default opacity-80"
                                        )}
                                    >
                                        {clinicData.clinic_banner ? (
                                            <img src={clinicData.clinic_banner} alt="Banner" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <Building className="w-8 h-8" />
                                                <span className="text-xs font-bold uppercase tracking-wider">{t('uploadBanner') || 'Upload Banner'}</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center group">
                                            <div className="bg-white/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Save className="w-4 h-4 text-blue-600" />
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        id="banner-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                try {
                                                    setSaving(true)
                                                    const url = await uploadImage(file, 'banner')
                                                    setClinicData({ ...clinicData, clinic_banner: url })
                                                    toast({ title: "Banner Uploaded", description: "Refresh or save to keep changes." })
                                                } catch (err) {
                                                    toast({ title: "Upload Failed", variant: "destructive" })
                                                } finally {
                                                    setSaving(false)
                                                }
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-slate-400 font-medium">Recommended: 1600x400 landscape image</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('doctorProfileImage') || 'Doctor/Owner Profile Image'}</Label>
                                <div className="flex items-center gap-6">
                                    <div
                                        onClick={() => !isReadOnly && document.getElementById('owner-upload')?.click()}
                                        className={cn(
                                            "h-24 w-24 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center transition-colors overflow-hidden relative shrink-0",
                                            !isReadOnly ? "cursor-pointer hover:bg-slate-100" : "cursor-default opacity-80"
                                        )}
                                    >
                                        {clinicData.clinic_owner ? (
                                            <img src={clinicData.clinic_owner} alt="Owner" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-8 h-8 text-slate-300" />
                                        )}
                                    </div>
                                    {/* <div className="space-y-1.5 flex-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-10 rounded-xl px-4 font-bold text-slate-600 border-slate-200"
                                            onClick={() => document.getElementById('owner-upload')?.click()}
                                        >
                                            {t('save')}
                                        </Button>
                                        <p className="text-[10px] text-slate-400 font-medium">Recommended: Square image (800x800)</p>
                                    </div> */}
                                    <input
                                        id="owner-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (file) {
                                                try {
                                                    setSaving(true)
                                                    const url = await uploadImage(file, 'owner')
                                                    setClinicData({ ...clinicData, clinic_owner: url })
                                                    toast({ title: "Photo Uploaded" })
                                                } catch (err) {
                                                    toast({ title: "Upload Failed", variant: "destructive" })
                                                } finally {
                                                    setSaving(false)
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
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
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('consultation')}</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('fee')} (₹)</Label>
                                <Input
                                    type="number"
                                    value={clinicData.consultation_fee}
                                    onChange={(e) => setClinicData({ ...clinicData, consultation_fee: parseInt(e.target.value) || 0 })}
                                    disabled={isReadOnly}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-bold text-slate-700 focus-visible:ring-blue-500 disabled:opacity-70"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('slot')} (Mins)</Label>
                                <select
                                    value={clinicData.slot_duration}
                                    onChange={(e) => setClinicData({ ...clinicData, slot_duration: parseInt(e.target.value) })}
                                    disabled={isReadOnly}
                                    className="w-full h-12 px-3 bg-slate-50 border-0 rounded-xl font-bold text-slate-700 focus-visible:ring-blue-500 outline-none disabled:opacity-70"
                                >
                                    <option value="10">{t('slotMins').replace('{mins}', '10')}</option>
                                    <option value="15">{t('slotMins').replace('{mins}', '15')}</option>
                                    <option value="20">{t('slotMins').replace('{mins}', '20')}</option>
                                    <option value="30">{t('slotMins').replace('{mins}', '30')}</option>
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
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('timings')}</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-6">
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-400 uppercase block pl-1">{t('morningShift')}</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="time"
                                    value={settingsData.morning_start}
                                    onChange={(e) => setSettingsData({ ...settingsData, morning_start: e.target.value })}
                                    disabled={isReadOnly}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center disabled:opacity-70"
                                />
                                <span className="text-slate-300 font-bold">-</span>
                                <Input
                                    type="time"
                                    value={settingsData.morning_end}
                                    onChange={(e) => setSettingsData({ ...settingsData, morning_end: e.target.value })}
                                    disabled={isReadOnly}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center disabled:opacity-70"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-400 uppercase block pl-1">{t('eveningShift')}</Label>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="time"
                                    value={settingsData.evening_start}
                                    onChange={(e) => setSettingsData({ ...settingsData, evening_start: e.target.value })}
                                    disabled={isReadOnly}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center disabled:opacity-70"
                                />
                                <span className="text-slate-300 font-bold">-</span>
                                <Input
                                    type="time"
                                    value={settingsData.evening_end}
                                    onChange={(e) => setSettingsData({ ...settingsData, evening_end: e.target.value })}
                                    disabled={isReadOnly}
                                    className="h-12 bg-slate-50 border-0 rounded-xl font-medium focus-visible:ring-blue-500 text-center disabled:opacity-70"
                                />
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Notifications Section */}
                {/* <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 px-1">
                        <Bell className="h-4 w-4 text-blue-500" />
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('notifications')}</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">{t('whatsappConfirmations')}</Label>
                                <p className="text-xs text-slate-400 font-medium">{t('sendAppointmentDetails')}</p>
                            </div>
                            <Switch
                                checked={settingsData.send_confirmations}
                                onCheckedChange={(checked) => setSettingsData({ ...settingsData, send_confirmations: checked })}
                                disabled={isReadOnly}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">{t('autoReminders')}</Label>
                                <p className="text-xs text-slate-400 font-medium">{t('sendReminderOneHour')}</p>
                            </div>
                            <Switch
                                checked={settingsData.send_reminders}
                                onCheckedChange={(checked) => setSettingsData({ ...settingsData, send_reminders: checked })}
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>
                </motion.section> */}
                {/* Staff Management Section (Doctors Only) */}
                {!isReadOnly && (
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('staff')}</h2>
                            </div>
                            <Dialog open={showAddStaffDialog} onOpenChange={setShowAddStaffDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 rounded-lg text-blue-600 font-bold gap-1 hover:bg-blue-50">
                                        <Plus className="w-4 h-4" />
                                        {t('addStaff')}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-[2rem] p-6">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-black text-slate-800">{t('addStaffMember')}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleAddStaff} className="space-y-4 mt-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('fullName')}</Label>
                                            <Input
                                                required
                                                value={newStaffData.name}
                                                onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                                                placeholder="e.g. John Doe"
                                                className="h-12 bg-slate-50 border-0 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('emailAddress')}</Label>
                                            <Input
                                                required
                                                type="email"
                                                value={newStaffData.email}
                                                onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                                                placeholder="staff@clinic.com"
                                                className="h-12 bg-slate-50 border-0 rounded-xl"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium bg-slate-50 p-3 rounded-xl">
                                            {t('staffPasswordNote')}
                                        </p>
                                        <Button
                                            type="submit"
                                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold"
                                            disabled={creatingStaff}
                                        >
                                            {creatingStaff ? t('creating') : t('createStaffUser')}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="bg-white p-2 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50">
                            {staffList.length === 0 ? (
                                <div className="py-8 text-center space-y-2">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                                        <Users className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-400">{t('noStaffAdded')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {staffList.map((staff) => (
                                        <div key={staff.id} className="p-4 flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                                    <span className="text-sm font-bold text-blue-600 uppercase">
                                                        {(staff.full_name || staff.email || 'S')[0]}
                                                    </span>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-bold text-slate-700">{staff.full_name || 'Staff Member'}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-400 font-medium">{staff.email}</span>
                                                        {staff.mobile && <span className="text-[10px] text-slate-400 font-medium">• {staff.mobile}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={staff.is_active ?? true}
                                                    onCheckedChange={() => handleToggleStaffStatus(staff.id, staff.is_active ?? true)}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    onClick={() => handleDeleteStaff(staff.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.section>
                )}

                {/* Security Section */}
                {/* Security Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 px-1">
                        <Lock className="h-4 w-4 text-blue-500" />
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('security')}</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-700">{t('accountPassword')}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{t('keepAccountSecure')}</p>
                            </div>
                            <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 font-bold text-slate-600 border-slate-200">
                                        <Key className="w-4 h-4 mr-2" />
                                        {t('changePassword')}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-[2rem] p-6">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-black text-slate-800">{t('updatePassword')}</DialogTitle>
                                    </DialogHeader>
                                    <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('newPassword')}</Label>
                                            <div className="relative">
                                                <Input
                                                    required
                                                    type={showPass ? "text" : "password"}
                                                    value={passwords.new}
                                                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                                    placeholder="••••••••"
                                                    className="h-12 bg-slate-50 border-0 rounded-xl pr-12"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPass(!showPass)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('confirmPassword')}</Label>
                                            <div className="relative">
                                                <Input
                                                    required
                                                    type={showConfirmPass ? "text" : "password"}
                                                    value={passwords.confirm}
                                                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                                    placeholder="••••••••"
                                                    className="h-12 bg-slate-50 border-0 rounded-xl pr-12"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <Button
                                            type="submit"
                                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold"
                                            disabled={updatingPassword}
                                        >
                                            {updatingPassword ? t('updating') : t('updatePassword')}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </motion.section>

                {/* Language Settings */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="space-y-4"
                >
                    <div className="flex items-center gap-2 px-1">
                        <Languages className="h-4 w-4 text-blue-500" />
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('language')}</h2>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-slate-700">{t('language')}</Label>
                                <p className="text-xs text-slate-400 font-medium">{t('preferredLanguage')}</p>
                            </div>
                            <div className="flex bg-slate-50 p-1 rounded-xl">
                                <button
                                    onClick={() => setLanguage('en')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                                        language === 'en' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                                    )}
                                >
                                    English
                                </button>
                                <button
                                    onClick={() => setLanguage('hi')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                                        language === 'hi' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                                    )}
                                >
                                    हिंदी
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.section>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="pt-4 space-y-4"
                >
                    {!isReadOnly && (
                        <Button
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-200 text-base font-bold tracking-wide transition-transform active:scale-95"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{t('saving')}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Save className="w-5 h-5" />
                                    <span>{t('save')}</span>
                                </div>
                            )}
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        className="w-full h-14 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-2xl text-sm font-bold tracking-wide"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-5 h-5 mr-2" />
                        {t('logout')}
                    </Button>
                </motion.div>

                {/* Staff Password Success Dialog */}
                <Dialog open={showPasswordDialog} onOpenChange={(open) => {
                    setShowPasswordDialog(open)
                    if (!open) {
                        setCreatedStaffCredentials(null)
                        setPasswordCopied(false)
                    }
                }}>
                    <DialogContent className="rounded-[2rem] p-0 overflow-hidden max-w-md">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", duration: 0.5 }}
                                className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200"
                            >
                                <CheckCircle2 className="w-8 h-8 text-white" />
                            </motion.div>
                            <DialogTitle className="text-2xl font-black text-slate-800 mb-2">{t('staffCreated')}</DialogTitle>
                            <p className="text-sm text-slate-600 font-medium">{t('shareCredentials')}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('email')}</Label>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-sm font-bold text-slate-700">{createdStaffCredentials?.email}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-500 uppercase">{t('temporaryPassword')}</Label>
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between gap-3">
                                    <code className="text-lg font-black text-amber-900 tracking-wider">{createdStaffCredentials?.password}</code>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleCopyPassword}
                                        className={cn(
                                            "h-9 rounded-lg font-bold transition-all",
                                            passwordCopied
                                                ? "bg-green-500 hover:bg-green-600"
                                                : "bg-blue-600 hover:bg-blue-700"
                                        )}
                                    >
                                        {passwordCopied ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                {t('copied')}
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 mr-2" />
                                                {t('copy')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                                    <span className="font-bold">⚠️ {t('important')}</span> {t('sharePasswordNote')}
                                </p>
                            </div>

                            <Button
                                onClick={() => setShowPasswordDialog(false)}
                                className="w-full h-12 bg-slate-800 hover:bg-slate-900 rounded-xl font-bold"
                            >
                                {t('done')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

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
                        className="flex flex-col items-center justify-center gap-1 group relative transition-all duration-300"
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
                        className="flex flex-col items-center justify-center gap-1 group relative"
                    >
                        <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-blue-100",
                            "bg-blue-600 text-white"
                        )}>
                            <Settings className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-blue-600">{t('settings')}</span>
                    </button>
                </div>
            </nav>
        </PageTransition>
    )
}
