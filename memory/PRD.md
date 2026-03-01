# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London. Users enter their details (Surname, First Name, Email, UK phone), choose a service type (Fresh Registration, Renewal, GetFirst ID, Change of Particulars), view requirements for each service, select an appointment date (Tue/Wed/Fri only), and receive email confirmation + downloadable PDF.

## Architecture

### Backend (FastAPI + MongoDB)
- **Models**: Appointment, AdminUser
- **API Endpoints**:
  - `POST /api/appointments` - Create appointment (guest)
  - `GET /api/appointments/:id` - Get single appointment
  - `GET /api/appointments/:id/pdf` - Download PDF
  - `POST /api/admin/login` - Admin authentication
  - `GET /api/admin/appointments` - List all (admin)
  - `GET /api/admin/stats` - Get statistics
  - `PATCH /api/admin/appointments/:id` - Update status
  - `DELETE /api/admin/appointments/:id` - Delete appointment
  - `GET /api/services` - Get service requirements
  - `GET /api/disabled-dates` - Get disabled dates

### Frontend (React + Tailwind CSS + Shadcn UI)
- **Pages**:
  - Landing Page - Hero + Services overview
  - Booking Flow - Multi-step form (Personal Details → Service Selection → Date Selection)
  - Confirmation Page - Success view + PDF download
  - Admin Login
  - Admin Dashboard - Stats + Appointments table

## User Personas
1. **Ugandan Diaspora in UK** - Need National ID services, want easy online booking
2. **Admin Staff** - Need to view/manage appointments, track statistics

## Core Requirements (Static)
- [x] Guest booking (no login required)
- [x] Multi-step booking form with validation
- [x] Service selection with requirements display
- [x] Calendar with restricted dates (Tue/Wed/Fri only)
- [x] UK and Uganda public holidays disabled
- [x] PDF generation (client-side with jsPDF)
- [x] Admin authentication (JWT)
- [x] Admin dashboard with stats
- [x] Appointment management (view, filter, update status, delete)
- [x] CSV export functionality

## What's Been Implemented (Jan 2026)
- ✅ Landing page with hero section and services display
- ✅ Multi-step booking form (Personal Details → Service → Date)
- ✅ Service requirements display for all 4 service types
- ✅ Calendar component with date restrictions
- ✅ UK and Uganda holidays (2025-2026) blocked
- ✅ Appointment creation API
- ✅ PDF generation (both server-side and client-side)
- ✅ Confirmation page with PDF download
- ✅ Admin login with JWT authentication
- ✅ Admin dashboard with statistics cards
- ✅ Appointments table with search, filter, pagination
- ✅ Status management (confirm, complete, cancel)
- ✅ Delete appointments
- ✅ CSV export

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
