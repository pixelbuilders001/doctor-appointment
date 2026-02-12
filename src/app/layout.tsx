import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { Toaster } from "@/components/ui/toaster"
import PwaHandler from '@/components/PwaHandler'

const outfit = Outfit({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Clinic Plus',
  description: 'Modern Clinic Management System',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/pwa-icon.png',
    shortcut: '/images/pwa-icon.png',
    apple: '/images/pwa-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <LanguageProvider>
          {children}
          <Toaster />
          <PwaHandler />
        </LanguageProvider>
      </body>
    </html>
  )
}
