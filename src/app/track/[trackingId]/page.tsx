'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, RefreshCw, CheckCircle2, Clock, User, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTrackingData, type TrackingData } from '@/app/actions/tracking'
import PageTransition from '@/components/PageTransition'
import { cn } from '@/lib/utils'

interface TrackingPageProps {
    params: Promise<{ trackingId: string }>
}

export default function TrackingPage({ params }: TrackingPageProps) {
    const { trackingId } = use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<TrackingData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    const loadData = async (isRefreshing = false) => {
        if (!isRefreshing) setLoading(true)
        else setRefreshing(true)

        try {
            const result = await getTrackingData(trackingId)
            if (result.error) {
                setError(result.error)
            } else {
                setData(result.data || null)
                setError(null)
            }
        } catch (err) {
            setError('Failed to load tracking information')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        loadData()

        // Auto refresh every 30 seconds
        const interval = setInterval(() => loadData(true), 30000)
        return () => clearInterval(interval)
    }, [trackingId])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Fetching queue status...</p>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6">
                    <p className="font-bold">{error || 'Appointment Not Found'}</p>
                </div>
                <Button onClick={() => router.push('/')} variant="outline" className="rounded-2xl h-12">
                    Back to Search
                </Button>
            </div>
        )
    }

    const { appointment, current_token, clinic_name } = data
    const isCompleted = appointment.status === 'completed'
    const isOngoing = appointment.status === 'ongoing'

    // Calculate wait estimate (simple: 5-8 mins per token)
    const tokensBefore = current_token ? Math.max(0, appointment.token_number - current_token) : 0
    const estimatedWait = tokensBefore * 5

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] font-sans pb-20">
            {/* Header */}
            <div className="bg-white p-6 sticky top-0 z-10 shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Track Queue</h1>
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">{clinic_name}</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    className="rounded-full hover:bg-slate-100"
                >
                    <RefreshCw className={cn("w-5 h-5 text-slate-400", refreshing && "animate-spin")} />
                </Button>
            </div>

            <div className="p-6 max-w-lg mx-auto space-y-6">
                {/* Status Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-50 relative overflow-hidden text-center"
                >
                    <div className="absolute top-0 left-0 w-full h-2 bg-blue-100/50"></div>

                    <div className="space-y-2 mb-8">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Your Token</p>
                        <div className="relative inline-block">
                            <h2 className="text-8xl font-black text-slate-900 leading-none tabular-nums">{appointment.token_number}</h2>
                            {isCompleted && (
                                <div className="absolute -top-4 -right-8 bg-green-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <User className="w-4 h-4 text-blue-600" />
                            <p className="text-lg font-bold text-slate-700">{appointment.patient_name}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-100">
                        <div className="bg-blue-50/50 p-6 rounded-3xl">
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Now Serving</p>
                            <p className="text-4xl font-black text-blue-600 tabular-nums">
                                {current_token || '--'}
                            </p>
                        </div>
                    </div>

                    {appointment.status === 'booked' && (
                        <div className="mt-8 space-y-3">
                            {tokensBefore > 0 ? (
                                <>
                                    <div className="flex items-center justify-center gap-2 text-slate-500">
                                        <Clock className="w-4 h-4" />
                                        <span className="font-bold">{tokensBefore} people ahead of you</span>
                                    </div>
                                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                                        <p className="text-xs font-bold text-amber-700">Estimated wait: ~{estimatedWait} mins</p>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
                                    <p className="text-sm font-black text-green-700 uppercase tracking-wide">You are next!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {isCompleted && (
                        <div className="mt-8 bg-green-50 rounded-2xl p-4 border border-green-100">
                            <p className="text-sm font-black text-green-700 uppercase tracking-wide">Consultation Completed</p>
                        </div>
                    )}
                </motion.div>

                {/* Info Tip */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex gap-4 items-start">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">Please Arrive on Time</p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Queue moves rapidly. Please reach the clinic when there are 2-3 tokens left before yours.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100">
                <div className="max-w-md mx-auto">
                    <Button
                        variant="outline"
                        onClick={() => router.push(`/${data.clinic_slug}`)}
                        className="w-full h-14 rounded-2xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                    >
                        Visit Clinic Profile
                    </Button>
                </div>
            </div>
        </PageTransition>
    )
}
