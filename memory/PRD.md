# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London. Users enter their details, choose a service type, view requirements, select an appointment date, and receive a downloadable PDF confirmation. Users can also manage (reschedule/cancel) existing appointments.

## Current Status
- **Email Notifications**: DISABLED (pending SendGrid sender verification)
- **PDF Generation**: ENABLED (server-side with ReportLab)
- **Rejection Notifications**: Visible in Manage Appointment section

## Architecture

### Backend (FastAPI + MongoDB)
- **PDF Generation**: Server-side using ReportLab (reliable, professional output)
- **Race Condition Handling**: Atomic operations with retry logic
- **RBAC**: Role-Based Access Control (Super Admin, Operations Admin, Front Desk)
- **Audit Logging**: All admin actions logged

### Frontend (React + Tailwind CSS + Shadcn UI)
- **PDF Download**: Uses blob + anchor method (no pop-up blockers)
- **Rejection Notifications**: Orange alert with reason, timestamp, and guidance
- **Mobile-first**: Tested at 375px viewport

## Core Features Implemented

### Guest Booking Flow
- [x] Multi-step form (Personal Details → Service Selection → Date & Time)
- [x] 5 Service types with service-specific requirements
- [x] Real-time capacity indicator on calendar
- [x] NIN required for Card Pick-up AND Renewal
- [x] Service-specific scheduling (Mon/Wed/Fri vs Mon-Fri)
- [x] PDF confirmation download (pop-up blocker safe)

### Manage Appointment
- [x] View appointment details by reference number
- [x] Reschedule appointment (select new date/time)
- [x] Cancel appointment
- [x] Download PDF confirmation
- [x] **Rejection notification** with:
  - Orange alert banner
  - Reason displayed in highlighted box
  - Rejection timestamp
  - Guidance to book new appointment

### Admin Dashboard
- [x] Dashboard with stats (total, today, checked-in, served)
- [x] Appointments tab with search, filters, actions
- [x] Check-in / Mark Served workflow
- [x] Reject Card Pick-up with reason
- [x] Bulk reschedule appointments
- [x] Audit logs (view/export)
- [x] User management (Super Admin only)
- [x] Daily worklist download

## Technical Implementation

### PDF Download (Pop-up Blocker Safe)
```javascript
// Uses blob + anchor method instead of window.open
const response = await axios.get(`${API}/appointments/${id}/pdf`, { responseType: 'blob' });
const blob = new Blob([response.data], { type: 'application/pdf' });
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `appointment_${reference}.pdf`;
link.click();
```

### Email Notifications (Currently Disabled)
Email sending is disabled pending SendGrid sender verification. When re-enabled:
1. Set `SENDGRID_API_KEY` in backend/.env
2. Verify sender email in SendGrid dashboard
3. Uncomment email calls in server.py (lines 834, 1295, 1422)

## Test Credentials
- **Admin Username:** admin
- **Admin Password:** admin123
- **Test Rejected Appointment:** UHC-20260304-856C28F9

## Prioritized Backlog

### P0 - Critical
- [ ] Verify SendGrid sender email to enable email notifications

### P1 - Important  
- [ ] Add email reminders 24h before appointments
- [ ] SMS notifications via Twilio

### P2 - Nice to Have
- [ ] Multi-language support (English/Swahili/Luganda)
- [ ] Scheduled auto-reports to admins

## Recent Changes (March 4, 2026)
1. **Disabled email notifications** - Pending SendGrid sender verification
2. **Added rejection notifications** - Users see detailed rejection info when viewing their appointment
3. **Improved PDF download** - Uses blob/anchor method, works across all browsers, no pop-up blockers
4. **Added PDF download to Manage Appointment** - Confirmed appointments can download their PDF
