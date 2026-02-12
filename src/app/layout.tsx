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
    icon: [
      { url: '/images/favicon-48x48.png', sizes: '48x48' },
      { url: '/images/icon-72x72.png', sizes: '72x72' },
      { url: '/images/icon-192x192.png', sizes: '192x192' },
    ],
    shortcut: '/images/icon-192x192.png',
    apple: '/images/icon-192x192.png',
  },
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clinic Plus',
    startupImage: '/images/icon-512x512.png',
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
