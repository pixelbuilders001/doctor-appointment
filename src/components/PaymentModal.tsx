'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Banknote, QrCode as QrCodeIcon } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getPrimaryQrCode } from '@/app/actions/appointments'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
    appointmentId: string
    clinicId: string
    patientName: string
    onPaymentComplete: () => void
}

export default function PaymentModal({
    isOpen,
    onClose,
    appointmentId,
    clinicId,
    patientName,
    onPaymentComplete
}: PaymentModalProps) {
    const [qrCode, setQrCode] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const { toast } = useToast()
    const supabase = createClient()
    const { t } = useLanguage()

    useEffect(() => {
        if (isOpen && clinicId) {
            loadQrCode()
        }
    }, [isOpen, clinicId])

    const loadQrCode = async () => {
        setLoading(true)
        const result = await getPrimaryQrCode(clinicId)
        if (result.data) {
            setQrCode(result.data)
        }
        setLoading(false)
    }

    const handlePayment = async (method: 'cash' | 'upi') => {
        setProcessing(true)
        try {
            // Fetch consultation fee from clinics table
            const { data: clinic } = await supabase
                .from('clinics')
                .select('consultation_fee')
                .eq('id', clinicId)
                .single()

            const fee = clinic?.consultation_fee || 0

            const { error } = await supabase
                .from('appointments')
                .update({
                    payment_status: 'paid',
                    payment_method: method,
                    fee: fee
                })
                .eq('id', appointmentId)

            if (error) throw error

            toast({
                title: t('paymentRecorded'),
                description: t('paymentRecordedDesc').replace('{method}', method.toUpperCase()),
            })

            onPaymentComplete()
            onClose()
        } catch (error: any) {
            console.error('Error:', error)
            toast({
                title: t('error'),
                description: error.message,
                variant: 'destructive'
            })
        } finally {
            setProcessing(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent showCloseButton={false} className="max-w-[340px] rounded-[2rem] p-0 border-0 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-4 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        disabled={processing}
                    >
                        <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                            <Banknote className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">{t('recordPayment')}</h2>
                            <p className="text-xs text-blue-100 font-medium truncate max-w-[200px]">{patientName}</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* QR Code Section */}
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                        </div>
                    ) : qrCode ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-50 rounded-2xl p-4 space-y-3"
                        >
                            <div className="flex items-center gap-2 justify-center">
                                <QrCodeIcon className="w-3.5 h-3.5 text-blue-600" />
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('upiPayment')}</p>
                            </div>
                            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                                <img
                                    src={qrCode.qr_image_url}
                                    alt="UPI QR Code"
                                    className="w-full max-w-[160px] mx-auto rounded-lg"
                                />
                            </div>
                            {qrCode.upi_id && (
                                <p className="text-center text-[10px] font-mono text-slate-500">
                                    {qrCode.upi_id}
                                </p>
                            )}
                        </motion.div>
                    ) : (
                        <div className="bg-slate-50 rounded-2xl p-4 text-center">
                            <QrCodeIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-medium text-slate-400">{t('noQrConfigured')}</p>
                        </div>
                    )}

                    {/* Payment Options */}
                    <div className="space-y-2.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                            {t('selectPaymentMethod')}
                        </p>

                        <div className="grid grid-cols-2 gap-2.5">
                            {/* Cash Button */}
                            <Button
                                onClick={() => handlePayment('cash')}
                                disabled={processing}
                                className={cn(
                                    "h-16 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all",
                                    "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-2 border-emerald-200",
                                    "hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100",
                                    "disabled:opacity-50"
                                )}
                            >
                                <Banknote className="w-5 h-5" />
                                <span className="text-[10px] font-black uppercase tracking-wider">{t('cash')}</span>
                            </Button>

                            {/* UPI Button */}
                            <Button
                                onClick={() => handlePayment('upi')}
                                disabled={processing || !qrCode}
                                className={cn(
                                    "h-16 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all",
                                    "bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200",
                                    "hover:border-blue-300 hover:shadow-md hover:shadow-blue-100",
                                    "disabled:opacity-50"
                                )}
                            >
                                {processing ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <QrCodeIcon className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">{t('upi')}</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        {!qrCode && (
                            <p className="text-[9px] text-center text-slate-400 font-medium leading-relaxed px-2">
                                {t('upiQrRequired')}
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
