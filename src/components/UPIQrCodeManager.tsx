'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    QrCode,
    Plus,
    Trash2,
    Star,
    Upload,
    Loader2,
    Check,
    X,
    CreditCard,
    Building2,
    Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import {
    getClinicQrCodes,
    createQrCode,
    deleteQrCode,
    setPrimaryQrCode,
    updateQrCode
} from '@/app/actions/payments'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

interface QrConfig {
    id: string
    qr_image_url: string
    upi_id: string | null
    payment_name: string | null
    is_primary: boolean
    status: string
}

export default function UPIQrCodeManager({ clinicId }: { clinicId: string }) {
    const { t } = useLanguage()
    const [qrCodes, setQrCodes] = useState<QrConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [settingPrimary, setSettingPrimary] = useState<string | null>(null)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [newQrData, setNewQrData] = useState({
        upi_id: '',
        is_primary: false,
        image_file: null as File | null,
    })
    const { toast } = useToast()
    const supabase = createClient()

    useEffect(() => {
        loadQrCodes()
    }, [])

    const loadQrCodes = async () => {
        setLoading(true)
        const res = await getClinicQrCodes()
        if (res.data) {
            setQrCodes(res.data)
        }
        setLoading(false)
    }

    const handleUploadImage = async (file: File) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${clinicId}/qr-${Date.now()}.${fileExt}`

        const { data, error } = await supabase.storage
            .from('upi_qr')
            .upload(fileName, file)

        if (error) throw error

        const { data: urlData, error: urlError } = await supabase.storage
            .from('upi_qr')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year expiry

        if (urlError) throw urlError

        return urlData.signedUrl
    }

    const handleAddQr = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newQrData.image_file) {
            toast({ title: t('imageRequired'), description: t('uploadQrImageError'), variant: "destructive" })
            return
        }

        setUploading(true)
        try {
            const imageUrl = await handleUploadImage(newQrData.image_file)
            const res = await createQrCode({
                qr_image_url: imageUrl,
                upi_id: newQrData.upi_id,
                is_primary: qrCodes.length === 0 ? true : newQrData.is_primary
            })

            if (res.error) throw new Error(res.error)
            toast({ title: t('success'), description: t('success') })
            setShowAddDialog(false)
            setNewQrData({
                upi_id: '',
                is_primary: false,
                image_file: null,
            })
            loadQrCodes()
        } catch (error: any) {
            toast({ title: t('error'), description: error.message, variant: "destructive" })
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id: string, path: string) => {
        try {
            const res = await deleteQrCode(id, path)
            if (res.error) throw new Error(res.error)
            toast({ title: t('success'), description: t('qrDeleted') })
            loadQrCodes()
        } catch (error: any) {
            toast({ title: t('error'), description: error.message, variant: "destructive" })
        }
    }

    const handleSetPrimary = async (id: string) => {
        setSettingPrimary(id)
        try {
            const res = await setPrimaryQrCode(id)
            if (res.error) throw new Error(res.error)
            toast({ title: t('primarySet'), description: t('primarySetDesc') })
            loadQrCodes()
        } catch (error: any) {
            toast({ title: t('error'), description: error.message, variant: "destructive" })
        } finally {
            setSettingPrimary(null)
        }
    }

    if (loading && qrCodes.length === 0) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-blue-500" />
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payment QR Codes</h2>
                </div>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-blue-600 font-bold gap-1 hover:bg-blue-50">
                            <Plus className="w-4 h-4" />
                            {t('addQr')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent showCloseButton={false} className="rounded-[2rem] p-5 max-w-[340px] border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 rounded-xl">
                                    <QrCode className="w-5 h-5 text-blue-600" />
                                </div>
                                {t('addPaymentQr')}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleAddQr} className="space-y-4 mt-4">
                            <div className="space-y-3">
                                {/* Image Upload Area */}
                                <div
                                    onClick={() => document.getElementById('qr-upload')?.click()}
                                    className={cn(
                                        "w-full h-44 bg-gradient-to-br from-slate-50 to-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all flex items-center justify-center group relative overflow-hidden",
                                        newQrData.image_file ? "border-green-200 bg-green-50/10" : "border-slate-100"
                                    )}
                                >
                                    {newQrData.image_file ? (
                                        <div className="w-full h-full relative p-2">
                                            <img
                                                src={URL.createObjectURL(newQrData.image_file)}
                                                className="w-full h-full object-contain rounded-xl"
                                                alt="QR Preview"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs backdrop-blur-[2px]">
                                                {t('changeImage')}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-50 group-hover:scale-110 transition-transform">
                                                <Upload className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-slate-600">{t('clickToUploadQr')}</p>
                                                <p className="text-[9px] font-medium text-slate-400 mt-0.5">{t('qrFileLimit')}</p>
                                            </div>
                                        </div>
                                    )}
                                    <input
                                        id="qr-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => setNewQrData({ ...newQrData, image_file: e.target.files?.[0] || null })}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('upiIdOptional')}</Label>
                                        <div className="relative group">
                                            <Input
                                                value={newQrData.upi_id}
                                                onChange={(e) => setNewQrData({ ...newQrData, upi_id: e.target.value })}
                                                placeholder="username@bank"
                                                className="h-12 bg-slate-50/50 border-slate-100 rounded-xl pl-11 text-sm font-medium focus:bg-white transition-all focus:ring-2 focus:ring-blue-50"
                                            />
                                            <CreditCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setNewQrData({ ...newQrData, is_primary: !newQrData.is_primary })}
                                    className={cn(
                                        "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                                        newQrData.is_primary ? "bg-blue-50/50 border-blue-100" : "bg-slate-50/50 border-slate-50 hover:bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                                            newQrData.is_primary ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white text-slate-400"
                                        )}>
                                            <Star className={cn("w-4 h-4 fill-current", !newQrData.is_primary && "text-transparent")} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700">{t('setAsPrimary')}</p>
                                            <p className="text-[9px] font-medium text-slate-400">{t('shownToPatients')}</p>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                        newQrData.is_primary ? "bg-blue-600 border-blue-600" : "border-slate-200 bg-white"
                                    )}>
                                        {newQrData.is_primary && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 active:scale-95 transition-all gap-2"
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('uploading')}
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        {t('saveQrCode')}
                                    </>
                                )}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white p-2 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-50 overflow-hidden">
                {qrCodes.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                        <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <QrCode className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-bold">{t('noQrCodes')}</h3>
                        <p className="text-slate-500 text-xs max-w-[200px] mx-auto leading-relaxed">
                            {t('noQrCodesDesc')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <AnimatePresence mode="popLayout">
                            {qrCodes.map((qr) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    key={qr.id}
                                    className={cn(
                                        "p-4 flex items-center justify-between group rounded-2xl transition-all",
                                        qr.is_primary ? "bg-blue-50/30 ring-1 ring-blue-100" : "hover:bg-slate-50/50"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-2xl bg-white p-1 border border-slate-100 shadow-sm overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform cursor-pointer"
                                                onClick={() => window.open(qr.qr_image_url, '_blank')}
                                            >
                                                <img src={qr.qr_image_url} alt="QR" className="w-full h-full object-contain" />
                                            </div>
                                            {qr.is_primary && (
                                                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                                    <Star className="w-3 h-3 text-white fill-current" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-slate-700 leading-none">
                                                {qr.upi_id || 'UPI Payment'}
                                                {qr.is_primary && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-[9px] text-blue-600 rounded-full font-black uppercase">Primary</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!qr.is_primary && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                                                onClick={() => handleSetPrimary(qr.id)}
                                                disabled={settingPrimary === qr.id}
                                                title="Set as Default"
                                            >
                                                {settingPrimary === qr.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Star className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                                            onClick={() => handleDelete(qr.id, qr.qr_image_url)}
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>


        </div>
    )
}
