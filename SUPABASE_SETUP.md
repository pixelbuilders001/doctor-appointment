# ClinicFlow - Supabase Setup Guide

## 📋 Prerequisites
- Supabase account (free tier works fine)
- Node.js installed
- Project already set up

## 🚀 Quick Setup Steps

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: ClinicFlow
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to India (Singapore recommended)
4. Wait for project to be created (~2 minutes)

### 2. Get API Credentials
1. In your Supabase project, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under Project API keys)
   - **service_role** key (under Project API keys - keep this secret!)

### 3. Update Environment Variables
1. Open `.env.local` in the project root
2. Replace with your actual values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 4. Run Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase-schema.sql`
4. Paste into the SQL editor
5. Click **Run** (bottom right)
6. You should see "Success. No rows returned"

### 5. Configure Email Authentication
1. Go to **Authentication** → **Providers**
2. **Email** provider should be enabled by default
3. For development, disable email confirmation:
   - Go to **Authentication** → **Settings**
   - Scroll to **Email Auth**
   - Disable "Enable email confirmations" (for testing only)
4. For production, configure email templates and enable confirmations

### 6. Test the Setup
1. Restart your dev server:
```bash
npm run dev
```

2. Open http://localhost:3000
3. Click "Don't have an account? Sign up"
4. Create account with email and password
5. Login with your credentials

## 📧 Email Configuration (Optional for Testing)

For development, you can disable email confirmations to test faster.

For production:
1. Go to **Authentication** → **Email Templates**
2. Customize confirmation email
3. Configure SMTP settings (or use Supabase's built-in email)

## 🗄️ Database Schema Overview

The simplified schema includes:

- **clinics**: Clinic information
- **users**: Doctors/staff linked to auth
- **appointments**: Patient bookings with queue management
- **clinic_settings**: Clinic preferences and timings

## ✅ Verify Setup

Run these checks in SQL Editor:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check RLS policies
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## 🔐 Security Notes

1. **Never commit** `.env.local` to git (already in .gitignore)
2. **Service role key** should only be used server-side
3. **RLS policies** are enabled - users can only see their clinic's data
4. **Email confirmations** should be enabled in production

## 🐛 Troubleshooting

### "Invalid API key" error
- Double-check your `.env.local` values
- Make sure you copied the full key (they're very long)
- Restart the dev server after changing .env

### "Row Level Security policy violation"
- Make sure you ran the full schema SQL
- Check that RLS policies were created
- Verify you're logged in with a valid user

### Email not received
- Check spam folder
- Disable email confirmations for testing
- Check Supabase logs in Dashboard → Logs

### "User already registered" error
- Email is already in use
- Try logging in instead of signing up
- Or use a different email

## 📞 Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs
2. Check browser console for errors
3. Verify all environment variables are set correctly

## 🎯 Next Steps

After setup is complete:
1. Create your account (sign up)
2. Login with email/password
3. Create your first appointment
4. Test queue management
5. Configure clinic settings

## 🔑 Test Credentials

After signing up, you can use:
- **Email**: Your email address
- **Password**: Your chosen password (min 6 characters)

The first user to sign up will automatically get a clinic created!
