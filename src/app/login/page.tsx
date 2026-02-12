'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Eye, EyeOff, Building, ArrowRight, Sparkles, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [clinicName, setClinicName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    const { t } = useLanguage()
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            if (isSignUp) {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                })

                if (signUpError) {
                    setError(signUpError.message)
                    return
                }

                if (data.user) {
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    const doctorName = email.split('@')[0]
                    const slug = clinicName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7)

                    const { data: clinic, error: clinicError } = await supabase
                        .from('clinics')
                        .insert({
                            name: clinicName,
                            doctor_name: doctorName,
                            slug: slug,
                            mobile: null,
                            consultation_fee: 500,
                        })
                        .select()
                        .single()

                    if (clinicError) {
                        setError('Failed to create clinic: ' + clinicError.message)
                        return
                    }

                    if (clinic) {
                        await supabase.from('users').insert({
                            id: data.user.id,
                            clinic_id: clinic.id,
                            mobile: null,
                            role: 'doctor',
                        })
                        await supabase.from('clinic_settings').insert({
                            clinic_id: clinic.id,
                        })
                    }

                    toast({
                        title: "Account Created",
                        description: "Your account has been created successfully! Please login.",
                    })
                    setIsSignUp(false)
                    setEmail('')
                    setPassword('')
                }
            } else {
                const { data, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })

                if (signInError) {
                    setError(signInError.message)
                    return
                }

                if (data.user) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .maybeSingle()

                    if (!userData) {
                        const doctorName = email.split('@')[0]
                        const slug = clinicName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7)
                        const { data: clinic } = await supabase
                            .from('clinics')
                            .insert({
                                name: clinicName || 'My Clinic',
                                doctor_name: doctorName,
                                slug: slug,
                                mobile: null,
                                consultation_fee: 500,
                            })
                            .select()
                            .single()

                        if (clinic) {
                            await supabase.from('users').insert({
                                id: data.user.id,
                                clinic_id: clinic.id,
                                mobile: null,
                                role: 'doctor',
                            })
                            await supabase.from('clinic_settings').insert({
                                clinic_id: clinic.id,
                            })
                        }
                    } else if (userData.is_active === false) {
                        await supabase.auth.signOut()
                        setError(t('accountDisabled') || 'Your account is disabled. Please contact the administrator.')
                        setLoading(false)
                        return
                    }
                }
                router.push('/dashboard')
            }
        } catch (err: any) {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-50">
            {/* Soft Background Accents */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        x: [0, 30, 0],
                        y: [0, 20, 0],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[5%] -left-[5%] w-[40%] h-[40%] bg-blue-100/50 blur-[100px] rounded-full"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.15, 1],
                        x: [0, -30, 0],
                        y: [0, -20, 0],
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[5%] -right-[5%] w-[50%] h-[50%] bg-indigo-50 blur-[100px] rounded-full"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-[440px] z-10"
            >
                <div className="relative">
                    {/* Clean White Card */}
                    <div className="relative bg-white border border-slate-200/60 rounded-[2.5rem] p-8 md:p-10 shadow-[0_20px_70px_-10px_rgba(0,0,0,0.06)] overflow-hidden">
                        <div className="flex flex-col items-center mb-8 space-y-4">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5 }}
                                className="relative"
                            >
                                <img
                                    src="/images/logo.png"
                                    alt="Clinic Plus Logo"
                                    className="w-40 h-auto object-contain drop-shadow-sm"
                                />
                            </motion.div>

                            {/* <motion.h1
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-3xl font-black text-slate-900 tracking-tight"
                            >
                                Clinic Plus
                            </motion.h1> */}

                            <motion.p
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-slate-500 text-sm font-medium"
                            >
                                {isSignUp ? t('createYourAccount') : t('welcomeBack')}
                            </motion.p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <AnimatePresence mode="wait">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                        animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                        className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-xs font-bold leading-relaxed overflow-hidden"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={isSignUp ? 'signup' : 'signin'}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    {isSignUp && (
                                        <div className="space-y-1.5 px-0.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                                {t('clinicName')}
                                            </Label>
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-blue-500 text-slate-400">
                                                    <Building className="h-4 w-4" />
                                                </div>
                                                <Input
                                                    type="text"
                                                    placeholder="Healing Hands Clinic"
                                                    value={clinicName}
                                                    onChange={(e) => setClinicName(e.target.value)}
                                                    className="bg-slate-50 border-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 h-12 rounded-2xl pl-11 transition-all duration-300 text-slate-900 placeholder:text-slate-400"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 px-0.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                            {t('email')}
                                        </Label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-blue-500 text-slate-400">
                                                <Mail className="h-4 w-4" />
                                            </div>
                                            <Input
                                                type="email"
                                                placeholder="doctor@clinicplus.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="bg-slate-50 border-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 h-12 rounded-2xl pl-11 transition-all duration-300 text-slate-900 placeholder:text-slate-400"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 px-0.5">
                                        <div className="flex justify-between items-center ml-1">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {t('password')}
                                            </Label>
                                            {!isSignUp && (
                                                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-colors">
                                                    {t('forgotPassword')}
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-blue-500 text-slate-400">
                                                <Lock className="h-4 w-4" />
                                            </div>
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="bg-slate-50 border-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 h-12 rounded-2xl pl-11 pr-11 transition-all duration-300 text-slate-900 placeholder:text-slate-400"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="pt-2"
                            >
                                <Button
                                    type="submit"
                                    className="w-full h-13 group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl shadow-xl shadow-blue-500/15 transition-all duration-300 active:scale-[0.98] border-0"
                                    disabled={loading || !email || password.length < 6}
                                >
                                    <span className="flex items-center gap-2">
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                {isSignUp ? t('createAccount') : t('signIn')}
                                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </>
                                        )}
                                    </span>
                                </Button>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-center"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(!isSignUp)
                                        setError('')
                                    }}
                                    className="text-xs text-slate-500 font-bold hover:text-blue-600 transition-colors"
                                >
                                    {isSignUp ? t('alreadyHaveAccount') : t('dontHaveAccount')}
                                </button>
                            </motion.div>
                        </form>
                    </div>
                </div>

                {/* Footer Help */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-10 text-center"
                >
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Need assistance? <a href="mailto:support@clinicplus.com" className="text-blue-600 hover:underline">Contact Support</a>
                    </p>
                </motion.div>
            </motion.div>
        </div>
    )
}
