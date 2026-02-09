
import { getClinicBySlug } from '@/app/actions/public-profile'
import { notFound } from 'next/navigation'
import BookingForm from './booking-form'
import type { Metadata } from 'next'

export const revalidate = 3600 // Revalidate hourly

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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

    return <BookingForm clinic={clinic} slug={slug} />
}
