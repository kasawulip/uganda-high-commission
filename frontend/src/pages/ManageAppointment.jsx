import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ChevronLeft, Calendar as CalendarIcon, XCircle, Loader2, 
  AlertCircle, CheckCircle, MapPin, Phone, Mail, FileText, Home,
  Download, Ban, Clock
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const serviceNames = {
  fresh_registration: "Fresh Registration",
  renewal: "Renewal of National ID",
  get_first_id: "Get First ID",
  change_of_particulars: "Change of Particulars",
  card_pickup: "Card Pick-up"
};

const TIME_SLOTS = [
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "12:30", label: "12:30 PM" }
];

export default function ManageAppointment() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState(null);
  const [disabledDates, setDisabledDates] = useState([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(null);
  const [newTime, setNewTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  
  // Cancel state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchAppointment();
    fetchDisabledDates();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to find by reference number first, then by ID
      let response;
      try {
        response = await axios.get(`${API}/appointments/by-reference/${appointmentId}`);
      } catch (e) {
        // If not found by reference, try by ID
        response = await axios.get(`${API}/appointments/${appointmentId}`);
      }
      setAppointment(response.data);
    } catch (err) {
      console.error("Failed to fetch appointment:", err);
      if (err.response?.status === 404) {
        setError("Appointment not found. Please check your reference number and try again.");
      } else {
        setError("Failed to load appointment details. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDisabledDates = async () => {
    try {
      const response = await axios.get(`${API}/disabled-dates`);
      const dates = response.data.disabled_dates.map(d => parseISO(d));
      setDisabledDates(dates);
    } catch (error) {
      console.error("Failed to fetch disabled dates:", error);
    }
  };

  const isDateDisabled = (date) => {
    return disabledDates.some(d => 
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );
  };

  const handleReschedule = async () => {
    if (!newDate) {
      toast.error("Please select a new date");
      return;
    }

    setRescheduling(true);
    try {
      const formattedDate = format(newDate, "yyyy-MM-dd");
      await axios.patch(`${API}/appointments/${appointment.id}/reschedule`, {
        new_date: formattedDate,
        new_time: newTime || appointment.appointment_time || "10:00"
      });
      toast.success("Appointment rescheduled successfully!");
      setShowReschedule(false);
      setNewDate(null);
      setNewTime("");
      fetchAppointment(); // Refresh data
    } catch (err) {
      console.error("Failed to reschedule:", err);
      const message = err.response?.data?.detail || "Failed to reschedule appointment. Please try again.";
      toast.error(message);
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await axios.patch(`${API}/appointments/${appointment.id}/cancel`);
      toast.success("Appointment cancelled successfully");
      setShowCancelDialog(false);
      fetchAppointment(); // Refresh data
    } catch (err) {
      console.error("Failed to cancel:", err);
      const message = err.response?.data?.detail || "Failed to cancel appointment. Please try again.";
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  // Download PDF using blob to avoid pop-up blockers
  const handleDownloadPdf = async () => {
    if (!appointment?.id) return;
    
    setDownloadingPdf(true);
    try {
      const response = await axios.get(`${API}/appointments/${appointment.id}/pdf`, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/pdf'
        }
      });
      
      // Create blob URL
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `appointment_${appointment.reference_number}.pdf`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success("PDF downloaded successfully!");
    } catch (err) {
      console.error("Failed to download PDF:", err);
      toast.error("Failed to download PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
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
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">Appointment Not Found</h2>
            <p className="text-[#4B5563] mb-6">{error}</p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/")} className="w-full btn-primary">
                <Home className="w-4 h-4 mr-2" /> Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCancelled = appointment?.status === "cancelled";
  const isCompleted = appointment?.status === "completed";
  const isRejected = appointment?.status === "rejected";
  const canModify = !isCancelled && !isCompleted && !isRejected;
  const canDownloadPdf = appointment?.status === "confirmed";

  return (
    <div className="min-h-screen bg-[#F3F4F6] py-6 md:py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="mb-4"
            data-testid="back-btn"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A1A]">Manage Appointment</h1>
          <p className="text-[#4B5563] mt-1 text-sm md:text-base">
            View, reschedule, or cancel your appointment
          </p>
        </div>

        {/* Rejection Alert - Prominent notification for rejected appointments */}
        {isRejected && (
          <Alert className="mb-6 border-orange-500 bg-orange-50" data-testid="rejection-alert">
            <Ban className="h-5 w-5 text-orange-600" />
            <AlertTitle className="text-orange-800 font-semibold">Appointment Rejected</AlertTitle>
            <AlertDescription className="text-orange-700">
              <p className="mb-2">Your appointment has been rejected by the Uganda High Commission.</p>
              {appointment.rejection_reason && (
                <div className="bg-white p-3 rounded-lg border border-orange-200 mt-2">
                  <p className="font-medium text-orange-800 mb-1">Reason:</p>
                  <p className="text-orange-900">{appointment.rejection_reason}</p>
                </div>
              )}
              {appointment.rejected_at && (
                <p className="text-sm mt-2 text-orange-600">
                  Rejected on: {format(parseISO(appointment.rejected_at), "MMMM do, yyyy 'at' h:mm a")}
                </p>
              )}
              <p className="mt-3 text-orange-800 font-medium">
                Please book a new appointment with the correct information or contact the High Commission for assistance.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Status Alert - Cancelled */}
        {isCancelled && (
          <Alert className="mb-6 border-red-500 bg-red-50">
            <XCircle className="h-5 w-5 text-red-500" />
            <AlertTitle className="text-red-700">Appointment Cancelled</AlertTitle>
            <AlertDescription className="text-red-600">
              This appointment has been cancelled. You can book a new appointment from the home page.
            </AlertDescription>
          </Alert>
        )}

        {/* Status Alert - Completed */}
        {isCompleted && (
          <Alert className="mb-6 border-green-500 bg-green-50">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <AlertTitle className="text-green-700">Appointment Completed</AlertTitle>
            <AlertDescription className="text-green-600">
              This appointment has been completed.
            </AlertDescription>
          </Alert>
        )}

        {/* Appointment Details Card */}
        <Card className="shadow-lg border-0 mb-6" data-testid="appointment-details-card">
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
                  <p className="text-sm text-[#4B5563]">Reference Number</p>
                  <p className="font-mono font-semibold text-[#1A1A1A]" data-testid="reference-number">
                    {appointment.reference_number}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#4B5563]">Status</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isCancelled ? 'bg-red-100 text-red-800' :
                    isCompleted ? 'bg-green-100 text-green-800' :
                    isRejected ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {appointment.status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[#4B5563]">Full Name</p>
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
                    <CalendarIcon className="w-4 h-4 text-[#D90000] mt-1" />
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
                      <p className="font-semibold text-[#1A1A1A]">
                        {appointment.time_window || "10:00 AM – 1:00 PM"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {appointment.nin_or_application_number && (
                <div className="border-t pt-4">
                  <p className="text-sm text-[#4B5563]">NIN / Application Number</p>
                  <p className="font-mono font-medium text-[#1A1A1A]">
                    {appointment.nin_or_application_number}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Download PDF Button - For confirmed appointments */}
        {canDownloadPdf && (
          <Card className="shadow-lg border-0 mb-6 bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-green-800">Confirmation Letter</h3>
                    <p className="text-sm text-green-700">
                      Download your appointment confirmation as a PDF document
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                  data-testid="download-pdf-btn"
                >
                  {downloadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                  London WC2N 5DX
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {canModify && (
          <div className="space-y-4">
            <h3 className="font-semibold text-[#1A1A1A]">Manage Your Appointment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button
                onClick={() => setShowReschedule(true)}
                className="btn-secondary flex items-center justify-center gap-2"
                data-testid="reschedule-btn"
              >
                <CalendarIcon className="w-4 h-4" />
                Reschedule Appointment
              </Button>
              <Button
                onClick={() => setShowCancelDialog(true)}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 flex items-center justify-center gap-2"
                data-testid="cancel-btn"
              >
                <XCircle className="w-4 h-4" />
                Cancel Appointment
              </Button>
            </div>
          </div>
        )}

        {!canModify && (
          <div className="text-center">
            <Button onClick={() => navigate("/")} className="btn-primary">
              <Home className="w-4 h-4 mr-2" /> Book New Appointment
            </Button>
          </div>
        )}

        {/* Reschedule Dialog */}
        <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reschedule Appointment</DialogTitle>
              <DialogDescription>
                Select a new date and time for your appointment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Select New Date</p>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={setNewDate}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today || isDateDisabled(date);
                    }}
                    className="rounded-md border"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Select New Time</p>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setNewTime(slot.value)}
                      className={`p-2 text-sm rounded-md border transition-colors ${
                        newTime === slot.value
                          ? 'bg-[#D90000] text-white border-[#D90000]'
                          : 'bg-white text-[#1A1A1A] border-gray-300 hover:border-[#D90000]'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
              {newDate && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CalendarIcon className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    New appointment: {format(newDate, "EEEE, MMMM do, yyyy")}
                    {newTime && ` at ${TIME_SLOTS.find(s => s.value === newTime)?.label}`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => {
                setShowReschedule(false);
                setNewDate(null);
                setNewTime("");
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleReschedule} 
                disabled={!newDate || rescheduling}
                className="btn-primary"
              >
                {rescheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rescheduling...
                  </>
                ) : (
                  "Confirm Reschedule"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Appointment</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this appointment? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Once cancelled, you will need to book a new appointment.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                Keep Appointment
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Appointment"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
