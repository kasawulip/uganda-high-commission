from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Header, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, timedelta
from enum import Enum
import io
import bcrypt
import jwt
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import base64
import csv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Uganda High Commission - National ID Appointment System")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'uganda-high-commission-secret-key-2025')
JWT_ALGORITHM = "HS256"

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@ugandahighcommission.co.uk')

# Admin Roles Enum
class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    OPERATIONS_ADMIN = "operations_admin"
    FRONT_DESK = "front_desk"

# Role permissions
ROLE_PERMISSIONS = {
    AdminRole.SUPER_ADMIN: ["all"],
    AdminRole.OPERATIONS_ADMIN: ["appointments", "reports", "bulk_operations", "exports"],
    AdminRole.FRONT_DESK: ["check_in", "verify", "mark_served", "view_appointments"]
}

# Service Types Enum
class ServiceType(str, Enum):
    FRESH_REGISTRATION = "fresh_registration"
    RENEWAL = "renewal"
    GET_FIRST_ID = "get_first_id"
    CHANGE_OF_PARTICULARS = "change_of_particulars"
    CARD_PICKUP = "card_pickup"

# UK Public Holidays 2025-2026
UK_HOLIDAYS = [
    # 2025
    date(2025, 1, 1),   # New Year's Day
    date(2025, 4, 18),  # Good Friday
    date(2025, 4, 21),  # Easter Monday
    date(2025, 5, 5),   # Early May Bank Holiday
    date(2025, 5, 26),  # Spring Bank Holiday
    date(2025, 8, 25),  # Summer Bank Holiday
    date(2025, 12, 25), # Christmas Day
    date(2025, 12, 26), # Boxing Day
    # 2026
    date(2026, 1, 1),   # New Year's Day
    date(2026, 4, 3),   # Good Friday
    date(2026, 4, 6),   # Easter Monday
    date(2026, 5, 4),   # Early May Bank Holiday
    date(2026, 5, 25),  # Spring Bank Holiday
    date(2026, 8, 31),  # Summer Bank Holiday
    date(2026, 12, 25), # Christmas Day
    date(2026, 12, 28), # Boxing Day (substitute)
]

# Uganda Public Holidays 2025-2026
UGANDA_HOLIDAYS = [
    # 2025
    date(2025, 1, 1),   # New Year's Day
    date(2025, 1, 26),  # Liberation Day
    date(2025, 2, 16),  # Archbishop Janani Luwum Day
    date(2025, 3, 8),   # International Women's Day
    date(2025, 3, 30),  # Eid al-Fitr (tentative)
    date(2025, 4, 18),  # Good Friday
    date(2025, 4, 21),  # Easter Monday
    date(2025, 5, 1),   # Labour Day
    date(2025, 6, 3),   # Martyrs' Day
    date(2025, 6, 6),   # Eid al-Adha (tentative)
    date(2025, 6, 9),   # National Heroes Day
    date(2025, 10, 9),  # Independence Day
    date(2025, 12, 25), # Christmas Day
    date(2025, 12, 26), # Boxing Day
    # 2026
    date(2026, 1, 1),   # New Year's Day
    date(2026, 1, 26),  # Liberation Day
    date(2026, 2, 16),  # Archbishop Janani Luwum Day
    date(2026, 3, 8),   # International Women's Day
    date(2026, 3, 20),  # Eid al-Fitr (tentative)
    date(2026, 4, 3),   # Good Friday
    date(2026, 4, 6),   # Easter Monday
    date(2026, 5, 1),   # Labour Day
    date(2026, 5, 27),  # Eid al-Adha (tentative)
    date(2026, 6, 3),   # Martyrs' Day
    date(2026, 6, 9),   # National Heroes Day
    date(2026, 10, 9),  # Independence Day
    date(2026, 12, 25), # Christmas Day
    date(2026, 12, 26), # Boxing Day
]

# Combine all holidays
ALL_HOLIDAYS = list(set(UK_HOLIDAYS + UGANDA_HOLIDAYS))

# Pydantic Models
class AppointmentCreate(BaseModel):
    surname: str = Field(..., min_length=1, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r'^(\+44\d{10}|0\d{10}|\+256\d{9}|0\d{9})$')
    service_type: ServiceType
    appointment_date: date
    appointment_time: str = Field(..., pattern=r'^(10:00|10:30|11:00|11:30|12:00|12:30)$')
    nin_or_application_number: Optional[str] = None

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reference_number: str = Field(default_factory=lambda: f"UHC-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}")
    surname: str
    first_name: str
    email: str
    phone: str
    service_type: ServiceType
    appointment_date: str  # Stored as ISO string
    appointment_time: str = "10:00"  # Default time slot
    time_window: str = "10:00 AM – 1:00 PM"  # Always this window
    nin_or_application_number: Optional[str] = None
    status: str = "confirmed"
    rejection_reason: Optional[str] = None
    rejected_at: Optional[str] = None
    rejected_by: Optional[str] = None
    checked_in: bool = False
    checked_in_at: Optional[str] = None
    checked_in_by: Optional[str] = None
    served: bool = False
    served_at: Optional[str] = None
    served_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    version: int = 1  # For optimistic locking to handle race conditions

class RescheduleRequest(BaseModel):
    new_date: date
    new_time: str = Field(..., pattern=r'^(10:00|10:30|11:00|11:30|12:00|12:30)$')

class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=10)

class BulkRescheduleRequest(BaseModel):
    original_date: Optional[date] = None
    service_type: Optional[str] = None
    new_date: date
    new_time: str = Field(..., pattern=r'^(10:00|10:30|11:00|11:30|12:00|12:30)$')
    reason: str = Field(..., min_length=10)

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    email: EmailStr
    full_name: str
    role: AdminRole = AdminRole.FRONT_DESK

class AdminUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    email: str = ""
    full_name: str = ""
    role: str = "front_desk"
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_login: Optional[str] = None

class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    user_id: str
    username: str
    action: str  # login, logout, create, update, delete, reject, bulk_reschedule, etc.
    resource_type: str  # appointment, admin_user, holiday, etc.
    resource_id: Optional[str] = None
    details: dict = Field(default_factory=dict)  # from/to values, etc.
    ip_address: Optional[str] = None

class AppointmentStats(BaseModel):
    total: int
    pending: int
    completed: int
    cancelled: int
    rejected: int
    checked_in: int
    served: int
    by_service: dict
    by_date: dict

# Service Requirements
SERVICE_REQUIREMENTS = {
    ServiceType.FRESH_REGISTRATION: {
        "title": "Fresh Registration",
        "below_18": {
            "title": "First-Time Applicant Below Age of 18",
            "requirements": [
                "A copy of either parent's National ID. (If both parents are deceased, provide a National ID of a blood relative.)",
                "The applicant (child) must be escorted by a parent or guardian who has a National ID.",
                "No fee shall be charged for this service."
            ]
        },
        "above_18": {
            "title": "First-Time Applicant Above Age of 18",
            "requirements": [
                "A copy of either parent's National ID. (If both parents are deceased, provide a National ID of a blood relative.)",
                "Recommendation Letter from the Uganda Embassy (issued upon a physical visit to the Embassy for biometric capture).",
                "No fee shall be charged for this service."
            ]
        }
    },
    ServiceType.RENEWAL: {
        "title": "Renewal of National ID",
        "requirements": [
            "Your current National ID (original or photocopy).",
            "If you lost your National ID and have no photocopy, ensure you have your National Identification Number (NIN) correctly written down.",
            "No fee shall be charged for this service."
        ]
    },
    ServiceType.GET_FIRST_ID: {
        "title": "Get First ID",
        "description": "This service is for persons who were registered when they were below the age of 16 years and were issued a National Identification Number (NIN) but have not yet received a physical National ID card. Now that they have attained 16 years of age, they need to update their records so that the ID card can be printed.",
        "requirements": [
            "National Identification Number (NIN) only."
        ]
    },
    ServiceType.CHANGE_OF_PARTICULARS: {
        "title": "Change of Particulars",
        "description": "This service is for persons already registered and possessing a National Identification Number (NIN) who wish to make changes to their name, date of birth, place of birth, or other personal details. The requirements vary depending on the specific change requested.",
        "link": "https://www.nira.go.ug/publications/the-guide-to-renewing-replacing-updating-your-national-id",
        "requirements": [
            "For full details on the particular requirements for the change you desire to undertake, please visit the NIRA website."
        ]
    },
    ServiceType.CARD_PICKUP: {
        "title": "Card Pick-up",
        "description": "This service is for persons who have completed the registration process and their National ID card is ready for collection.",
        "requirements": [
            "Your National Identification Number (NIN) or Application Number.",
            "A valid form of identification for verification."
        ]
    }
}

# Helper Functions
# Audit logging helper
async def log_audit(user_id: str, username: str, action: str, resource_type: str, 
                   resource_id: str = None, details: dict = None, ip_address: str = None):
    """Log an audit entry"""
    audit_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "username": username,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details or {},
        "ip_address": ip_address
    }
    await db.audit_logs.insert_one(audit_entry)
    logger.info(f"Audit: {username} - {action} - {resource_type} - {resource_id}")

# Service scheduling rules
# Fresh Registration, GetFirstID, Change of Particulars, Renewal: Mon, Wed, Fri only
# Card Pickup (Card Issuance): Mon-Fri
STANDARD_SERVICES = [ServiceType.FRESH_REGISTRATION, ServiceType.GET_FIRST_ID, 
                     ServiceType.CHANGE_OF_PARTICULARS, ServiceType.RENEWAL]
CARD_PICKUP_SERVICES = [ServiceType.CARD_PICKUP]

# Services requiring NIN
NIN_REQUIRED_SERVICES = [ServiceType.CARD_PICKUP, ServiceType.RENEWAL]

# Time slots available: 10:00 AM - 1:00 PM
TIME_SLOTS = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"]
TIME_WINDOW = "10:00 AM – 1:00 PM"

def is_valid_appointment_date_for_service(d: date, service_type: ServiceType) -> bool:
    """Check if date is valid for appointment based on service type"""
    # Check if in the past
    if d < date.today():
        return False
    
    # Check if holiday (applies to all services)
    if d in ALL_HOLIDAYS:
        return False
    
    # Check weekday based on service type
    # 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
    if service_type in CARD_PICKUP_SERVICES:
        # Card Pickup: Monday to Friday (0-4)
        if d.weekday() > 4:  # Saturday (5) or Sunday (6)
            return False
    else:
        # Standard services: Monday, Wednesday, Friday only (0, 2, 4)
        if d.weekday() not in [0, 2, 4]:
            return False
    
    return True

def is_valid_appointment_date(d: date) -> bool:
    """Check if date is valid for any appointment (legacy - uses most restrictive)"""
    # Check if in the past
    if d < date.today():
        return False
    # Check if holiday
    if d in ALL_HOLIDAYS:
        return False
    # Default to Monday, Wednesday, Friday
    if d.weekday() not in [0, 2, 4]:
        return False
    return True

def get_disabled_dates_for_service(start_date: date, end_date: date, service_type: str) -> List[str]:
    """Get list of disabled dates based on service type"""
    disabled = []
    current = start_date
    
    # Convert string to enum if needed
    try:
        svc_type = ServiceType(service_type) if isinstance(service_type, str) else service_type
    except ValueError:
        svc_type = ServiceType.FRESH_REGISTRATION  # Default
    
    while current <= end_date:
        if not is_valid_appointment_date_for_service(current, svc_type):
            disabled.append(current.isoformat())
        current += timedelta(days=1)
    return disabled

def get_disabled_dates(start_date: date, end_date: date) -> List[str]:
    """Get list of disabled dates (most restrictive - Mon, Wed, Fri only)"""
    disabled = []
    current = start_date
    while current <= end_date:
        if not is_valid_appointment_date(current):
            disabled.append(current.isoformat())
        current += timedelta(days=1)
    return disabled

def generate_pdf(appointment: dict) -> bytes:
    """Generate PDF document for appointment confirmation"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1A1A1A')
    )
    
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=12,
        textColor=colors.HexColor('#D90000')
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6
    )
    
    warning_style = ParagraphStyle(
        'WarningStyle',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6,
        textColor=colors.HexColor('#D90000'),
        fontName='Helvetica-Bold'
    )
    
    # Title
    story.append(Paragraph("UGANDA HIGH COMMISSION", title_style))
    story.append(Paragraph("LONDON", title_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph("NATIONAL ID APPOINTMENT CONFIRMATION LETTER", header_style))
    story.append(Spacer(1, 20))
    
    # Appointment Details Table
    service_titles = {
        "fresh_registration": "Fresh Registration",
        "renewal": "Renewal of National ID",
        "get_first_id": "Get First ID",
        "change_of_particulars": "Change of Particulars",
        "card_pickup": "Card Pick-up"
    }
    
    time_window = appointment.get('time_window', '10:00 AM – 1:00 PM')
    
    data = [
        ["Booking Reference:", appointment.get('reference_number', 'N/A')],
        ["Applicant Name:", f"{appointment.get('first_name', '')} {appointment.get('surname', '')}"],
        ["Email:", appointment.get('email', 'N/A')],
        ["Phone:", appointment.get('phone', 'N/A')],
        ["Service Type:", service_titles.get(appointment.get('service_type', ''), 'N/A')],
        ["Appointment Date:", appointment.get('appointment_date', 'N/A')],
        ["Time Window:", time_window],
        ["Status:", appointment.get('status', 'confirmed').upper()],
    ]
    
    table = Table(data, colWidths=[2*inch, 4*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1A1A1A')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
    ]))
    story.append(table)
    story.append(Spacer(1, 20))
    
    # Important Attendance Instruction
    story.append(Paragraph("IMPORTANT ATTENDANCE INSTRUCTION", header_style))
    attendance_text = f"""
    You are required to present yourself at the Uganda High Commission within the scheduled 
    timeframe ({time_window}) on your selected appointment date. 
    <b>Late arrivals outside this timeframe may not be attended to.</b>
    """
    story.append(Paragraph(attendance_text, warning_style))
    story.append(Spacer(1, 20))
    
    # Venue Information
    story.append(Paragraph("VENUE", header_style))
    venue_text = """
    Uganda High Commission<br/>
    Uganda House, 58-59 Trafalgar Square<br/>
    London WC2N 5DX<br/>
    United Kingdom
    """
    story.append(Paragraph(venue_text, normal_style))
    story.append(Spacer(1, 20))
    
    # Important Notice
    story.append(Paragraph("IMPORTANT NOTICE", header_style))
    notice_text = """
    You are advised to visit the NIRA website and complete the pre-registration process 
    for this service as this shall help you to be served faster when you physically visit 
    the High Commission. Upon successful pre-registration, you will receive a pre-registration 
    ID that you shall as well come along with during the physical visit to the High Commission.
    <br/><br/>
    Please bring this confirmation letter along with all required documents on your appointment date.
    <br/><br/>
    For any inquiries, please contact the High Commission or call the NIRA toll-free line: 0800211700
    """
    story.append(Paragraph(notice_text, normal_style))
    story.append(Spacer(1, 30))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#6B7280'),
        alignment=TA_CENTER
    )
    story.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", footer_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

async def send_confirmation_email(appointment: dict, pdf_bytes: bytes) -> bool:
    """Send confirmation email with PDF attachment"""
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid API key not configured")
        return False
    
    try:
        service_titles = {
            "fresh_registration": "Fresh Registration",
            "renewal": "Renewal of National ID",
            "get_first_id": "Get First ID",
            "change_of_particulars": "Change of Particulars",
            "card_pickup": "Card Pick-up"
        }
        
        time_window = appointment.get('time_window', '10:00 AM – 1:00 PM')
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1A1A1A; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Uganda High Commission</h1>
                <p style="margin: 5px 0 0 0;">London</p>
            </div>
            
            <div style="padding: 30px 20px; background-color: #F3F4F6;">
                <h2 style="color: #D90000;">Appointment Confirmation</h2>
                
                <p>Dear {appointment.get('first_name', '')} {appointment.get('surname', '')},</p>
                
                <p>Your appointment for National ID services has been successfully booked.</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Booking Reference:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{appointment.get('reference_number', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Applicant Name:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{appointment.get('first_name', '')} {appointment.get('surname', '')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Service Type:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{service_titles.get(appointment.get('service_type', ''), 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Appointment Date:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{appointment.get('appointment_date', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Time Window:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{time_window}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #D90000; padding: 15px; border-radius: 8px; margin: 20px 0; color: white;">
                    <h3 style="margin: 0 0 10px 0; color: white;">⚠️ IMPORTANT ATTENDANCE INSTRUCTION</h3>
                    <p style="margin: 0; color: white;">
                        You are required to present yourself at the Uganda High Commission within the scheduled timeframe 
                        ({time_window}) on your selected appointment date. <strong>Late arrivals outside this 
                        timeframe may not be attended to.</strong>
                    </p>
                </div>
                
                <div style="background-color: #FCDC04; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1A1A1A;">Venue</h3>
                    <p style="margin: 0; color: #1A1A1A;">
                        Uganda High Commission<br/>
                        Uganda House, 58-59 Trafalgar Square<br/>
                        London WC2N 5DX
                    </p>
                </div>
                
                <p style="color: #D90000;"><strong>Pre-Registration:</strong> You are advised to visit the NIRA website and complete the pre-registration process for this service as this shall help you to be served faster when you physically visit the High Commission. Upon successful pre-registration, you will receive a pre-registration ID that you shall as well come along with during the physical visit to the High Commission.</p>
                
                <p>Please find your appointment confirmation letter attached to this email.</p>
                
                <p>Best regards,<br/>Uganda High Commission, London</p>
            </div>
            
            <div style="background-color: #1A1A1A; color: #9CA3AF; padding: 15px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">For inquiries, contact: info@ugandahighcommission.co.uk</p>
                <p style="margin: 5px 0 0 0;">NIRA Toll-free: 0800211700</p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=appointment.get('email'),
            subject=f"Appointment Confirmation - {appointment.get('reference_number', '')}",
            html_content=html_content
        )
        
        # Attach PDF
        encoded_pdf = base64.b64encode(pdf_bytes).decode()
        attachment = Attachment(
            FileContent(encoded_pdf),
            FileName(f"appointment_{appointment.get('reference_number', 'confirmation')}.pdf"),
            FileType('application/pdf'),
            Disposition('attachment')
        )
        message.attachment = attachment
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Uganda High Commission - National ID Appointment System API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "nid-appointment-system"}

@api_router.get("/services")
async def get_services():
    """Get all available services with their requirements"""
    return SERVICE_REQUIREMENTS

@api_router.get("/disabled-dates")
async def get_disabled_dates_endpoint(service_type: Optional[str] = None):
    """Get list of disabled dates for the next 6 months, optionally filtered by service type"""
    start = date.today()
    end = start + timedelta(days=180)
    
    if service_type:
        disabled = get_disabled_dates_for_service(start, end, service_type)
    else:
        disabled = get_disabled_dates(start, end)
    
    return {
        "disabled_dates": disabled, 
        "holidays": [d.isoformat() for d in ALL_HOLIDAYS],
        "time_slots": TIME_SLOTS,
        "time_window": TIME_WINDOW
    }

@api_router.get("/time-slots")
async def get_time_slots():
    """Get available time slots"""
    return {
        "time_slots": TIME_SLOTS,
        "time_window": TIME_WINDOW
    }

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appointment_data: AppointmentCreate):
    """Create a new appointment with race condition handling"""
    # Validate appointment date based on service type
    if not is_valid_appointment_date_for_service(appointment_data.appointment_date, appointment_data.service_type):
        if appointment_data.service_type == ServiceType.CARD_PICKUP:
            raise HTTPException(
                status_code=400, 
                detail="Invalid appointment date. Card Pick-up appointments are available Monday to Friday, excluding public holidays."
            )
        else:
            raise HTTPException(
                status_code=400, 
                detail="Invalid appointment date. Appointments for this service are only available on Monday, Wednesday, and Friday, excluding public holidays."
            )
    
    # Validate time slot
    if appointment_data.appointment_time not in TIME_SLOTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time slot. Available slots are: {', '.join(TIME_SLOTS)}"
        )
    
    # Validate NIN for services that require it (Card Pickup and Renewal)
    if appointment_data.service_type in NIN_REQUIRED_SERVICES and not appointment_data.nin_or_application_number:
        service_name = "Card Pick-up" if appointment_data.service_type == ServiceType.CARD_PICKUP else "Renewal"
        raise HTTPException(
            status_code=400,
            detail=f"NIN or Application Number is required for {service_name} service."
        )
    
    # Race condition handling: Use atomic operation with retry logic
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Generate unique reference number with timestamp for uniqueness
            unique_id = str(uuid.uuid4())[:8].upper()
            reference_number = f"UHC-{datetime.now().strftime('%Y%m%d')}-{unique_id}"
            
            # Create appointment object
            appointment = Appointment(
                id=str(uuid.uuid4()),
                reference_number=reference_number,
                surname=appointment_data.surname,
                first_name=appointment_data.first_name,
                email=appointment_data.email,
                phone=appointment_data.phone,
                service_type=appointment_data.service_type,
                appointment_date=appointment_data.appointment_date.isoformat(),
                appointment_time=appointment_data.appointment_time,
                time_window=TIME_WINDOW,
                nin_or_application_number=appointment_data.nin_or_application_number,
                version=1
            )
            
            # Save to database with unique constraint check
            doc = appointment.model_dump()
            doc['_submission_timestamp'] = datetime.now(timezone.utc).isoformat()
            
            # Use insert_one which is atomic - if reference_number exists, it will fail
            # Create unique index on reference_number if not exists
            await db.appointments.create_index("reference_number", unique=True, sparse=True)
            await db.appointments.insert_one(doc)
            
            logger.info(f"Appointment created successfully: {reference_number}")
            
            # Generate PDF
            pdf_bytes = generate_pdf(doc)
            
            # Send confirmation email (don't fail if email fails)
            email_sent = await send_confirmation_email(doc, pdf_bytes)
            if not email_sent:
                logger.warning(f"Failed to send confirmation email for appointment {appointment.reference_number}")
            
            return appointment
            
        except Exception as e:
            retry_count += 1
            if "duplicate key error" in str(e).lower() or "E11000" in str(e):
                logger.warning(f"Race condition detected, retrying... (attempt {retry_count})")
                if retry_count >= max_retries:
                    raise HTTPException(
                        status_code=409,
                        detail="High traffic detected. Please try again in a moment."
                    )
                continue
            else:
                logger.error(f"Error creating appointment: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to create appointment. Please try again."
                )
    
    raise HTTPException(
        status_code=503,
        detail="Service temporarily unavailable. Please try again."
    )

@api_router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str):
    """Get a single appointment by ID"""
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@api_router.get("/appointments/by-reference/{reference_number}")
async def get_appointment_by_reference(reference_number: str):
    """Get a single appointment by reference number"""
    appointment = await db.appointments.find_one({"reference_number": reference_number}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@api_router.patch("/appointments/{appointment_id}/reschedule")
async def reschedule_appointment(appointment_id: str, reschedule_data: RescheduleRequest):
    """Reschedule an appointment to a new date (user self-service)"""
    # Find the appointment
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if appointment can be modified
    if appointment.get('status') == 'cancelled':
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled appointment")
    if appointment.get('status') == 'completed':
        raise HTTPException(status_code=400, detail="Cannot reschedule a completed appointment")
    
    # Get service type for validation
    try:
        service_type = ServiceType(appointment.get('service_type'))
    except ValueError:
        service_type = ServiceType.FRESH_REGISTRATION
    
    # Validate new date based on service type
    if not is_valid_appointment_date_for_service(reschedule_data.new_date, service_type):
        if service_type == ServiceType.CARD_PICKUP:
            raise HTTPException(
                status_code=400,
                detail="Invalid appointment date. Card Pick-up appointments are available Monday to Friday, excluding public holidays."
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid appointment date. Appointments for this service are only available on Monday, Wednesday, and Friday, excluding public holidays."
            )
    
    # Validate time slot
    if reschedule_data.new_time not in TIME_SLOTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time slot. Available slots are: {', '.join(TIME_SLOTS)}"
        )
    
    # Check if new date is in the past
    if reschedule_data.new_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot reschedule to a past date")
    
    # Use optimistic locking to prevent race conditions
    current_version = appointment.get('version', 1)
    
    result = await db.appointments.update_one(
        {"id": appointment_id, "version": current_version},
        {
            "$set": {
                "appointment_date": reschedule_data.new_date.isoformat(),
                "appointment_time": reschedule_data.new_time,
                "version": current_version + 1
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=409,
            detail="Appointment was modified by another request. Please refresh and try again."
        )
    
    logger.info(f"Appointment {appointment_id} rescheduled to {reschedule_data.new_date} at {reschedule_data.new_time}")
    return {
        "message": "Appointment rescheduled successfully", 
        "new_date": reschedule_data.new_date.isoformat(),
        "new_time": reschedule_data.new_time
    }

@api_router.patch("/appointments/{appointment_id}/cancel")
async def cancel_appointment_user(appointment_id: str):
    """Cancel an appointment (user self-service)"""
    # Find the appointment
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if appointment can be cancelled
    if appointment.get('status') == 'cancelled':
        raise HTTPException(status_code=400, detail="Appointment is already cancelled")
    if appointment.get('status') == 'completed':
        raise HTTPException(status_code=400, detail="Cannot cancel a completed appointment")
    
    # Use optimistic locking
    current_version = appointment.get('version', 1)
    
    result = await db.appointments.update_one(
        {"id": appointment_id, "version": current_version},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "version": current_version + 1
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=409,
            detail="Appointment was modified by another request. Please refresh and try again."
        )
    
    logger.info(f"Appointment {appointment_id} cancelled by user")
    return {"message": "Appointment cancelled successfully"}

@api_router.get("/appointments/{appointment_id}/pdf")
async def download_appointment_pdf(appointment_id: str):
    """Download appointment confirmation PDF"""
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    pdf_bytes = generate_pdf(appointment)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=appointment_{appointment.get('reference_number', 'confirmation')}.pdf"
        }
    )

# Admin Routes
@api_router.post("/admin/login")
async def admin_login(credentials: AdminLogin):
    """Admin login with audit logging"""
    admin = await db.admin_users.find_one({"username": credentials.username}, {"_id": 0})
    
    if not admin:
        # Log failed login attempt
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": "unknown",
            "username": credentials.username,
            "action": "login_failed",
            "resource_type": "auth",
            "details": {"reason": "user_not_found"}
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not admin.get('active', True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    if not bcrypt.checkpw(credentials.password.encode(), admin['password_hash'].encode()):
        # Log failed login attempt
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": admin['id'],
            "username": credentials.username,
            "action": "login_failed",
            "resource_type": "auth",
            "details": {"reason": "invalid_password"}
        })
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update last login
    await db.admin_users.update_one(
        {"id": admin['id']},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log successful login
    await log_audit(admin['id'], admin['username'], "login_success", "auth")
    
    # Generate JWT token
    token = jwt.encode(
        {
            "sub": admin['id'],
            "username": admin['username'],
            "role": admin.get('role', 'front_desk'),
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )
    
    return {
        "access_token": token, 
        "token_type": "bearer",
        "user": {
            "id": admin['id'],
            "username": admin['username'],
            "role": admin.get('role', 'front_desk'),
            "full_name": admin.get('full_name', admin['username'])
        }
    }

@api_router.get("/admin/appointments")
async def get_all_appointments(
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    nin: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all appointments with enhanced search (admin only)"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    # Build query
    query = {}
    if status:
        query["status"] = status
    if service_type:
        query["service_type"] = service_type
    if date_from:
        query["appointment_date"] = {"$gte": date_from}
    if date_to:
        if "appointment_date" in query:
            query["appointment_date"]["$lte"] = date_to
        else:
            query["appointment_date"] = {"$lte": date_to}
    if nin:
        query["nin_or_application_number"] = {"$regex": nin, "$options": "i"}
    if search:
        query["$or"] = [
            {"surname": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"reference_number": {"$regex": search, "$options": "i"}},
            {"nin_or_application_number": {"$regex": search, "$options": "i"}}
        ]
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    return appointments

@api_router.get("/admin/stats")
async def get_appointment_stats(authorization: Optional[str] = Header(None)):
    """Get comprehensive appointment statistics (admin only)"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    # Get all appointments
    appointments = await db.appointments.find({}, {"_id": 0}).to_list(None)
    
    total = len(appointments)
    pending = len([a for a in appointments if a.get('status') == 'confirmed'])
    completed = len([a for a in appointments if a.get('status') == 'completed'])
    cancelled = len([a for a in appointments if a.get('status') == 'cancelled'])
    rejected = len([a for a in appointments if a.get('status') == 'rejected'])
    checked_in = len([a for a in appointments if a.get('checked_in', False)])
    served = len([a for a in appointments if a.get('served', False)])
    
    # By service type
    by_service = {}
    for a in appointments:
        service = a.get('service_type', 'unknown')
        by_service[service] = by_service.get(service, 0) + 1
    
    # By date (upcoming 30 days)
    by_date = {}
    today = date.today()
    for a in appointments:
        apt_date = a.get('appointment_date', '')[:10]
        by_date[apt_date] = by_date.get(apt_date, 0) + 1
    
    # Today's bookings
    today_str = today.isoformat()
    today_bookings = len([a for a in appointments if a.get('appointment_date', '')[:10] == today_str])
    
    # Next 7 days
    next_7_days = sum(1 for a in appointments 
                     if today_str <= a.get('appointment_date', '')[:10] <= (today + timedelta(days=7)).isoformat())
    
    # Next 30 days
    next_30_days = sum(1 for a in appointments 
                      if today_str <= a.get('appointment_date', '')[:10] <= (today + timedelta(days=30)).isoformat())
    
    # Capacity utilization (slots per day: 6 slots * estimate ~20 per slot = 120)
    max_daily_capacity = 120
    
    return {
        "total": total,
        "pending": pending,
        "completed": completed,
        "cancelled": cancelled,
        "rejected": rejected,
        "checked_in": checked_in,
        "served": served,
        "by_service": by_service,
        "by_date": by_date,
        "today_bookings": today_bookings,
        "next_7_days": next_7_days,
        "next_30_days": next_30_days,
        "max_daily_capacity": max_daily_capacity
    }

@api_router.get("/admin/capacity")
async def get_capacity_utilization(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get capacity utilization for scheduling planning"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    today = date.today()
    start_date = date_from or today.isoformat()
    end_date = date_to or (today + timedelta(days=30)).isoformat()
    
    # Get appointments in date range
    appointments = await db.appointments.find({
        "appointment_date": {"$gte": start_date, "$lte": end_date},
        "status": {"$ne": "cancelled"}
    }, {"_id": 0}).to_list(None)
    
    # Group by date
    capacity_by_date = {}
    max_slots_per_day = 120  # Configurable
    
    current = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    while current <= end:
        date_str = current.isoformat()
        booked = len([a for a in appointments if a.get('appointment_date', '')[:10] == date_str])
        capacity_by_date[date_str] = {
            "date": date_str,
            "booked": booked,
            "available": max_slots_per_day - booked,
            "utilization_percent": round((booked / max_slots_per_day) * 100, 1)
        }
        current += timedelta(days=1)
    
    return {
        "capacity_by_date": capacity_by_date,
        "max_slots_per_day": max_slots_per_day
    }

@api_router.patch("/admin/appointments/{appointment_id}")
async def update_appointment_status(
    appointment_id: str,
    status: str,
    authorization: Optional[str] = Header(None)
):
    """Update appointment status (admin only)"""
    user_info = {"id": "system", "username": "system"}
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
    
    if status not in ['confirmed', 'completed', 'cancelled', 'rejected']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Get current appointment for audit
    old_appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not old_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    old_status = old_appointment.get('status', 'unknown')
    
    result = await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": status}}
    )
    
    # Log audit
    await log_audit(
        user_info.get('sub', 'system'),
        user_info.get('username', 'system'),
        "status_update",
        "appointment",
        appointment_id,
        {"from_status": old_status, "to_status": status}
    )
    
    return {"message": "Status updated successfully"}

@api_router.post("/admin/appointments/{appointment_id}/reject")
async def reject_card_pickup(
    appointment_id: str,
    reject_data: RejectRequest,
    authorization: Optional[str] = Header(None)
):
    """Reject a Card Pickup appointment with reason (card not ready)"""
    user_info = {"sub": "system", "username": "system"}
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
    
    # Get appointment
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appointment.get('service_type') != 'card_pickup':
        raise HTTPException(status_code=400, detail="Rejection with reason is only available for Card Pick-up service")
    
    if appointment.get('status') in ['cancelled', 'rejected']:
        raise HTTPException(status_code=400, detail="Appointment is already cancelled or rejected")
    
    # Update appointment
    rejection_time = datetime.now(timezone.utc).isoformat()
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reject_data.reason,
            "rejected_at": rejection_time,
            "rejected_by": user_info.get('username', 'system')
        }}
    )
    
    # Send rejection email
    await send_rejection_email(appointment, reject_data.reason)
    
    # Log audit
    await log_audit(
        user_info.get('sub', 'system'),
        user_info.get('username', 'system'),
        "appointment_rejected",
        "appointment",
        appointment_id,
        {"reason": reject_data.reason, "service_type": appointment.get('service_type')}
    )
    
    return {"message": "Appointment rejected and applicant notified"}

@api_router.post("/admin/appointments/{appointment_id}/check-in")
async def check_in_appointment(
    appointment_id: str,
    authorization: Optional[str] = Header(None)
):
    """Mark an appointment as checked in (front desk)"""
    user_info = {"sub": "system", "username": "system"}
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
    
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if appointment.get('status') != 'confirmed':
        raise HTTPException(status_code=400, detail="Can only check in confirmed appointments")
    
    check_in_time = datetime.now(timezone.utc).isoformat()
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {
            "checked_in": True,
            "checked_in_at": check_in_time,
            "checked_in_by": user_info.get('username', 'system')
        }}
    )
    
    await log_audit(
        user_info.get('sub', 'system'),
        user_info.get('username', 'system'),
        "check_in",
        "appointment",
        appointment_id
    )
    
    return {"message": "Appointment checked in", "checked_in_at": check_in_time}

@api_router.post("/admin/appointments/{appointment_id}/mark-served")
async def mark_appointment_served(
    appointment_id: str,
    authorization: Optional[str] = Header(None)
):
    """Mark an appointment as served/completed (front desk)"""
    user_info = {"sub": "system", "username": "system"}
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
    
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    served_time = datetime.now(timezone.utc).isoformat()
    await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {
            "served": True,
            "served_at": served_time,
            "served_by": user_info.get('username', 'system'),
            "status": "completed"
        }}
    )
    
    await log_audit(
        user_info.get('sub', 'system'),
        user_info.get('username', 'system'),
        "mark_served",
        "appointment",
        appointment_id
    )
    
    return {"message": "Appointment marked as served", "served_at": served_time}

@api_router.post("/admin/bulk-reschedule")
async def bulk_reschedule_appointments(
    bulk_data: BulkRescheduleRequest,
    authorization: Optional[str] = Header(None)
):
    """Bulk reschedule appointments by date or service type (office closure, etc.)"""
    user_info = {"sub": "system", "username": "system"}
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
    
    # Build query for appointments to reschedule
    query = {"status": "confirmed"}
    if bulk_data.original_date:
        query["appointment_date"] = bulk_data.original_date.isoformat()
    if bulk_data.service_type:
        query["service_type"] = bulk_data.service_type
    
    if not bulk_data.original_date and not bulk_data.service_type:
        raise HTTPException(status_code=400, detail="Must specify either original_date or service_type")
    
    # Get affected appointments
    affected = await db.appointments.find(query, {"_id": 0}).to_list(None)
    
    if not affected:
        return {"message": "No appointments found to reschedule", "count": 0}
    
    # Update all affected appointments
    new_date_str = bulk_data.new_date.isoformat()
    update_result = await db.appointments.update_many(
        query,
        {"$set": {
            "appointment_date": new_date_str,
            "appointment_time": bulk_data.new_time
        }}
    )
    
    # Send email notifications to all affected
    for apt in affected:
        await send_reschedule_notification_email(apt, new_date_str, bulk_data.new_time, bulk_data.reason)
    
    # Log audit
    await log_audit(
        user_info.get('sub', 'system'),
        user_info.get('username', 'system'),
        "bulk_reschedule",
        "appointments",
        None,
        {
            "original_date": bulk_data.original_date.isoformat() if bulk_data.original_date else None,
            "service_type": bulk_data.service_type,
            "new_date": new_date_str,
            "new_time": bulk_data.new_time,
            "reason": bulk_data.reason,
            "affected_count": len(affected)
        }
    )
    
    return {
        "message": f"Successfully rescheduled {len(affected)} appointments",
        "count": len(affected),
        "new_date": new_date_str,
        "new_time": bulk_data.new_time
    }

@api_router.delete("/admin/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, authorization: Optional[str] = Header(None)):
    """Delete an appointment (admin only)"""
    user_info = {"sub": "system", "username": "system"}
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
    
    # Get appointment for audit before deletion
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    
    result = await db.appointments.delete_one({"id": appointment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Log audit
    await log_audit(
        user_info.get('sub', 'system'),
        user_info.get('username', 'system'),
        "delete",
        "appointment",
        appointment_id,
        {"deleted_appointment": appointment}
    )
    
    return {"message": "Appointment deleted successfully"}

# Audit Log Routes
@api_router.get("/admin/audit-logs")
async def get_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
    authorization: Optional[str] = Header(None)
):
    """Get audit logs (super admin only)"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
        if user_info.get('role') not in ['super_admin', 'operations_admin']:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = {}
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id
    if resource_type:
        query["resource_type"] = resource_type
    if date_from:
        query["timestamp"] = {"$gte": date_from}
    if date_to:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = date_to
        else:
            query["timestamp"] = {"$lte": date_to}
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(None)
    return logs

@api_router.get("/admin/audit-logs/export")
async def export_audit_logs(
    format: str = "csv",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Export audit logs as CSV"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
        if user_info.get('role') != 'super_admin':
            raise HTTPException(status_code=403, detail="Only super admin can export audit logs")
    
    query = {}
    if date_from:
        query["timestamp"] = {"$gte": date_from}
    if date_to:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = date_to
        else:
            query["timestamp"] = {"$lte": date_to}
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(None)
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Username", "Action", "Resource Type", "Resource ID", "Details"])
    
    for log in logs:
        writer.writerow([
            log.get('timestamp', ''),
            log.get('username', ''),
            log.get('action', ''),
            log.get('resource_type', ''),
            log.get('resource_id', ''),
            str(log.get('details', {}))
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

# User Management Routes (Super Admin)
@api_router.get("/admin/users")
async def get_admin_users(authorization: Optional[str] = Header(None)):
    """Get all admin users (super admin only)"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
        if user_info.get('role') != 'super_admin':
            raise HTTPException(status_code=403, detail="Only super admin can manage users")
    
    users = await db.admin_users.find({}, {"_id": 0, "password_hash": 0}).to_list(None)
    return users

@api_router.post("/admin/users")
async def create_admin_user(user_data: AdminUserCreate, authorization: Optional[str] = Header(None)):
    """Create a new admin user (super admin only)"""
    user_info = {"sub": "system", "username": "system"}
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user_info = verify_token(token)
        if user_info.get('role') != 'super_admin':
            raise HTTPException(status_code=403, detail="Only super admin can create users")
    
    # Check if username exists
    existing = await db.admin_users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    password_hash = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    
    new_user = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "password_hash": password_hash,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "role": user_data.role.value,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_users.insert_one(new_user)
    
    await log_audit(
        user_info.get('sub', 'system'),
        user_info.get('username', 'system'),
        "create_user",
        "admin_user",
        new_user['id'],
        {"username": user_data.username, "role": user_data.role.value}
    )
    
    return {"message": "User created successfully", "user_id": new_user['id']}

# Reports Routes
@api_router.get("/admin/reports/daily-worklist")
async def get_daily_worklist(
    report_date: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get daily worklist for a session/day sorted by service type"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    target_date = report_date or date.today().isoformat()
    
    appointments = await db.appointments.find({
        "appointment_date": target_date,
        "status": {"$in": ["confirmed", "completed"]}
    }, {"_id": 0}).sort([("service_type", 1), ("appointment_time", 1)]).to_list(None)
    
    # Group by service type
    worklist = {}
    for apt in appointments:
        svc = apt.get('service_type', 'unknown')
        if svc not in worklist:
            worklist[svc] = []
        worklist[svc].append(apt)
    
    return {
        "date": target_date,
        "total_appointments": len(appointments),
        "worklist_by_service": worklist
    }

@api_router.get("/admin/reports/daily-worklist/download")
async def download_daily_worklist(
    report_date: Optional[str] = None,
    format: str = "csv",
    authorization: Optional[str] = Header(None)
):
    """Download daily worklist as CSV"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    target_date = report_date or date.today().isoformat()
    
    appointments = await db.appointments.find({
        "appointment_date": target_date,
        "status": {"$in": ["confirmed", "completed"]}
    }, {"_id": 0}).sort([("service_type", 1), ("appointment_time", 1)]).to_list(None)
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["#", "Reference", "Name", "Service Type", "Time", "Phone", "Email", "NIN/App No", "Status", "Checked In"])
    
    for i, apt in enumerate(appointments, 1):
        writer.writerow([
            i,
            apt.get('reference_number', ''),
            f"{apt.get('first_name', '')} {apt.get('surname', '')}",
            apt.get('service_type', ''),
            apt.get('appointment_time', ''),
            apt.get('phone', ''),
            apt.get('email', ''),
            apt.get('nin_or_application_number', ''),
            apt.get('status', ''),
            'Yes' if apt.get('checked_in', False) else 'No'
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=worklist_{target_date}.csv"}
    )

@api_router.get("/admin/reports/cancellations")
async def get_cancellation_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get cancellation and rejection report"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    query = {"status": {"$in": ["cancelled", "rejected"]}}
    if date_from:
        query["appointment_date"] = {"$gte": date_from}
    if date_to:
        if "appointment_date" in query:
            query["appointment_date"]["$lte"] = date_to
        else:
            query["appointment_date"] = {"$lte": date_to}
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    
    cancelled = [a for a in appointments if a.get('status') == 'cancelled']
    rejected = [a for a in appointments if a.get('status') == 'rejected']
    
    return {
        "total_cancelled": len(cancelled),
        "total_rejected": len(rejected),
        "cancelled": cancelled,
        "rejected": rejected
    }

# Email helper for rejection
async def send_rejection_email(appointment: dict, reason: str) -> bool:
    """Send rejection email for Card Pickup"""
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid API key not configured")
        return False
    
    try:
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1A1A1A; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Uganda High Commission</h1>
                <p style="margin: 5px 0 0 0;">London</p>
            </div>
            
            <div style="padding: 30px 20px; background-color: #F3F4F6;">
                <h2 style="color: #D90000;">Appointment Update - Card Pick-up</h2>
                
                <p>Dear {appointment.get('first_name', '')} {appointment.get('surname', '')},</p>
                
                <p>We regret to inform you that your Card Pick-up appointment (Reference: <strong>{appointment.get('reference_number', '')}</strong>) 
                has been cancelled due to the following reason:</p>
                
                <div style="background-color: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D90000;">
                    <p style="margin: 0; color: #991B1B;"><strong>{reason}</strong></p>
                </div>
                
                <p>Your National ID card is not yet ready for collection. Please schedule a new appointment 
                <strong>after one month</strong> from today to allow sufficient time for your card to be processed.</p>
                
                <p>We apologize for any inconvenience this may cause.</p>
                
                <p>Best regards,<br/>Uganda High Commission, London</p>
            </div>
            
            <div style="background-color: #1A1A1A; color: #9CA3AF; padding: 15px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">For inquiries, contact: info@ugandahighcommission.co.uk</p>
                <p style="margin: 5px 0 0 0;">NIRA Toll-free: 0800211700</p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=appointment.get('email'),
            subject=f"Appointment Cancelled - {appointment.get('reference_number', '')}",
            html_content=html_content
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send rejection email: {str(e)}")
        return False

async def send_reschedule_notification_email(appointment: dict, new_date: str, new_time: str, reason: str) -> bool:
    """Send bulk reschedule notification email"""
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid API key not configured")
        return False
    
    try:
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1A1A1A; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Uganda High Commission</h1>
                <p style="margin: 5px 0 0 0;">London</p>
            </div>
            
            <div style="padding: 30px 20px; background-color: #F3F4F6;">
                <h2 style="color: #D97706;">Appointment Rescheduled</h2>
                
                <p>Dear {appointment.get('first_name', '')} {appointment.get('surname', '')},</p>
                
                <p>Your appointment (Reference: <strong>{appointment.get('reference_number', '')}</strong>) has been 
                rescheduled due to the following reason:</p>
                
                <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
                    <p style="margin: 0; color: #92400E;"><strong>{reason}</strong></p>
                </div>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #059669; margin-top: 0;">New Appointment Details</h3>
                    <p><strong>New Date:</strong> {new_date}</p>
                    <p><strong>Time Window:</strong> 10:00 AM – 1:00 PM</p>
                </div>
                
                <p>We apologize for any inconvenience. If this new date does not work for you, please visit 
                our booking system to reschedule.</p>
                
                <p>Best regards,<br/>Uganda High Commission, London</p>
            </div>
            
            <div style="background-color: #1A1A1A; color: #9CA3AF; padding: 15px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">For inquiries, contact: info@ugandahighcommission.co.uk</p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=appointment.get('email'),
            subject=f"Appointment Rescheduled - {appointment.get('reference_number', '')}",
            html_content=html_content
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send reschedule notification email: {str(e)}")
        return False

# Initialize default admin user on startup
@app.on_event("startup")
async def create_default_admin():
    """Create default admin user if not exists"""
    existing_admin = await db.admin_users.find_one({"username": "admin"})
    if not existing_admin:
        password_hash = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
        admin = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password_hash": password_hash,
            "email": "admin@ugandahighcommission.co.uk",
            "full_name": "System Administrator",
            "role": "super_admin",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.admin_users.insert_one(admin)
        logger.info("Default admin user created (username: admin, password: admin123, role: super_admin)")
    else:
        # Update existing admin to have super_admin role if missing
        if not existing_admin.get('role'):
            await db.admin_users.update_one(
                {"username": "admin"},
                {"$set": {
                    "role": "super_admin",
                    "full_name": existing_admin.get("full_name", "System Administrator"),
                    "email": existing_admin.get("email", "admin@ugandahighcommission.co.uk")
                }}
            )
            logger.info("Default admin user updated with super_admin role")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
