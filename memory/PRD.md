# National ID Appointment Booking System - PRD

## Original Problem Statement
Build a web-based application for booking appointments for National ID registration at the Uganda High Commission in London.

## Current Status: PRODUCTION READY ✅

## Scheduling Rules

### Available Days by Service Type
| Service | Available Days | Time Window |
|---------|---------------|-------------|
| Fresh Registration | Monday, Wednesday, Friday | 10:00 AM – 1:00 PM |
| Renewal | Monday, Wednesday, Friday | 10:00 AM – 1:00 PM |
| Get First ID | Monday, Wednesday, Friday | 10:00 AM – 1:00 PM |
| Change of Particulars | Monday, Wednesday, Friday | 10:00 AM – 1:00 PM |
| Card Pick-up | Monday to Friday | 10:00 AM – 1:00 PM |

### Daily Booking Limits
| Service Category | Daily Limit |
|-----------------|-------------|
| Fresh Registration, Renewal, Get First ID, Change of Particulars (COMBINED) | **50 bookings/day** |
| Card Pick-up | **No limit** |

**Note**: The 50/day limit is shared across all standard services. If 30 Fresh Registration and 20 Renewal appointments are booked on a day, no more standard service appointments can be made for that day.

## Service Requirements

| Service | NIN Required | Special Requirements |
|---------|--------------|---------------------|
| Fresh Registration | No | Age category selection (Below 18 / Above 18) |
| Renewal | No | - |
| Get First ID | No | - |
| Change of Particulars | No | - |
| Card Pick-up | Yes | - |

## Features Implemented

### Guest Booking Flow
- [x] Multi-step form with validation
- [x] 5 Service types with specific requirements
- [x] Age category selection for Fresh Registration
- [x] Real-time capacity indicator (for standard services)
- [x] Service-specific calendar restrictions
- [x] Combined daily limit enforcement
- [x] PDF confirmation with service-specific requirements

### Admin Dashboard
- [x] Check-in / Mark Served
- [x] Reject with email notification
- [x] Bulk reschedule with email
- [x] Audit logs & User management

## Contact Information
- **ID Services Contact Line**: 02031544027 / 02078395783

## Email Configuration
- **SendGrid API Key**: Configured
- **Verified Sender**: paul.kasawuli@nira.go.ug

## Test Credentials
- **Admin**: admin / admin123 (Super Admin)

## Recent Updates (March 2026)

### Calendar & Capacity Rules
- Standard services: Mon/Wed/Fri only, combined 50/day limit
- Card Pick-up: Mon-Fri, no daily limit
- Frontend shows appropriate limit messages per service type

### Service Updates
- Fresh Registration: Age category dropdown (Below 18 / Above 18)
- Renewal: No longer requires NIN
- Card Pick-up: Simplified requirements (only NIN required)

### PDF Updates
- Service-specific WHAT TO BRING section
- Updated contact numbers
- PRE-REGISTRATION NOTICE as proper section

### UI Updates
- Landing page: "ID Services Contact Line" with new numbers
- Admin login: No default credentials displayed
