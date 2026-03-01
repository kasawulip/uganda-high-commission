# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London. Users enter their details (Surname, First Name, Email, UK/Uganda phone), choose a service type (Fresh Registration, Renewal, GetFirst ID, Change of Particulars, Card Pick-up), view requirements for each service, select an appointment date (Tue/Wed/Fri only), and receive email confirmation + downloadable PDF.

## Architecture

### Backend (FastAPI + MongoDB)
- **Models**: Appointment, AdminUser
- **API Endpoints**:
  - `POST /api/appointments` - Create appointment (guest)
  - `GET /api/appointments/:id` - Get single appointment
  - `GET /api/appointments/:id/pdf` - Download PDF
  - `POST /api/admin/login` - Admin authentication
  - `GET /api/admin/appointments` - List all (admin, no limit)
  - `GET /api/admin/stats` - Get statistics
  - `PATCH /api/admin/appointments/:id` - Update status
  - `DELETE /api/admin/appointments/:id` - Delete appointment
  - `GET /api/services` - Get service requirements
  - `GET /api/disabled-dates` - Get disabled dates

### Frontend (React + Tailwind CSS + Shadcn UI)
- **Pages**:
  - Landing Page - Hero + 5 Services overview + Admin Portal (top right)
  - Booking Flow - Multi-step form (Personal Details → Service Selection → Date Selection)
  - Confirmation Page - Success view + PDF download
  - Admin Login
  - Admin Dashboard - Stats + Appointments table (no limit)

## User Personas
1. **Ugandan Diaspora in UK** - Need National ID services, want easy online booking
2. **Admin Staff** - Need to view/manage appointments, track statistics

## Core Requirements (Static)
- [x] Guest booking (no login required)
- [x] Multi-step booking form with validation
- [x] 5 Service types: Fresh Registration, Renewal, Get First ID, Change of Particulars, Card Pick-up
- [x] Card Pick-up requires NIN/Application Number
- [x] Service selection with requirements display
- [x] Calendar with restricted dates (Tue/Wed/Fri only)
- [x] UK and Uganda public holidays disabled
- [x] Phone validation for UK (+44) and Uganda (+256)
- [x] International name validation (security)
- [x] PDF generation (client-side with jsPDF)
- [x] Admin authentication (JWT)
- [x] Admin dashboard with stats
- [x] Appointment management (view, filter, update status, delete)
- [x] No appointment limit in admin view
- [x] CSV export functionality
- [x] Mobile-first responsive design

## What's Been Implemented (Jan 2026)
- ✅ Landing page with hero section and 5 services display
- ✅ Admin Portal button at top right corner
- ✅ Different colored icons for each service
- ✅ Title changed to "National ID Services"
- ✅ Multi-step booking form (Personal Details → Service → Date)
- ✅ Card Pick-up service with NIN/Application Number field
- ✅ Phone validation for both UK and Uganda numbers
- ✅ International name validation (security compliant)
- ✅ Updated Important Notice with pre-registration ID info
- ✅ Download button: "Download Appointment Confirmation Letter"
- ✅ Mobile-first responsive design
- ✅ Admin dashboard with no appointment limit

## Prioritized Backlog

### P0 - Critical (Blocks Core Functionality)
- [ ] Configure SendGrid API key for email sending

### P1 - Important
- [ ] Add appointment time slots (not just dates)
- [ ] Add email reminders before appointment date
- [ ] Add appointment cancellation by user (via email link)

### P2 - Nice to Have
- [ ] Add SMS notifications via Twilio
- [ ] Add admin user management
- [ ] Add appointment rescheduling
- [ ] Add reporting/analytics dashboard
- [ ] Add print-friendly appointment slip

## Next Tasks
1. **Configure SendGrid** - Add SENDGRID_API_KEY to backend/.env for email sending
2. **Add time slots** - Allow users to select specific time slots per day
3. **Appointment reminders** - Send reminder emails 24h before appointment
