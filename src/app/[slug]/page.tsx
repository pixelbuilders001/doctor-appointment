
import { getClinicBySlug } from '@/app/actions/public-profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MapPin, Clock, Calendar, CheckCircle2, Phone } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const revalidate = 3600 // Revalidate every hour

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const clinic = await getClinicBySlug(slug)

    if (!clinic) {
        return {
            title: 'Clinic Not Found',
        }
    }

    return {
        title: `${clinic.doctor_name} - ${clinic.name}`,
        description: `Book an appointment with ${clinic.doctor_name} at ${clinic.name}.`,
    }
}

export default async function PublicClinicProfile({ params }: Props) {
    const { slug } = await params
    const clinic = await getClinicBySlug(slug)

    if (!clinic) {
        notFound()
    }

    const { clinic_settings } = clinic

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto w-full space-y-8">

                {/* Profile Header Card */}
                <Card className="border-none shadow-lg overflow-hidden">
                    <div className="bg-primary h-24 w-full relative">
                        <div className="absolute -bottom-10 left-6">
                            <div className="h-20 w-20 rounded-full bg-white border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold text-primary">
                                {clinic.doctor_name.charAt(0)}
                            </div>
                        </div>
                    </div>
                    <CardHeader className="pt-12 pb-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl font-bold">{clinic.doctor_name}</CardTitle>
                                <CardDescription className="text-lg font-medium text-primary mt-1">
                                    {clinic.specialization || 'General Physician'}
                                </CardDescription>
                                <p className="text-muted-foreground mt-1 text-sm">{clinic.name}</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Address */}
                        <div className="flex items-start gap-3 text-sm text-slate-600">
                            <MapPin className="w-5 h-5 text-primary shrink-0" />
                            <div>
                                <p>{clinic.address}</p>
                                {clinic.maps_link && (
                                    <a
                                        href={clinic.maps_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline text-xs mt-1 block"
                                    >
                                        View on Google Maps
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Timings */}
                        <div className="flex items-start gap-3 text-sm text-slate-600">
                            <Clock className="w-5 h-5 text-primary shrink-0" />
                            <div className="space-y-1">
                                {clinic_settings?.morning_start && clinic_settings?.morning_end && (
                                    <div className="flex justify-between w-full gap-8">
                                        <span className="font-medium">Morning:</span>
                                        <span>{clinic_settings.morning_start.slice(0, 5)} - {clinic_settings.morning_end.slice(0, 5)}</span>
                                    </div>
                                )}
                                {clinic_settings?.evening_start && clinic_settings?.evening_end && (
                                    <div className="flex justify-between w-full gap-8">
                                        <span className="font-medium">Evening:</span>
                                        <span>{clinic_settings.evening_start.slice(0, 5)} - {clinic_settings.evening_end.slice(0, 5)}</span>
                                    </div>
                                )}
                                {!clinic_settings && <p>Contact clinic for timings</p>}
                            </div>
                        </div>

                        {/* Phone - Optional */}
                        {clinic.mobile && (
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <Phone className="w-5 h-5 text-primary shrink-0" />
                                <a href={`tel:${clinic.mobile}`} className="hover:text-primary transition-colors">
                                    {clinic.mobile}
                                </a>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* CTA Section */}
                <div className="space-y-4">
                    <Link href={`/${slug}/book`} className="block">
                        <Button className="w-full text-lg py-6 shadow-md hover:shadow-lg transition-all" size="lg">
                            <Calendar className="mr-2 h-5 w-5" />
                            Book Appointment
                        </Button>
                    </Link>

                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>No app or login required</span>
                    </div>
                </div>

            </div>
        </div>
    )
}
