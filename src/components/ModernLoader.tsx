'use client'

import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'

export default function ModernLoader() {
    return (
        <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center font-sans">
            <div className="relative">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 180, 360],
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeInOut",
                        times: [0, 0.5, 1],
                        repeat: Infinity,
                    }}
                    className="w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center"
                >
                    <Activity className="text-white w-8 h-8" />
                </motion.div>
                <motion.div
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeInOut",
                        times: [0, 0.5, 1],
                        repeat: Infinity,
                    }}
                    className="absolute inset-0 bg-blue-400 rounded-2xl -z-10"
                />
            </div>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6 text-slate-400 font-bold tracking-widest text-xs uppercase"
            >
                Loading Clinic Plus...
            </motion.p>
        </div>
    )
}
