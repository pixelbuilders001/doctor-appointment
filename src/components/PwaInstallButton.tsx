'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

export default function PwaInstallButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isInstalling, setIsInstalling] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)
    const { toast } = useToast()

    const updatePrompt = () => {
        if ((window as any).deferredPrompt) {
            setDeferredPrompt((window as any).deferredPrompt)
        }
    }

    useEffect(() => {
        setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone)

        updatePrompt()
        window.addEventListener('pwa-installable', updatePrompt)
        window.addEventListener('beforeinstallprompt', updatePrompt)

        return () => {
            window.removeEventListener('pwa-installable', updatePrompt)
            window.removeEventListener('beforeinstallprompt', updatePrompt)
        }
    }, [])

    const handleInstallClick = async () => {
        const prompt = deferredPrompt || (window as any).deferredPrompt

        if (!prompt) {
            toast({
                title: "Preparing Download...",
                description: "The browser is finalizing the app. Please wait a few seconds or use 'Add to Home Screen' if this is an iPhone.",
            })
            return
        }

        try {
            setIsInstalling(true)
            await prompt.prompt()
            const { outcome } = await prompt.userChoice

            if (outcome === 'accepted') {
                setDeferredPrompt(null)
                    ; (window as any).deferredPrompt = null
            }
        } catch (err) {
            console.error('Installation failed:', err)
        } finally {
            setIsInstalling(false)
        }
    }

    if (isStandalone) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
            >
                <Button
                    onClick={handleInstallClick}
                    disabled={isInstalling}
                    variant="outline"
                    className="h-8 px-2.5 bg-blue-50/50 border-blue-100/50 hover:bg-blue-100 hover:border-blue-200 text-blue-600 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-none"
                >
                    {isInstalling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                        </>
                    )}
                </Button>
            </motion.div>
        </AnimatePresence>
    )
}
