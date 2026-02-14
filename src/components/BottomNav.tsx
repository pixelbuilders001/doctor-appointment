'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Calendar, Settings, LayoutDashboard, WalletCards } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

interface BottomNavProps {
    role?: string | null
}

export default function BottomNav({ role = 'staff' }: BottomNavProps) {
    const { t } = useLanguage()
    const router = useRouter()
    const pathname = usePathname()

    const navItems = [
        {
            icon: LayoutDashboard,
            label: t('home'),
            path: '/dashboard',
            roles: ['doctor', 'staff']
        },
        {
            icon: Calendar,
            label: t('schedule'),
            path: '/appointments',
            roles: ['doctor', 'staff']
        },
        {
            icon: WalletCards,
            label: t('earnings'),
            path: '/earnings',
            roles: ['doctor']
        },
        {
            icon: Settings,
            label: t('settings'),
            path: '/settings',
            roles: ['doctor', 'staff']
        }
    ]

    const filteredItems = navItems.filter(item => !item.roles || (role && item.roles.includes(role)))

    return (
        <nav className="fixed bottom-6 left-6 right-6 h-16 bg-white/80 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-50">
            <div className="flex justify-around items-center h-full px-4 max-w-md mx-auto">
                {filteredItems.map((item) => {
                    const isActive = pathname === item.path
                    const Icon = item.icon

                    return (
                        <button
                            key={item.path}
                            onClick={() => router.push(item.path)}
                            className="flex flex-col items-center justify-center gap-1 group relative transition-all duration-300"
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                                isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                                    : "text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                            )}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <span className={cn(
                                "text-[10px] font-black transition-colors duration-300",
                                isActive ? "text-blue-600" : "text-slate-400 group-hover:text-blue-600"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
