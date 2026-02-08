# ClinicFlow - Quick Start Guide

## 🚀 What You Have

A **complete appointment booking and queue management system** with:

✅ Email/Password Authentication  
✅ Real-time Appointment Queue  
✅ Token-based Patient Management  
✅ Clinic Status Management  
✅ Supabase Backend Integration  

## 📋 Setup Instructions

### 1. Set Up Supabase (5 minutes)

Follow the detailed guide in **`SUPABASE_SETUP.md`**

**Quick version:**
1. Create project at [supabase.com](https://supabase.com)
2. Copy API credentials to `.env.local`
3. Run `supabase-schema.sql` in SQL Editor
4. Disable email confirmations (for testing)

### 2. Start the App

```bash
npm run dev
```

Open: http://localhost:3000

### 3. Create Your Account

1. Click **"Don't have an account? Sign up"**
2. Enter email and password (min 6 characters)
3. Click **"Create Account"**
4. Sign in with your credentials

**Your clinic is automatically created on first signup!**

## 🎯 Features

### Authentication
- Email and password login
- Sign up / Sign in toggle
- Password visibility toggle
- Automatic clinic creation on signup

### Dashboard
- Today's appointment summary
- Clinic status toggle (Available/Busy/Closed)
- Next 3 appointments
- Real-time updates

### Appointment Queue
- View appointments by date
- Filter by status (Booked, Checked In, Completed)
- Add walk-in patients
- Update appointment status
- Auto-generated token numbers

### Settings
- Clinic details
- Consultation fee
- Clinic timings
- WhatsApp notification preferences
- Logout

## 🔑 Test Flow

1. **Sign Up**: Create account with email/password
2. **Login**: Sign in to dashboard
3. **Add Appointment**: Click "Add New Appointment"
4. **Add Walk-in**: Fill patient details
5. **Check-in**: Click "Check-in" button
6. **Start Consultation**: Update status
7. **Complete**: Mark as complete
8. **Settings**: Update clinic details

## 📱 Pages

- `/` → Redirects to login
- `/login` → Email/password authentication
- `/dashboard` → Main dashboard
- `/appointments` → Queue management
- `/settings` → Clinic settings

## 🗄️ Database Tables

- `clinics` - Clinic information
- `users` - User accounts (linked to auth)
- `appointments` - Patient appointments
- `clinic_settings` - Clinic preferences

## 🔐 Security

- Row Level Security (RLS) enabled
- Users can only see their clinic's data
- Protected routes via middleware
- Secure session management

## 📞 Need Help?

1. Check `SUPABASE_SETUP.md` for detailed setup
2. Check browser console for errors
3. Verify `.env.local` has correct values
4. Check Supabase logs in dashboard

## 🎉 You're Ready!

Once Supabase is set up, you have a fully functional clinic management system ready to use!
