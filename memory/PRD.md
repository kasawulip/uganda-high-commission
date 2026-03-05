# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London.

## Current Status
- **Email Notifications**: ✅ ENABLED (SendGrid verified sender: paul.kasawuli@nira.go.ug)
- **PDF Generation**: ✅ ENABLED (server-side with ReportLab)
- **All Features**: Fully operational

## Email Notifications Active
The following email notifications are now active:
1. **Confirmation Email** - Sent when appointment is booked (includes PDF attachment)
2. **Rejection Email** - Sent when Card Pick-up appointment is rejected
3. **Reschedule Email** - Sent when appointments are bulk rescheduled

## Architecture

### Backend (FastAPI + MongoDB)
- **Email**: SendGrid integration with verified sender
- **PDF Generation**: Server-side using ReportLab
- **Race Condition Handling**: Atomic operations with retry logic
- **RBAC**: Role-Based Access Control

### Frontend (React + Tailwind CSS + Shadcn UI)
- **PDF Download**: Blob + anchor method (no pop-up blockers)
- **Rejection Notifications**: Orange alert in Manage Appointment
- **Mobile-first**: Tested at 375px viewport

## Core Features

### Guest Booking Flow
- [x] Multi-step form with validation
- [x] 5 Service types with requirements
- [x] Real-time capacity indicator
- [x] Service-specific scheduling
- [x] PDF confirmation download
- [x] Email confirmation with PDF attachment

### Manage Appointment
- [x] View, reschedule, cancel appointments
- [x] Download PDF confirmation
- [x] Rejection notifications

### Admin Dashboard
- [x] Stats, appointments, audit logs
- [x] Check-in / Mark Served
- [x] Reject with reason + email notification
- [x] Bulk reschedule + email notifications
- [x] User management (Super Admin)

## Configuration
```
SENDGRID_API_KEY=SG.xxx
SENDER_EMAIL=paul.kasawuli@nira.go.ug
```

## Test Credentials
- **Admin**: admin / admin123

## Completed (March 2026)
- Full booking system with email notifications
- PDF generation with pre-registration footnote
- Admin dashboard with RBAC
- Rejection notifications in Manage Appointment
