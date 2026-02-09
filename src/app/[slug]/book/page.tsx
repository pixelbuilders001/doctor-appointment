
import { getClinicBySlug } from '@/app/actions/public-profile'
import { notFound } from 'next/navigation'
import BookingForm from './booking-form'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const revalidate = 3600 // Revalidate hourly

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
    const { slug } = await params
    const clinic = await getClinicBySlug(slug)
    if (!clinic) return { title: 'Clinic Not Found' }
    return {
        title: `Book Appointment - ${clinic.doctor_name}`,
        description: `Schedule an appointment with ${clinic.doctor_name}.`
    }
}

export default async function BookingPage({ params }: Props) {
    const { slug } = await params
    const clinic = await getClinicBySlug(slug)

    if (!clinic) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto mb-6">
                <Link href={`/${slug}`} className="flex items-center text-sm text-slate-500 hover:text-primary transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Profile
                </Link>
            </div>
            <BookingForm clinic={clinic} slug={slug} />
        </div>
    )
}
