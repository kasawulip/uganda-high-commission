from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date, timedelta
from enum import Enum
import io
import bcrypt
import jwt
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import base64

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
    nin_or_application_number: Optional[str] = None
    status: str = "confirmed"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AppointmentStats(BaseModel):
    total: int
    pending: int
    completed: int
    cancelled: int
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
def is_valid_appointment_date(d: date) -> bool:
    """Check if date is valid for appointment (Tue, Wed, Fri only, not a holiday)"""
    # Check if weekend (0=Monday, 5=Saturday, 6=Sunday)
    if d.weekday() in [0, 3, 5, 6]:  # Mon, Thu, Sat, Sun - invalid
        return False
    # Valid days are: 1=Tue, 2=Wed, 4=Fri
    if d.weekday() not in [1, 2, 4]:
        return False
    # Check if holiday
    if d in ALL_HOLIDAYS:
        return False
    # Check if in the past
    if d < date.today():
        return False
    return True

def get_disabled_dates(start_date: date, end_date: date) -> List[str]:
    """Get list of disabled dates (weekends + holidays) as ISO strings"""
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
    
    # Title
    story.append(Paragraph("UGANDA HIGH COMMISSION", title_style))
    story.append(Paragraph("LONDON", title_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph("NATIONAL ID APPOINTMENT CONFIRMATION", header_style))
    story.append(Spacer(1, 20))
    
    # Appointment Details Table
    service_titles = {
        "fresh_registration": "Fresh Registration",
        "renewal": "Renewal of National ID",
        "get_first_id": "Get First ID",
        "change_of_particulars": "Change of Particulars",
        "card_pickup": "Card Pick-up"
    }
    
    data = [
        ["Reference Number:", appointment.get('reference_number', 'N/A')],
        ["Full Name:", f"{appointment.get('surname', '')} {appointment.get('first_name', '')}"],
        ["Email:", appointment.get('email', 'N/A')],
        ["Phone:", appointment.get('phone', 'N/A')],
        ["Service Type:", service_titles.get(appointment.get('service_type', ''), 'N/A')],
        ["Appointment Date:", appointment.get('appointment_date', 'N/A')],
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
    story.append(Spacer(1, 30))
    
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
            "change_of_particulars": "Change of Particulars"
        }
        
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
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Reference Number:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{appointment.get('reference_number', 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Service Type:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{service_titles.get(appointment.get('service_type', ''), 'N/A')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;"><strong>Appointment Date:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #E5E7EB;">{appointment.get('appointment_date', 'N/A')}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #FCDC04; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1A1A1A;">Venue</h3>
                    <p style="margin: 0; color: #1A1A1A;">
                        Uganda High Commission<br/>
                        Uganda House, 58-59 Trafalgar Square<br/>
                        London WC2N 5DX
                    </p>
                </div>
                
                <p style="color: #D90000;"><strong>Important:</strong> You are advised to visit the NIRA website and complete the pre-registration as this shall help you to be served faster when you physically visit the High Commission.</p>
                
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
async def get_disabled_dates_endpoint():
    """Get list of disabled dates for the next 6 months"""
    start = date.today()
    end = start + timedelta(days=180)
    disabled = get_disabled_dates(start, end)
    return {"disabled_dates": disabled, "holidays": [d.isoformat() for d in ALL_HOLIDAYS]}

@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(appointment_data: AppointmentCreate):
    """Create a new appointment"""
    # Validate appointment date
    if not is_valid_appointment_date(appointment_data.appointment_date):
        raise HTTPException(
            status_code=400, 
            detail="Invalid appointment date. Appointments are only available on Tuesday, Wednesday, and Friday, excluding public holidays."
        )
    
    # Validate NIN for card pickup
    if appointment_data.service_type == ServiceType.CARD_PICKUP and not appointment_data.nin_or_application_number:
        raise HTTPException(
            status_code=400,
            detail="NIN or Application Number is required for Card Pick-up service."
        )
    
    # Create appointment object
    appointment = Appointment(
        surname=appointment_data.surname,
        first_name=appointment_data.first_name,
        email=appointment_data.email,
        phone=appointment_data.phone,
        service_type=appointment_data.service_type,
        appointment_date=appointment_data.appointment_date.isoformat(),
        nin_or_application_number=appointment_data.nin_or_application_number
    )
    
    # Save to database
    doc = appointment.model_dump()
    await db.appointments.insert_one(doc)
    
    # Generate PDF
    pdf_bytes = generate_pdf(doc)
    
    # Send confirmation email (don't fail if email fails)
    email_sent = await send_confirmation_email(doc, pdf_bytes)
    if not email_sent:
        logger.warning(f"Failed to send confirmation email for appointment {appointment.reference_number}")
    
    return appointment

@api_router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str):
    """Get a single appointment by ID"""
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

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
    """Admin login"""
    admin = await db.admin_users.find_one({"username": credentials.username}, {"_id": 0})
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode(), admin['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate JWT token
    token = jwt.encode(
        {
            "sub": admin['id'],
            "username": admin['username'],
            "exp": datetime.now(timezone.utc) + timedelta(hours=24)
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )
    
    return {"access_token": token, "token_type": "bearer"}

@api_router.get("/admin/appointments")
async def get_all_appointments(
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    authorization: Optional[str] = None
):
    """Get all appointments (admin only)"""
    # Verify token from header
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
    if search:
        query["$or"] = [
            {"surname": {"$regex": search, "$options": "i"}},
            {"first_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"reference_number": {"$regex": search, "$options": "i"}}
        ]
    
    appointments = await db.appointments.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    return appointments

@api_router.get("/admin/stats")
async def get_appointment_stats(authorization: Optional[str] = None):
    """Get appointment statistics (admin only)"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    # Get all appointments
    appointments = await db.appointments.find({}, {"_id": 0}).to_list(None)
    
    total = len(appointments)
    pending = len([a for a in appointments if a.get('status') == 'confirmed'])
    completed = len([a for a in appointments if a.get('status') == 'completed'])
    cancelled = len([a for a in appointments if a.get('status') == 'cancelled'])
    
    # By service type
    by_service = {}
    for a in appointments:
        service = a.get('service_type', 'unknown')
        by_service[service] = by_service.get(service, 0) + 1
    
    # By date (last 30 days)
    by_date = {}
    for a in appointments:
        apt_date = a.get('appointment_date', '')[:10]
        by_date[apt_date] = by_date.get(apt_date, 0) + 1
    
    return {
        "total": total,
        "pending": pending,
        "completed": completed,
        "cancelled": cancelled,
        "by_service": by_service,
        "by_date": by_date
    }

@api_router.patch("/admin/appointments/{appointment_id}")
async def update_appointment_status(
    appointment_id: str,
    status: str,
    authorization: Optional[str] = None
):
    """Update appointment status (admin only)"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    if status not in ['confirmed', 'completed', 'cancelled']:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.appointments.update_one(
        {"id": appointment_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    return {"message": "Status updated successfully"}

@api_router.delete("/admin/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, authorization: Optional[str] = None):
    """Delete an appointment (admin only)"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        verify_token(token)
    
    result = await db.appointments.delete_one({"id": appointment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    return {"message": "Appointment deleted successfully"}

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
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.admin_users.insert_one(admin)
        logger.info("Default admin user created (username: admin, password: admin123)")

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
