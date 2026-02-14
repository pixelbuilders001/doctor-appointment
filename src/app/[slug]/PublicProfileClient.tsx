'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MapPin, Clock, Phone, Star, ShieldCheck, ArrowRight, Share2, Search, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { ClinicData } from '@/app/actions/public-profile'
import { useRouter } from 'next/navigation'
import PageTransition from '@/components/PageTransition'
import { useToast } from '@/hooks/use-toast'

interface Props {
    clinic: ClinicData
    slug: string
}

export default function PublicProfileClient({ clinic, slug }: Props) {
    const router = useRouter()
    const { toast } = useToast()
    const { clinic_settings } = clinic
    const [isTrackOpen, setIsTrackOpen] = React.useState(false)
    const [inputTrackingId, setInputTrackingId] = React.useState('')

    // Extract Lat/Long from Google Maps URL if possible
    const getEmbedUrl = () => {
        const mapsLink = clinic.maps_link || ''

        // Try to match @lat,long
        const atMatch = mapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
        if (atMatch) {
            return `https://www.google.com/maps?q=${encodeURIComponent(clinic.name)}@${atMatch[1]},${atMatch[2]}&z=15&output=embed`
        }

        // Try to match q=lat,long
        const qMatch = mapsLink.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
        if (qMatch) {
            return `https://www.google.com/maps?q=${encodeURIComponent(clinic.name)}@${qMatch[1]},${qMatch[2]}&z=15&output=embed`
        }

        // Try to match search/place results with coordinates
        const placeMatch = mapsLink.match(/(-?\d+\.\d+),(-?\d+\.\d+)/)
        if (placeMatch) {
            return `https://www.google.com/maps?q=${encodeURIComponent(clinic.name)}@${placeMatch[1]},${placeMatch[2]}&z=15&output=embed`
        }

        // Fallback to address search (explicitly set zoom and map type)
        return `https://www.google.com/maps?q=${encodeURIComponent(clinic.name + ' ' + (clinic.address || ''))}&t=m&z=15&output=embed`
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    }

    const shareProfile = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Book ${clinic.doctor_name}`,
                    text: `Book an appointment with ${clinic.doctor_name} at ${clinic.name}`,
                    url: window.location.href,
                })
            } catch (error) {
                console.log('Error sharing:', error)
            }
        } else {
            navigator.clipboard.writeText(window.location.href)
            toast({
                title: "Link Copied",
                description: "Clinic profile link copied to clipboard!",
            })
        }
    }

    const handleTrackSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputTrackingId.trim()) return

        const cleanId = inputTrackingId.trim().toUpperCase()
        if (!cleanId.startsWith('TK-') && cleanId.length > 0) {
            router.push(`/track/TK-${cleanId}`)
        } else {
            router.push(`/track/${cleanId}`)
        }
        setIsTrackOpen(false)
    }

    return (
        <PageTransition className="min-h-screen bg-[#F8F9FD] pb-24 font-sans relative">
            {/* Header Image / Gradient */}
            <div className="h-56 relative overflow-hidden rounded-b-[2.5rem] shadow-lg">
                {clinic.clinic_banner ? (
                    <img src={clinic.clinic_banner} alt={clinic.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700"></div>
                        <div className="absolute inset-0 bg-white/10 opacity-50 backdrop-blur-3xl"></div>
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>
                    </>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>

                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    <Dialog open={isTrackOpen} onOpenChange={setIsTrackOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 px-3.5 text-white hover:bg-white/20 rounded-full font-bold text-xs flex items-center gap-1.5"
                            >
                                <Search className="w-4 h-4" />
                                <span>Track</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-slate-800">Track Appointment</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleTrackSubmit} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-slate-500">Enter your Tracking ID to view status</p>
                                    <div className="relative">
                                        <Hash className="absolute left-4 top-4 w-5 h-5 text-slate-300" />
                                        <Input
                                            value={inputTrackingId}
                                            onChange={(e) => setInputTrackingId(e.target.value)}
                                            placeholder="e.g. 7F3K9Q"
                                            className="h-14 rounded-2xl border-slate-100 bg-slate-50 pl-12 text-lg font-bold placeholder:text-slate-300 focus:ring-blue-600 transition-all"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium pl-1 italic">
                                        * Tracking ID was shown on your booking confirmation screen.
                                    </p>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={!inputTrackingId.trim()}
                                    className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-100 disabled:opacity-50"
                                >
                                    Track Now
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 rounded-full h-10 w-10 shrink-0"
                        onClick={shareProfile}
                    >
                        <Share2 className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div className="px-6 -mt-16 relative z-10">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="w-32 h-32 rounded-[2rem] bg-white p-2 shadow-xl shadow-blue-900/5 mx-auto"
                >
                    <div className="w-full h-full bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-4xl font-bold text-blue-600 overflow-hidden relative">
                        {clinic.clinic_owner ? (
                            <img src={clinic.clinic_owner} alt={clinic.doctor_name} className="w-full h-full object-cover" />
                        ) : (
                            clinic.doctor_name.charAt(0)
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/5 to-transparent"></div>
                    </div>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="text-center mt-4 space-y-1"
                >
                    <motion.h1 variants={itemVariants} className="text-2xl font-bold text-slate-900">
                        {clinic.doctor_name}
                    </motion.h1>
                    <motion.p variants={itemVariants} className="text-blue-600 font-medium text-sm bg-blue-50 inline-block px-3 py-1 rounded-full">
                        {clinic.specialization || 'General Physician'}
                    </motion.p>
                    <motion.div variants={itemVariants} className="flex items-center justify-center gap-1 text-slate-400 text-xs mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>{clinic.name}</span>
                    </motion.div>
                </motion.div>

                {/* Stats / Quick Info */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-3 gap-3 mt-8"
                >
                    <motion.div variants={itemVariants} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-50 text-center flex flex-col items-center justify-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-1">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Verified</span>
                        <span className="text-xs font-bold text-slate-700">Medical Reg.</span>
                    </motion.div>
                    <motion.div variants={itemVariants} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-50 text-center flex flex-col items-center justify-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-1">
                            <Star className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Rating</span>
                        <span className="text-xs font-bold text-slate-700">4.9/5.0</span>
                    </motion.div>
                    <motion.div variants={itemVariants} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-50 text-center flex flex-col items-center justify-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-1">
                            <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Exp.</span>
                        <span className="text-xs font-bold text-slate-700">10+ Years</span>
                    </motion.div>
                </motion.div>

                {/* Information Cards */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4 mt-8"
                >
                    <motion.div variants={itemVariants} className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Clinic Timings</h3>
                                <p className="text-xs text-slate-400">Visiting Hours</p>
                            </div>
                        </div>

                        <div className="space-y-3 pl-14"> {/* Indent to align with text above */}
                            {clinic_settings?.morning_start && clinic_settings?.morning_end && (
                                <div className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                    <span className="text-slate-500">Morning</span>
                                    <span className="font-bold text-slate-700">{clinic_settings.morning_start.slice(0, 5)} - {clinic_settings.morning_end.slice(0, 5)}</span>
                                </div>
                            )}
                            {clinic_settings?.evening_start && clinic_settings?.evening_end && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Evening</span>
                                    <span className="font-bold text-slate-700">{clinic_settings.evening_start.slice(0, 5)} - {clinic_settings.evening_end.slice(0, 5)}</span>
                                </div>
                            )}
                            {!clinic_settings && <p className="text-sm text-slate-500">Call for timings</p>}
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-50">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Location</h3>
                                <p className="text-xs text-slate-400">Visit Us At</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 pl-14 mb-4">{clinic.address}</p>

                        <div className="pl-14 space-y-4">
                            {/* Interactive Map Embed */}
                            <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative bg-slate-50">
                                <iframe
                                    title="Clinic Location"
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    src={getEmbedUrl()}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    className="w-full h-full"
                                ></iframe>
                            </div>

                            {clinic.maps_link && (
                                <a
                                    href={clinic.maps_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-full transition-colors"
                                >
                                    Get Directions <ArrowRight className="ml-1.5 w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Sticky Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 z-50">
                <div className="max-w-md mx-auto">
                    <Button
                        size="lg"
                        className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-200 transition-transform active:scale-95"
                        onClick={() => router.push(`/${slug}/book`)}
                    >
                        Book Appointment
                    </Button>
                </div>
            </div>
        </PageTransition>
    )
}
