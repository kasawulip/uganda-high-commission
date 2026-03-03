import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle, Download, Home, Loader2, Calendar, 
  MapPin, Phone, Mail, FileText, ExternalLink, AlertCircle, Clock 
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TIME_WINDOW = "10:00 AM – 1:00 PM";

const serviceNames = {
  fresh_registration: "Fresh Registration",
  renewal: "Renewal of National ID",
  get_first_id: "Get First ID",
  change_of_particulars: "Change of Particulars",
  card_pickup: "Card Pick-up"
};

export default function ConfirmationPage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    try {
      const response = await axios.get(`${API}/appointments/${appointmentId}`);
      setAppointment(response.data);
    } catch (err) {
      console.error("Failed to fetch appointment:", err);
      setError("Failed to load appointment details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!appointment) return;

    setDownloading(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const timeWindow = appointment.time_window || TIME_WINDOW;
      
      // Header
      doc.setFillColor(26, 26, 26);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("UGANDA HIGH COMMISSION", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(14);
      doc.text("LONDON", pageWidth / 2, 30, { align: "center" });
      
      // Title
      doc.setTextColor(217, 0, 0);
      doc.setFontSize(16);
      doc.text("NATIONAL ID APPOINTMENT CONFIRMATION LETTER", pageWidth / 2, 60, { align: "center" });
      
      // Appointment Details
      doc.setTextColor(26, 26, 26);
      doc.setFontSize(12);
      
      const startY = 80;
      const lineHeight = 12;
      const leftMargin = 25;
      const labelWidth = 55;
      
      const details = [
        ["Booking Reference:", appointment.reference_number],
        ["Applicant Name:", `${appointment.first_name} ${appointment.surname}`],
        ["Email:", appointment.email],
        ["Phone:", appointment.phone],
        ["Service Type:", serviceNames[appointment.service_type] || appointment.service_type],
        ["Appointment Date:", format(parseISO(appointment.appointment_date), "EEEE, MMMM do, yyyy")],
        ["Time Window:", timeWindow],
        ["Status:", appointment.status.toUpperCase()]
      ];
      
      details.forEach((row, index) => {
        const y = startY + (index * lineHeight);
        doc.setFont("helvetica", "bold");
        doc.text(row[0], leftMargin, y);
        doc.setFont("helvetica", "normal");
        doc.text(row[1], leftMargin + labelWidth, y);
      });
      
      // Important Attendance Instruction
      const attendanceY = startY + (details.length * lineHeight) + 15;
      doc.setFillColor(217, 0, 0);
      doc.rect(leftMargin - 5, attendanceY - 8, pageWidth - (leftMargin * 2) + 10, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("IMPORTANT ATTENDANCE INSTRUCTION", leftMargin, attendanceY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const attendanceText = `You are required to present yourself at the Uganda High Commission within the scheduled timeframe (${timeWindow}) on your selected appointment date. Late arrivals outside this timeframe may not be attended to.`;
      const splitAttendance = doc.splitTextToSize(attendanceText, pageWidth - (leftMargin * 2));
      doc.text(splitAttendance, leftMargin, attendanceY + 10);
      
      // Venue Section
      const venueY = attendanceY + 45;
      doc.setFillColor(252, 220, 4);
      doc.rect(leftMargin - 5, venueY - 8, pageWidth - (leftMargin * 2) + 10, 40, 'F');
      
      doc.setTextColor(26, 26, 26);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("VENUE", leftMargin, venueY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Uganda High Commission", leftMargin, venueY + 12);
      doc.text("Uganda House, 58-59 Trafalgar Square", leftMargin, venueY + 22);
      doc.text("London WC2N 5DX, United Kingdom", leftMargin, venueY + 32);
      
      // Important Notice
      const noticeY = venueY + 55;
      doc.setTextColor(217, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PRE-REGISTRATION NOTICE", leftMargin, noticeY);
      
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      const noticeText = [
        "You are advised to visit the NIRA website and complete the pre-registration",
        "process for this service as this shall help you to be served faster when you",
        "physically visit the High Commission. Upon successful pre-registration, you",
        "will receive a pre-registration ID that you shall as well come along with",
        "during the physical visit to the High Commission.",
        "",
        "Please bring this confirmation letter along with all required documents",
        "on your appointment date.",
        "",
        "For any inquiries, please contact the High Commission or call the",
        "NIRA toll-free line: 0800 211 700"
      ];
      
      noticeText.forEach((line, index) => {
        doc.text(line, leftMargin, noticeY + 12 + (index * 6));
      });
      
      // Footer
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(9);
      doc.text(`Generated on: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`, pageWidth / 2, 280, { align: "center" });
      
      // Save PDF - Use blob for better mobile compatibility
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `appointment_${appointment.reference_number}.pdf`;
      
      // For mobile devices, open in new tab if download doesn't work
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        link.target = '_blank';
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      toast.success("PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#D90000] mx-auto mb-4" />
          <p className="text-[#4B5563]">Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Error</h2>
            <p className="text-[#4B5563] mb-4">{error}</p>
            <Button onClick={() => navigate("/")} className="btn-primary">
              <Home className="w-4 h-4 mr-2" /> Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Success Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2">Appointment Confirmed!</h1>
          <p className="text-[#4B5563]">Your appointment has been successfully booked.</p>
        </div>

        {/* Appointment Details Card */}
        <Card className="shadow-lg border-0 mb-6 animate-slide-in" data-testid="confirmation-card">
          <CardHeader className="bg-[#1A1A1A] text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-3">
              <FileText className="w-5 h-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-[#4B5563]">Booking Reference</p>
                  <p className="font-mono font-semibold text-[#1A1A1A]" data-testid="reference-number">
                    {appointment.reference_number}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#4B5563]">Status</p>
                  <span className="status-badge confirmed" data-testid="appointment-status">
                    {appointment.status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[#4B5563]">Applicant Name</p>
                    <p className="font-medium text-[#1A1A1A]">
                      {appointment.first_name} {appointment.surname}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#4B5563]">Service Type</p>
                    <p className="font-medium text-[#1A1A1A]">
                      {serviceNames[appointment.service_type]}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-[#4B5563] mt-1" />
                    <div>
                      <p className="text-sm text-[#4B5563]">Email</p>
                      <p className="font-medium text-[#1A1A1A]">{appointment.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-[#4B5563] mt-1" />
                    <div>
                      <p className="text-sm text-[#4B5563]">Phone</p>
                      <p className="font-medium text-[#1A1A1A]">{appointment.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-[#D90000] mt-1" />
                    <div>
                      <p className="text-sm text-[#4B5563]">Appointment Date</p>
                      <p className="font-semibold text-[#1A1A1A] text-lg">
                        {format(parseISO(appointment.appointment_date), "EEEE, MMMM do, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-[#D90000] mt-1" />
                    <div>
                      <p className="text-sm text-[#4B5563]">Time Window</p>
                      <p className="font-semibold text-[#1A1A1A] text-lg">
                        {appointment.time_window || TIME_WINDOW}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Attendance Alert */}
        <Alert className="mb-6 border-[#D90000] bg-red-50">
          <AlertCircle className="h-5 w-5 text-[#D90000]" />
          <AlertTitle className="text-[#D90000] font-semibold">Important Attendance Instruction</AlertTitle>
          <AlertDescription className="text-[#4B5563] mt-2 font-medium">
            You are required to present yourself at the Uganda High Commission within the scheduled 
            timeframe ({appointment.time_window || TIME_WINDOW}) on your selected appointment date. 
            <span className="text-[#D90000]"> Late arrivals outside this timeframe may not be attended to.</span>
          </AlertDescription>
        </Alert>

        {/* Venue Card */}
        <Card className="shadow-lg border-0 mb-6 bg-[#FCDC04]">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-[#1A1A1A] flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-[#1A1A1A] text-lg mb-2">Venue</h3>
                <p className="text-[#1A1A1A]">
                  Uganda High Commission<br />
                  Uganda House, 58-59 Trafalgar Square<br />
                  London WC2N 5DX<br />
                  United Kingdom
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Notice */}
        <Alert className="mb-6 border-[#D90000] bg-red-50">
          <AlertCircle className="h-5 w-5 text-[#D90000]" />
          <AlertTitle className="text-[#D90000] font-semibold">Important Notice</AlertTitle>
          <AlertDescription className="text-[#4B5563] mt-2">
            You are advised to visit the NIRA website and complete the pre-registration process for this service 
            as this shall help you to be served faster when you physically visit the High Commission. Upon successful 
            pre-registration, you will receive a pre-registration ID that you shall as well come along with during 
            the physical visit to the High Commission.
          </AlertDescription>
          <a 
            href="https://servicebooking.nira.go.ug"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#D90000] font-medium mt-3 hover:underline"
          >
            Visit NIRA Pre-Registration <ExternalLink className="w-4 h-4" />
          </a>
        </Alert>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
          <Button 
            onClick={generatePDF}
            disabled={downloading}
            className="btn-primary download-btn"
            data-testid="download-pdf-btn"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download Appointment Confirmation Letter
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate("/")}
            className="btn-secondary"
            data-testid="go-home-btn"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        {/* Email Confirmation Note */}
        <p className="text-center text-sm text-[#4B5563] mt-6">
          A confirmation email has been sent to <strong>{appointment.email}</strong>
        </p>
      </div>
    </div>
  );
}
