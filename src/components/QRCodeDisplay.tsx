'use client'

import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Download, Printer, Share2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

interface QRCodeDisplayProps {
    url: string
    clinicName: string
    doctorName: string
}

export default function QRCodeDisplay({ url, clinicName, doctorName }: QRCodeDisplayProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string>('')
    const { toast } = useToast()

    useEffect(() => {
        if (url) {
            generateQR()
        }
    }, [url])

    const generateQR = async () => {
        try {
            const dataUrl = await QRCode.toDataURL(url, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#0f172a',
                    light: '#ffffff'
                }
            })
            setQrDataUrl(dataUrl)
        } catch (err) {
            console.error(err)
        }
    }

    const downloadQR = () => {
        if (!qrDataUrl) return
        const link = document.createElement('a')
        link.download = `${doctorName.replace(/\s+/g, '-').toLowerCase()}-qr.png`
        link.href = qrDataUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast({ title: "Downloaded", description: "QR Code saved to device." })
    }

    const printQR = () => {
        if (!qrDataUrl) return
        const printWindow = window.open('', '', 'height=600,width=800')
        if (!printWindow) return

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print QR Code</title>
                    <style>
                        body { 
                            font-family: sans-serif; 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            justify-content: center; 
                            height: 100vh; 
                            text-align: center;
                        }
                        img { max-width: 300px; margin-bottom: 20px; }
                        h1 { margin: 10px 0; color: #0f172a; }
                        p { color: #64748b; margin-top: 5px; }
                        .url { color: #2563eb; font-weight: bold; margin-top: 10px; }
                    </style>
                </head>
                <body>
                    <h1>${doctorName}</h1>
                    <p>${clinicName}</p>
                    <img src="${qrDataUrl}" />
                    <p>Scan to book an appointment</p>
                    <div class="url">${url}</div>
                </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
    }

    const copyLink = () => {
        navigator.clipboard.writeText(url)
        toast({ title: "Copied", description: "Booking link copied to clipboard." })
    }

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-sm font-bold text-slate-400 uppercase tracking-widest">Public Booking QR</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <div className="bg-white p-6 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col items-center gap-6">
                    {qrDataUrl ? (
                        <div className="relative group">
                            <img src={qrDataUrl} alt="Booking QR Code" className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl" />
                            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-xl pointer-events-none" />
                        </div>
                    ) : (
                        <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-100 rounded-xl animate-pulse" />
                    )}

                    <div className="flex gap-2 w-full">
                        <Button variant="outline" className="flex-1" onClick={downloadQR}>
                            <Download className="w-4 h-4 mr-2" />
                            PNG
                        </Button>
                        <Button variant="outline" size="icon" onClick={printQR} title="Print">
                            <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={copyLink} title="Copy Link">
                            <Share2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
