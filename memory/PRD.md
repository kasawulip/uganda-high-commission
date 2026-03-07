# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London.

## Current Status: PRODUCTION READY ✅
- **Email Notifications**: ✅ ENABLED (SendGrid verified sender: paul.kasawuli@nira.go.ug)
- **PDF Generation**: ✅ ENABLED (service-specific requirements)
- **All Features**: Fully operational

## Recent Updates (March 5, 2026)

### Service Requirements Changes
1. **Renewal Service** - No longer requires NIN input
2. **Fresh Registration** - Now requires age category selection:
   - Below Age of 18: Different requirements (escorted by parent/guardian)
   - Above Age of 18: Different requirements (Recommendation Letter from Embassy)
3. **Card Pick-up** - Simplified to only require NIN/Application Number

### PDF Confirmation Letter Updates
- **WHAT TO BRING** section now shows service-specific requirements
- **Contact Info**: Updated to "02031544027 / 02078395783"
- **PRE-REGISTRATION NOTICE**: Now a proper section (not footnote)

### UI Updates
- **Landing Page**: "NIRA Toll-Free" changed to "ID Services Contact Line" with new numbers
- **Admin Login**: Default credentials removed from display

## Architecture

### Backend (FastAPI + MongoDB)
- Email: SendGrid integration
- PDF: ReportLab with service-specific content
- RBAC: Role-Based Access Control

### Frontend (React + Tailwind CSS + Shadcn UI)
- Accessible, mobile-first design
- Age category selection for Fresh Registration
- Service-specific requirement displays

## Core Features

### Guest Booking Flow
- [x] Multi-step form with validation
- [x] 5 Service types with specific requirements
- [x] Age category selection for Fresh Registration
- [x] NIN required only for Card Pick-up
- [x] Real-time capacity indicator
- [x] PDF with service-specific WHAT TO BRING

### Admin Dashboard
- [x] Check-in / Mark Served
- [x] Reject with email notification
- [x] Bulk reschedule with email
- [x] Audit logs
- [x] User management

## Service Requirements Summary

| Service | NIN Required | Special |
|---------|--------------|---------|
| Fresh Registration | No | Age category selection |
| Renewal | No | - |
| Get First ID | No | - |
| Change of Particulars | No | - |
| Card Pick-up | Yes | - |

## Contact Information
- **ID Services Contact Line**: 02031544027 / 02078395783

## Test Credentials
- **Admin**: admin / admin123 (Super Admin)

## Email Configuration
- **SendGrid API Key**: Configured
- **Verified Sender**: paul.kasawuli@nira.go.ug
