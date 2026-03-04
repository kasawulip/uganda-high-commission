# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London. Users enter their details (Surname, First Name, Email, UK/Uganda phone), choose a service type (Fresh Registration, Renewal, GetFirst ID, Change of Particulars, Card Pick-up), view requirements for each service, select an appointment date (based on service type), and receive email confirmation + downloadable PDF. Users can also manage (reschedule/cancel) existing appointments.

## Architecture

### Backend (FastAPI + MongoDB)
- **Models**: Appointment (with version field for optimistic locking), AdminUser (with roles), AuditLog
- **Race Condition Handling**: Atomic operations with retry logic, unique index on reference_number
- **RBAC**: Role-Based Access Control (Super Admin, Operations Admin, Front Desk) with proper HTTP Header authorization
- **Audit Logging**: All admin actions are logged for accountability
- **Server-side Reporting**: PDF generation (ReportLab), CSV exports for worklist/audit logs
- **API Endpoints**:
  - Public:
    - `POST /api/appointments` - Create appointment
    - `GET /api/appointments/:id` - Get appointment by ID
    - `GET /api/appointments/by-reference/:ref` - Get by reference
    - `GET /api/capacity` - **Real-time capacity/availability (public)**
    - `GET /api/disabled-dates` - Service-specific disabled dates
    - `GET /api/services` - Service requirements
    - `GET /api/time-slots` - Available time slots
  - User Self-Service:
    - `PATCH /api/appointments/:id/reschedule` - Reschedule
    - `PATCH /api/appointments/:id/cancel` - Cancel
    - `GET /api/appointments/:id/pdf` - Download PDF
  - Admin (requires JWT):
    - Full CRUD for appointments
    - Check-in / Mark Served
    - Reject with reason (Card Pick-up)
    - Bulk reschedule
    - Audit logs view/export
    - User management (Super Admin only)
    - Reports (daily worklist download)

### Frontend (React + Tailwind CSS + Shadcn UI)
- **Component Library**: Shadcn/UI (built on Radix UI) - excellent for accessibility & responsiveness
- **Pages**:
  - Landing Page - Hero + 5 Services + Admin Portal + Manage Appointment
  - Booking Flow - Multi-step form with:
    * **Real-time capacity indicator** with color-coded calendar
    * Accessibility-first design with ARIA attributes
    * Mobile-responsive layout
  - Confirmation Page - Success view + PDF download
  - Manage Appointment Page - View, Reschedule, Cancel
  - Admin Dashboard - 5 tabs (Dashboard, Appointments, Reports, Audit Logs, User Management)

## User Personas
1. **Ugandan Diaspora in UK** - Need National ID services, want easy online booking
2. **Front Desk Staff** - Check-in, mark-served, view appointments
3. **Operations Admin** - View audit logs, manage appointments, generate reports
4. **Super Admin** - Full access including user management

## Core Requirements (All Implemented)
- [x] Guest booking (no login required)
- [x] Multi-step booking form with validation
- [x] 5 Service types with service-specific rules
- [x] **Real-time capacity indicator** on booking page
- [x] Calendar with color-coded availability (green/yellow/orange/red)
- [x] Service-specific scheduling:
  - Fresh Registration, Renewal, Get First ID, Change of Particulars: Mon, Wed, Fri
  - Card Pick-up: Mon-Fri
- [x] Time window: 10:00 AM - 1:00 PM (UK Time)
- [x] UK and Uganda public holidays disabled
- [x] NIN required for Card Pick-up AND Renewal services
- [x] **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- [x] **Mobile-first responsive design** (tested at 375px)
- [x] PDF generation (server-side with ReportLab)
- [x] Admin authentication with RBAC (Super Admin, Operations Admin, Front Desk)
- [x] Audit logging for all admin actions
- [x] Check-in / Mark Served workflow
- [x] Reject with reason (Card Pick-up)
- [x] Bulk reschedule appointments
- [x] CSV exports (worklist, audit logs, appointments)
- [x] Race condition handling for concurrent submissions
- [x] User self-service: Manage appointments (reschedule/cancel)

## Reliability Features
- **Responsive SPA**: React with hot reload, responsive Tailwind CSS
- **Component Library**: Shadcn/UI (Radix primitives) with built-in accessibility
- **Server-side Reporting**: PDF generation with ReportLab, CSV exports
- **Atomic Database Operations**: MongoDB with optimistic locking
- **RBAC with Header-based Auth**: Proper HTTP header capture with FastAPI Header()

## What's Been Implemented (March 2026)
- Full booking flow with service-specific scheduling
- **Real-time capacity indicator** with:
  - Public `/api/capacity` endpoint
  - Availability legend (Available, Filling Up, Limited, Full)
  - Color-coded calendar dates
  - Selected date capacity info with progress bar
- Enhanced accessibility throughout
- Mobile-responsive design (375px viewport tested)
- Complete admin system with RBAC
- Server-side PDF generation and CSV exports

## Prioritized Backlog

### P0 - Critical
- [ ] Configure SendGrid API key for email sending

### P1 - Important
- [ ] Add email reminders before appointment date

### P2 - Nice to Have
- [ ] Add SMS notifications via Twilio
- [ ] Scheduled auto-reports (daily summary to admins)

## Test Credentials
- **Admin Username:** admin
- **Admin Password:** admin123
- **Admin Role:** super_admin

## Key Technical Notes
- Public capacity API: `GET /api/capacity?service_type=<type>` - no auth required
- NIN required for: `card_pickup` AND `renewal` services
- Capacity levels calculated: <50% = available, 50-80% = moderate, 80-100% = limited, 100% = full
- All form inputs have autocomplete attributes for better mobile UX
- Calendar modifiers style dates based on capacity level
