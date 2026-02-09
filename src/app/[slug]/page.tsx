
import { getClinicBySlug } from '@/app/actions/public-profile'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PublicProfileClient from './PublicProfileClient'

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

    return <PublicProfileClient clinic={clinic} slug={slug} />
}
