'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            if (isSignUp) {
                // Sign up new user
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                })

                if (signUpError) {
                    setError(signUpError.message)
                    return
                }

                if (data.user) {
                    // Wait a moment for auth to complete
                    await new Promise(resolve => setTimeout(resolve, 1000))

                    // Create clinic first
                    const { data: clinic, error: clinicError } = await supabase
                        .from('clinics')
                        .insert({
                            name: 'My Clinic',
                            doctor_name: email.split('@')[0],
                            mobile: null,
                            consultation_fee: 500,
                        })
                        .select()
                        .single()

                    if (clinicError) {
                        console.error('Error creating clinic:', clinicError)
                        setError('Failed to create clinic: ' + clinicError.message)
                        return
                    }

                    if (clinic) {
                        // Create user record
                        const { error: userError } = await supabase.from('users').insert({
                            id: data.user.id,
                            clinic_id: clinic.id,
                            mobile: null,
                            role: 'doctor',
                        })

                        if (userError) {
                            console.error('Error creating user:', userError)
                            setError('Failed to create user record: ' + userError.message)
                            return
                        }

                        // Create clinic settings
                        const { error: settingsError } = await supabase.from('clinic_settings').insert({
                            clinic_id: clinic.id,
                        })

                        if (settingsError) {
                            console.error('Error creating settings:', settingsError)
                            // Don't fail on settings error, it's not critical
                        }
                    }

                    alert('Account created successfully! Please login.')
                    setIsSignUp(false)
                    setEmail('')
                    setPassword('')
                }
            } else {
                // Sign in existing user
                const { data, error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })

                if (signInError) {
                    setError(signInError.message)
                    return
                }

                if (data.user) {
                    // Check if user record exists in our users table
                    const { data: userData, error: userCheckError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .maybeSingle()

                    // If user doesn't exist in our table, create it
                    if (!userData && !userCheckError) {
                        // Create clinic first
                        const { data: clinic, error: clinicError } = await supabase
                            .from('clinics')
                            .insert({
                                name: 'My Clinic',
                                doctor_name: email.split('@')[0],
                                mobile: null,
                                consultation_fee: 500,
                            })
                            .select()
                            .single()

                        if (!clinicError && clinic) {
                            // Create user record
                            await supabase.from('users').insert({
                                id: data.user.id,
                                clinic_id: clinic.id,
                                mobile: null,
                                role: 'doctor',
                            })

                            // Create clinic settings
                            await supabase.from('clinic_settings').insert({
                                clinic_id: clinic.id,
                            })
                        }
                    }
                }

                router.push('/dashboard')
            }
        } catch (err: any) {
            console.error('Error:', err)
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-bold text-gray-900">ClinicFlow</CardTitle>
                        <CardDescription className="text-base mt-2">
                            {isSignUp ? 'Create your account' : 'Welcome back'}
                            <br />
                            {isSignUp ? 'Start managing your clinic' : 'Sign in to manage your clinic'}
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                Email Address
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="doctor@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-12 text-base"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                                Password
                            </Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={isSignUp ? 'Create a password (min 6 characters)' : 'Enter your password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10 h-12 text-base"
                                    required
                                    disabled={loading}
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 text-gray-400" />
                                    ) : (
                                        <Eye className="h-5 w-5 text-gray-400" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-base bg-blue-500 hover:bg-blue-600"
                            disabled={loading || !email || password.length < 6}
                        >
                            {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Create Account' : 'Sign In')}
                        </Button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp)
                                    setError('')
                                }}
                                className="text-sm text-blue-500 hover:text-blue-600"
                            >
                                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                            </button>
                        </div>

                        {!isSignUp && (
                            <div className="flex justify-center gap-4 text-sm text-gray-600">
                                <a href="#" className="hover:text-blue-500">Forgot password?</a>
                                <span>•</span>
                                <a href="#" className="hover:text-blue-500">Need help?</a>
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
