'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    TrendingUp,
    TrendingDown,
    Users,
    Banknote,
    QrCode,
    ChevronRight,
    Calendar as CalendarIcon,
    Search,
    ArrowUpRight,
    ArrowDownLeft,
    Filter
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth, isToday, isYesterday, subDays } from 'date-fns'
import PageTransition from '@/components/PageTransition'
import ModernLoader from '@/components/ModernLoader'
import BottomNav from '@/components/BottomNav'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EarningRecord {
    id: string
    patient_name: string
    appointment_date: string
    payment_method: 'cash' | 'upi'
    fee: number
    payment_status: 'paid'
}

export default function EarningsPage() {
    const { t } = useLanguage()
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [clinicId, setClinicId] = useState<string | null>(null)
    const [earnings, setEarnings] = useState<EarningRecord[]>([])
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [stats, setStats] = useState({
        total: 0,
        cash: 0,
        upi: 0,
        count: 0
    })

    const PAGE_SIZE = 10

    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role, clinic_id')
            .eq('id', user.id)
            .single()

        if (userData) {
            if (userData.role !== 'doctor') {
                router.push('/dashboard')
                return
            }
            setUserRole(userData.role)
            setClinicId(userData.clinic_id)
            // Initial fetch
            refreshData(userData.clinic_id, selectedDate, searchQuery)
        }
    }

    const refreshData = async (cid: string, date: string, query: string) => {
        setLoading(true)
        setPage(0)
        setHasMore(true)
        await Promise.all([
            fetchStats(cid, date),
            fetchEarnings(cid, date, query, 0, true)
        ])
        setLoading(false)
    }

    const fetchStats = async (cid: string, date: string) => {
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select('fee, payment_method')
                .eq('clinic_id', cid)
                .eq('payment_status', 'paid')
                .eq('appointment_date', date)

            if (error) throw error

            const records = data || []
            const newStats = records.reduce((acc, curr) => {
                acc.total += curr.fee || 0
                if (curr.payment_method === 'cash') acc.cash += curr.fee || 0
                if (curr.payment_method === 'upi') acc.upi += curr.fee || 0
                acc.count += 1
                return acc
            }, { total: 0, cash: 0, upi: 0, count: 0 })
            setStats(newStats)
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    const fetchEarnings = async (cid: string, date: string, query: string, pageNum: number, isRefresh = false) => {
        try {
            let dbQuery = supabase
                .from('appointments')
                .select('id, patient_name, appointment_date, payment_method, fee, payment_status')
                .eq('clinic_id', cid)
                .eq('payment_status', 'paid')
                .eq('appointment_date', date)
                .order('created_at', { ascending: false })
                .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

            if (query.trim()) {
                dbQuery = dbQuery.ilike('patient_name', `%${query}%`)
            }

            const { data, error } = await dbQuery

            if (error) throw error

            const records = data as EarningRecord[]
            if (isRefresh) {
                setEarnings(records)
            } else {
                setEarnings(prev => [...prev, ...records])
            }
            setHasMore(records.length === PAGE_SIZE)
        } catch (error) {
            console.error('Error fetching earnings:', error)
        }
    }

    const loadMore = async () => {
        if (!clinicId || loadingMore || !hasMore) return
        setLoadingMore(true)
        const nextPage = page + 1
        await fetchEarnings(clinicId, selectedDate, searchQuery, nextPage)
        setPage(nextPage)
        setLoadingMore(false)
    }

    useEffect(() => {
        if (clinicId) {
            const timer = setTimeout(() => {
                refreshData(clinicId, selectedDate, searchQuery)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [selectedDate, searchQuery, clinicId])

    // Intersection Observer for Infinite Scroll
    const lastElementRef = useCallback((node: HTMLDivElement) => {
        if (loading || loadingMore) return
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore()
            }
        })
        if (node) observer.observe(node)
    }, [loading, loadingMore, hasMore, clinicId])

    if (loading && !clinicId) return <ModernLoader />

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] pb-32 font-sans">
            {/* Header */}
            <div className="bg-white px-6 py-8 rounded-b-[2.5rem] shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t('earnings')}</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {format(new Date(selectedDate), 'MMMM dd, yyyy')}
                        </p>
                    </div>
                    <div className="relative">
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-40 h-10 text-xs font-bold border-slate-100 rounded-xl bg-slate-50 focus:ring-blue-500 pl-4 pr-10"
                        />
                        <CalendarIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>

                {/* Main Stats Card */}
                <Card className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-[2rem] border-0 shadow-xl shadow-blue-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full -ml-12 -mb-12 blur-xl" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-xs font-bold text-blue-100 uppercase tracking-widest">{t('totalEarnings')}</span>
                        </div>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-white tracking-tight">₹{stats.total.toLocaleString()}</span>
                            <div className="mb-1.5 flex items-center text-[10px] font-black text-blue-100 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                <Users className="w-3 h-3 mr-1" />
                                {stats.count} {t('completed')}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Split Stats */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <Card className="p-4 rounded-3xl border-slate-50 bg-white shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                            <Banknote className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('cashEarnings')}</p>
                            <p className="text-lg font-black text-slate-700">₹{stats.cash.toLocaleString()}</p>
                        </div>
                    </Card>
                    <Card className="p-4 rounded-3xl border-slate-50 bg-white shadow-sm flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                            <QrCode className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('upiEarnings')}</p>
                            <p className="text-lg font-black text-slate-700">₹{stats.upi.toLocaleString()}</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Patient List */}
            <div className="mt-8 px-6">
                <div className="flex items-center justify-between mb-6 px-1">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('paymentHistory')}</h2>
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            placeholder={t('searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 w-40 pl-9 pr-4 bg-white border-0 rounded-xl text-[10px] font-bold shadow-sm focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : earnings.length > 0 ? (
                        <>
                            <AnimatePresence mode='popLayout'>
                                {earnings.map((record, index) => (
                                    <motion.div
                                        key={record.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (index % PAGE_SIZE) * 0.05 }}
                                        className="bg-white p-4 rounded-3xl shadow-sm border border-slate-50 flex items-center justify-between"
                                        ref={index === earnings.length - 1 ? lastElementRef : null}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                                                record.payment_method === 'cash' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                                            )}>
                                                {record.payment_method === 'cash' ? <Banknote className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-black text-slate-700 leading-tight">{record.patient_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                    {record.payment_method === 'cash' ? t('cash') : t('upi')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-black text-slate-800 tracking-tight">₹{record.fee}</p>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{t('paid')}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {loadingMore && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <TrendingUp className="w-7 h-7 text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-medium text-sm">{t('noEarnings')}</p>
                        </div>
                    )}
                </div>
            </div>

            <BottomNav role={userRole} />
        </PageTransition>
    )
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("animate-spin", className)}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
