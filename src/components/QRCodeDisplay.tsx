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
        const printWindow = window.open('', '', 'height=800,width=1000')
        if (!printWindow) return

        printWindow.document.write(`
            <html>
                <head>
                    <title>Book Appointment - ${clinicName}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
                        
                        body { 
                            font-family: 'Outfit', sans-serif; 
                            margin: 0;
                            padding: 0;
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            justify-content: center; 
                            min-height: 100vh; 
                            background: #ffffff;
                            color: #1e293b;
                        }
                        
                        .flyer-container {
                            width: 80%;
                            max-width: 600px;
                            padding: 60px;
                            border: 2px solid #e2e8f0;
                            border-radius: 40px;
                            text-align: center;
                            position: relative;
                            background: radial-gradient(circle at top right, #eff6ff 0%, #ffffff 40%);
                            box-shadow: 0 40px 100px -20px rgba(0,0,0,0.05);
                        }

                        .logo-container {
                            margin-bottom: 30px;
                        }

                        .logo-img {
                            height: 60px;
                            width: auto;
                            object-contain: contain;
                        }

                        .header {
                            margin-bottom: 40px;
                        }

                        h1 { 
                            margin: 0; 
                            font-weight: 800; 
                            font-size: 32px;
                            color: #1e1b4b;
                            letter-spacing: -0.02em;
                            line-height: 1.2;
                        }
                        
                        .doctor-name {
                            font-size: 18px;
                            font-weight: 600;
                            color: #2563eb;
                            margin: 8px 0;
                            text-transform: uppercase;
                            letter-spacing: 0.1em;
                        }

                        .qr-section {
                            position: relative;
                            display: inline-block;
                            padding: 20px;
                            background: white;
                            border-radius: 30px;
                            border: 1px solid #f1f5f9;
                            box-shadow: 0 20px 50px -10px rgba(0,0,0,0.08);
                            margin: 20px 0;
                        }

                        .qr-img { 
                            width: 250px; 
                            height: 250px;
                            display: block;
                        }

                        .instruction {
                            margin-top: 30px;
                            font-weight: 800;
                            font-size: 24px;
                            color: #1e1b4b;
                        }

                        .sub-instruction {
                            color: #64748b;
                            font-size: 16px;
                            margin-top: 8px;
                        }

                        .footer {
                            margin-top: 50px;
                            padding-top: 30px;
                            border-top: 1px dashed #e2e8f0;
                        }

                        .url { 
                            color: #2563eb; 
                            font-weight: 600; 
                            font-size: 14px;
                            opacity: 0.7;
                        }

                        @media print {
                            body { background: white; }
                            .flyer-container { border: none; box-shadow: none; width: 100%; max-width: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="flyer-container">
                        <div class="logo-container">
                            <img src="/images/logo.png" class="logo-img" onerror="this.style.display='none'" />
                        </div>
                        
                        <div class="header">
                            <div class="doctor-name">${doctorName}</div>
                            <h1>${clinicName}</h1>
                        </div>
                        
                        <div class="qr-section">
                            <img src="${qrDataUrl}" class="qr-img" />
                        </div>
                        
                        <div class="instruction">Scan to Book Appointment</div>
                        <div class="sub-instruction">Open your phone camera to scan</div>
                        
                        <div class="footer">
                            <div class="url">${url}</div>
                        </div>
                    </div>
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
