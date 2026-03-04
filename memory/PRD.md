# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London. Users enter their details (Surname, First Name, Email, UK/Uganda phone), choose a service type (Fresh Registration, Renewal, GetFirst ID, Change of Particulars, Card Pick-up), view requirements for each service, select an appointment date (based on service type), and receive email confirmation + downloadable PDF. Users can also manage (reschedule/cancel) existing appointments.

## Architecture

### Backend (FastAPI + MongoDB)
- **Models**: Appointment (with version field for optimistic locking), AdminUser (with roles), AuditLog
- **Race Condition Handling**: Atomic operations with retry logic, unique index on reference_number
- **RBAC**: Role-Based Access Control (Super Admin, Operations Admin, Front Desk)
- **Audit Logging**: All admin actions are logged for accountability
- **API Endpoints**:
  - `POST /api/appointments` - Create appointment (with race condition handling)
  - `GET /api/appointments/:id` - Get single appointment by ID
  - `GET /api/appointments/by-reference/:ref` - Get appointment by reference number
  - `PATCH /api/appointments/:id/reschedule` - Reschedule appointment (user self-service)
  - `PATCH /api/appointments/:id/cancel` - Cancel appointment (user self-service)
  - `GET /api/appointments/:id/pdf` - Download PDF
  - `POST /api/admin/login` - Admin authentication
  - `GET /api/admin/appointments` - List all (admin) with search & filters
  - `GET /api/admin/stats` - Get statistics
  - `PATCH /api/admin/appointments/:id` - Update status
  - `POST /api/admin/appointments/:id/check-in` - Check-in appointment
  - `POST /api/admin/appointments/:id/mark-served` - Mark as served
  - `POST /api/admin/appointments/:id/reject` - Reject with reason (Card Pick-up)
  - `POST /api/admin/bulk-reschedule` - Bulk reschedule by date/service
  - `DELETE /api/admin/appointments/:id` - Delete appointment
  - `GET /api/admin/audit-logs` - View audit logs
  - `GET /api/admin/audit-logs/export` - Export audit logs as CSV
  - `GET /api/admin/users` - List admin users (Super Admin only)
  - `POST /api/admin/users` - Create admin user (Super Admin only)
  - `GET /api/admin/reports/daily-worklist` - Get daily worklist
  - `GET /api/admin/reports/daily-worklist/download` - Download worklist CSV
  - `GET /api/services` - Get service requirements
  - `GET /api/disabled-dates` - Get disabled dates by service type

### Frontend (React + Tailwind CSS + Shadcn UI)
- **Pages**:
  - Landing Page - Hero + 5 Services overview + Admin Portal (top right) + Manage Appointment
  - Booking Flow - Multi-step form (Personal Details -> Service Selection -> Date Selection)
  - Confirmation Page - Success view + PDF download
  - Manage Appointment Page - View, Reschedule, Cancel existing appointments
  - Admin Login
  - Admin Dashboard - Enhanced with multiple tabs:
    * Dashboard: Stats overview (total, today, checked-in, served, by service)
    * Appointments: Search, filter, check-in, mark-served, reject, bulk reschedule
    * Reports: Daily worklist download
    * Audit Logs: View/export activity logs (Super Admin, Operations Admin)
    * User Management: Create/view admin users (Super Admin only)

## User Personas
1. **Ugandan Diaspora in UK** - Need National ID services, want easy online booking
2. **Front Desk Staff** - Check-in, mark-served, view appointments
3. **Operations Admin** - View audit logs, manage appointments, generate reports
4. **Super Admin** - Full access including user management

## Core Requirements (Static)
- [x] Guest booking (no login required)
- [x] Multi-step booking form with validation
- [x] 5 Service types: Fresh Registration, Renewal, Get First ID, Change of Particulars, Card Pick-up
- [x] Card Pick-up and Renewal require NIN/Application Number
- [x] Service selection with requirements display
- [x] Calendar with service-specific restricted dates:
  - Fresh Registration, Renewal, Get First ID, Change of Particulars: Mon, Wed, Fri
  - Card Pick-up: Mon-Fri
- [x] Time window: 10:00 AM - 1:00 PM (UK Time)
- [x] UK and Uganda public holidays disabled
- [x] Phone validation for UK (+44) and Uganda (+256)
- [x] International name validation (security)
- [x] PDF generation (ReportLab on backend)
- [x] Admin authentication (JWT)
- [x] Admin dashboard with RBAC
- [x] Appointment management (view, filter, update status, delete)
- [x] Check-in / Mark Served functionality
- [x] Reject with reason (Card Pick-up)
- [x] Bulk reschedule appointments
- [x] Audit logging for all admin actions
- [x] User management (Super Admin only)
- [x] CSV export functionality
- [x] Mobile-first responsive design
- [x] Race condition handling for concurrent submissions
- [x] User self-service: Manage appointments (reschedule/cancel)

## What's Been Implemented (March 2026)
- Full booking flow with service-specific scheduling
- Confirmation page with PDF download
- Manage Appointment feature (reschedule/cancel)
- Enhanced Admin Dashboard with:
  * Dashboard tab with stats
  * Appointments tab with search, filters, actions
  * Reports tab with daily worklist download
  * Audit Logs tab (Super Admin, Operations Admin)
  * User Management tab (Super Admin only)
- RBAC with proper HTTP Header authorization
- Audit logging for all admin actions
- Bulk reschedule functionality

## Prioritized Backlog

### P0 - Critical (Blocks Core Functionality)
- [x] Admin system overhaul completed
- [ ] Configure SendGrid API key for email sending

### P1 - Important
- [ ] Add email reminders before appointment date

### P2 - Nice to Have
- [ ] Add SMS notifications via Twilio
- [ ] Add scheduled auto-reports
- [ ] Add print-friendly appointment slip

## Next Tasks
1. **Configure SendGrid** - Add SENDGRID_API_KEY to backend/.env for email sending
2. **Appointment reminders** - Send reminder emails 24h before appointment

## Test Credentials
- **Admin Username:** admin
- **Admin Password:** admin123
- **Admin Role:** super_admin

## Key Technical Notes
- RBAC is enforced via JWT token with role in payload
- All admin endpoints require Authorization header with Bearer token
- Audit logs are immutable and include user, action, resource, details
- Email sending depends on SENDGRID_API_KEY environment variable
