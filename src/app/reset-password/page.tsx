'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import { motion, AnimatePresence } from 'framer-motion'
import ModernLoader from '@/components/ModernLoader'
import PageTransition from '@/components/PageTransition'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isSuccess, setIsSuccess] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)

    const router = useRouter()
    const supabase = createClient()
    const { t } = useLanguage()
    const { toast } = useToast()

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                // If no session, they might have clicked an expired link or are accessing directly
                // Supabase usually sets a session from the hash fragment automatically
                // But if it's missing, we wait a bit or redirect
                setTimeout(() => setInitialLoading(false), 1000)
            } else {
                setInitialLoading(false)
            }
        }
        checkSession()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setError(t('error')) // We could add a specific mismatch translation
            toast({
                title: t('error'),
                description: "Passwords do not match",
                variant: "destructive"
            })
            return
        }

        setLoading(true)
        setError('')

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            })

            if (updateError) {
                setError(updateError.message)
                return
            }

            setIsSuccess(true)
            toast({
                title: t('success'),
                description: "Password updated successfully!",
            })

            setTimeout(() => {
                router.push('/login')
            }, 3000)
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    if (initialLoading) return <ModernLoader />

    return (
        <PageTransition>
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 md:p-6 font-sans">
                {/* Background decorative elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full max-w-[440px] z-10"
                >
                    <div className="relative">
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
                                        className="w-32 h-auto object-contain drop-shadow-sm"
                                    />
                                </motion.div>

                                <motion.p
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-slate-500 text-sm font-medium"
                                >
                                    {t('resetPassword')}
                                </motion.p>
                            </div>

                            {isSuccess ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-green-50 border border-green-100 text-green-600 px-4 py-8 rounded-2xl text-center"
                                >
                                    <p className="text-sm font-bold leading-relaxed mb-4">
                                        Password updated successfully!
                                    </p>
                                    <p className="text-xs font-medium text-green-500">
                                        Redirecting to login...
                                    </p>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <AnimatePresence mode="wait">
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl text-xs font-bold leading-relaxed"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="space-y-1.5 px-0.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                            {t('newPassword')}
                                        </Label>
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

                                    <div className="space-y-1.5 px-0.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                            {t('confirmPassword')}
                                        </Label>
                                        <div className="relative group/input">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within/input:text-blue-500 text-slate-400">
                                                <Lock className="h-4 w-4" />
                                            </div>
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="bg-slate-50 border-slate-100 hover:border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 h-12 rounded-2xl pl-11 pr-11 transition-all duration-300 text-slate-900 placeholder:text-slate-400"
                                                required
                                                minLength={6}
                                            />
                                        </div>
                                    </div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4 }}
                                        className="pt-2"
                                    >
                                        <Button
                                            type="submit"
                                            className="w-full h-13 group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl shadow-xl shadow-blue-500/15 transition-all duration-300 active:scale-[0.98] border-0"
                                            disabled={loading || password.length < 6 || password !== confirmPassword}
                                        >
                                            <span className="flex items-center gap-2">
                                                {loading ? (
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        {t('updatePassword')}
                                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                                    </>
                                                )}
                                            </span>
                                        </Button>
                                    </motion.div>
                                </form>
                            )}
                        </div>
                    </div>

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
        </PageTransition>
    )
}
