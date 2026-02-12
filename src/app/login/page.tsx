'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Eye, EyeOff, Building, ArrowRight, Sparkles } from 'lucide-react'
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
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-950">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [0, 100, 0],
                        y: [0, 50, 0],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        rotate: [0, -90, 0],
                        x: [0, -100, 0],
                        y: [0, -50, 0],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-indigo-600/20 blur-[120px] rounded-full"
                />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 pointer-events-none" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-[440px] z-10"
            >
                <div className="relative group">
                    {/* Glassmorphic Card */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />

                    <div className="relative bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="text-center mb-8 space-y-3">
                            <motion.div
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4"
                            >
                                <Sparkles className="w-8 h-8 text-white" />
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-3xl font-black text-white tracking-tight"
                            >
                                ClinicFlow
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-slate-400 text-sm font-medium"
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
                                        className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-xs font-bold leading-relaxed overflow-hidden"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={isSignUp ? 'signup' : 'signin'}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-4"
                                >
                                    {isSignUp && (
                                        <div className="space-y-1.5 px-1">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                                                {t('clinicName')}
                                            </Label>
                                            <div className="relative group/input">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-blue-500 text-slate-500">
                                                    <Building className="h-4 w-4" />
                                                </div>
                                                <Input
                                                    type="text"
                                                    placeholder="Healing Hands Clinic"
                                                    value={clinicName}
                                                    onChange={(e) => setClinicName(e.target.value)}
                                                    className="bg-white/5 border-white/5 hover:border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 h-12 rounded-2xl pl-11 transition-all duration-300 text-white placeholder:text-slate-600"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 px-1">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                                            {t('email')}
                                        </Label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-blue-500 text-slate-500">
                                                <Mail className="h-4 w-4" />
                                            </div>
                                            <Input
                                                type="email"
                                                placeholder="doctor@clinicflow.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="bg-white/5 border-white/5 hover:border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 h-12 rounded-2xl pl-11 transition-all duration-300 text-white placeholder:text-slate-600"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 px-1">
                                        <div className="flex justify-between items-center ml-1">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                {t('password')}
                                            </Label>
                                            {!isSignUp && (
                                                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors">
                                                    {t('forgotPassword')}
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-blue-500 text-slate-500">
                                                <Lock className="h-4 w-4" />
                                            </div>
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="bg-white/5 border-white/5 hover:border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 h-12 rounded-2xl pl-11 pr-11 transition-all duration-300 text-white placeholder:text-slate-600"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-blue-500 transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="pt-2"
                            >
                                <Button
                                    type="submit"
                                    className="w-full h-13 group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-500/25 transition-all duration-300 active:scale-[0.98] border-0"
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
                                transition={{ delay: 0.6 }}
                                className="text-center"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(!isSignUp)
                                        setError('')
                                    }}
                                    className="text-xs text-slate-500 font-bold hover:text-blue-500 transition-colors"
                                >
                                    {isSignUp ? t('alreadyHaveAccount') : t('dontHaveAccount')}
                                </button>
                            </motion.div>
                        </form>

                        {/* Status Bar */}
                        {/* <div className="mt-8 pt-6 border-t border-white/5 flex justify-center items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Systems Active</span>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-slate-800" />
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">v2.4.0</span>
                            </div>
                        </div> */}
                    </div>
                </div>

                {/* Footer Help */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-8 text-center"
                >
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Need assistance? <a href="mailto:support@clinicflow.com" className="text-blue-500 hover:underline">Contact Support</a>
                    </p>
                </motion.div>
            </motion.div>
        </div>
    )
}
