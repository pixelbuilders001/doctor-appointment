'use client'

import { useEffect } from 'react'

export default function PwaHandler() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Register Service Worker
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker
                        .register('/sw.js')
                        .then((reg) => console.log('SW registered:', reg))
                        .catch((err) => console.log('SW registration failed:', err))
                })
            }

            // Capture Install Prompt
            const handleBeforeInstallPrompt = (e: any) => {
                e.preventDefault()
                    ; (window as any).deferredPrompt = e
                // Dispatch custom event to notify components
                window.dispatchEvent(new CustomEvent('pwa-installable'))
            }

            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

            return () => {
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
            }
        }
    }, [])

    return null
}
