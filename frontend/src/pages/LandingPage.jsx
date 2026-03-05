import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, RefreshCw, CreditCard, Edit3, Clock, MapPin, Phone, ChevronRight, Shield, CheckCircle, Package, CalendarClock, Search } from "lucide-react";

const services = [
  {
    id: "fresh_registration",
    title: "Fresh Registration",
    description: "First-time applicants for National ID",
    icon: UserPlus,
    color: "bg-blue-600"
  },
  {
    id: "renewal",
    title: "Renewal of National ID",
    description: "Renew your existing National ID",
    icon: RefreshCw,
    color: "bg-emerald-500"
  },
  {
    id: "get_first_id",
    title: "Get First ID",
    description: "For those with NIN but no physical ID card",
    icon: CreditCard,
    color: "bg-violet-500"
  },
  {
    id: "change_of_particulars",
    title: "Change of Particulars",
    description: "Update your personal details",
    icon: Edit3,
    color: "bg-amber-500"
  },
  {
    id: "card_pickup",
    title: "Card Pick-up",
    description: "Collect your ready National ID card",
    icon: Package,
    color: "bg-rose-500"
  }
];

const steps = [
  { number: 1, title: "Choose Service", description: "Select the type of ID service you need" },
  { number: 2, title: "Select Date", description: "Pick an available appointment date" },
  { number: 3, title: "Confirm Booking", description: "Receive confirmation via email" }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [appointmentId, setAppointmentId] = useState("");
  const [searchError, setSearchError] = useState("");

  const handleManageAppointment = () => {
    if (!appointmentId.trim()) {
      setSearchError("Please enter your Appointment Reference Number");
      return;
    }
    setSearchError("");
    setManageDialogOpen(false);
    navigate(`/manage/${appointmentId.trim()}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-bg relative min-h-[70vh] md:min-h-[80vh] flex items-center">
        <div className="hero-overlay absolute inset-0" />
        {/* Admin Portal Link - Top Right */}
        <div className="absolute top-4 right-4 z-20">
          <Button 
            data-testid="admin-portal-top-btn"
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="text-white/80 hover:text-white hover:bg-white/10 text-sm"
          >
            <Shield className="w-4 h-4 mr-2" />
            Admin Portal
          </Button>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="max-w-3xl animate-fade-in">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FCDC04] rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-[#1A1A1A]" />
              </div>
              <span className="text-[#FCDC04] font-semibold tracking-wide text-sm md:text-base">OFFICIAL SERVICE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              National ID Services
              <span className="block text-[#FCDC04]">Appointment Booking</span>
            </h1>
            <p className="text-base md:text-lg text-gray-300 mb-6 md:mb-8 max-w-2xl">
              Book your appointment for National ID services at the Uganda High Commission, London. 
              Quick, easy, and secure online booking.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <Button 
                data-testid="book-appointment-btn"
                onClick={() => navigate("/book")}
                className="btn-primary text-base md:text-lg px-6 md:px-8 py-4 md:py-6"
              >
                Book Appointment
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    data-testid="manage-appointment-btn"
                    variant="outline"
                    className="btn-secondary text-base md:text-lg px-6 md:px-8 py-4 md:py-6"
                  >
                    <CalendarClock className="mr-2 w-5 h-5" />
                    Manage Appointment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Manage Your Appointment</DialogTitle>
                    <DialogDescription>
                      Enter your Appointment Reference Number to reschedule or cancel your existing appointment.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Input
                        data-testid="appointment-id-input"
                        placeholder="e.g., UHC-20260301-ABC12345"
                        value={appointmentId}
                        onChange={(e) => {
                          setAppointmentId(e.target.value);
                          if (searchError) setSearchError("");
                        }}
                        className={searchError ? "border-red-500" : ""}
                      />
                      {searchError && (
                        <p className="text-red-500 text-sm mt-1">{searchError}</p>
                      )}
                    </div>
                    <Button 
                      onClick={handleManageAppointment}
                      className="w-full btn-primary"
                      data-testid="search-appointment-btn"
                    >
                      <Search className="mr-2 w-4 h-4" />
                      Find Appointment
                    </Button>
                    <p className="text-xs text-gray-500 text-center">
                      Your reference number was sent to your email when you booked.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-12 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#1A1A1A] mb-3 md:mb-4">National ID Services</h2>
            <p className="text-base md:text-lg text-[#4B5563] max-w-2xl mx-auto">
              Each service has specific requirements you'll need to prepare.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 stagger-children">
            {services.map((service) => (
              <Card 
                key={service.id}
                data-testid={`service-card-${service.id}`}
                className="service-card group cursor-pointer"
                onClick={() => navigate(`/book?service=${service.id}`)}
              >
                <CardHeader>
                  <div className={`service-icon ${service.color} mb-4`}>
                    <service.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg group-hover:text-[#D90000] transition-colors">
                    {service.title}
                  </CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-[#D90000] text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                    Learn more <ChevronRight className="w-4 h-4" />
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-[#F3F4F6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] mb-4">How It Works</h2>
            <p className="text-lg text-[#4B5563]">Simple three-step process to book your appointment</p>
          </div>
          <div className="flex flex-col md:flex-row items-start justify-center gap-8 md:gap-4">
            {steps.map((step, index) => (
              <div key={step.number} className="flex flex-col md:flex-row items-center md:items-start flex-1">
                <div className="flex flex-col items-center text-center md:text-left md:items-start">
                  <div className="step-indicator active mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">{step.title}</h3>
                  <p className="text-[#4B5563]">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block step-connector mx-4 mt-5" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <img 
                src="https://images.unsplash.com/photo-1770240090780-a80f44963545?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwxfHxVZ2FuZGElMjBmbGFnJTIwd2F2aW5nJTIwdGV4dHVyZXxlbnwwfHx8fDE3NzIzODI1MTJ8MA&ixlib=rb-4.1.0&q=85"
                alt="Uganda cultural heritage"
                className="rounded-lg shadow-lg w-full h-[400px] object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1A1A1A] mb-6">
                Serving the Ugandan Community in the UK
              </h2>
              <p className="text-lg text-[#4B5563] mb-6">
                The Uganda High Commission in London provides essential National ID services to Ugandan 
                citizens residing in the United Kingdom. Our appointment system ensures efficient service 
                delivery.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#FCDC04] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1A1A1A]">Operating Days</h4>
                    <p className="text-[#4B5563]">Tuesday, Wednesday & Friday only</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#FCDC04] rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1A1A1A]">Location</h4>
                    <p className="text-[#4B5563]">Uganda House, 58-59 Trafalgar Square, London WC2N 5DX</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#FCDC04] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-[#1A1A1A]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1A1A1A]">ID Services Contact Line</h4>
                    <p className="text-[#4B5563]">02031544027 / 02078395783</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 md:mb-4">
            Ready to Book Your Appointment?
          </h2>
          <p className="text-base md:text-lg text-gray-400 mb-6 md:mb-8 max-w-2xl mx-auto">
            Start the booking process now and secure your preferred date for National ID services.
          </p>
          <Button 
            data-testid="cta-book-btn"
            onClick={() => navigate("/book")}
            className="btn-primary text-base md:text-lg px-8 md:px-10 py-4 md:py-6"
          >
            Book Now <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#111827] text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-white font-semibold mb-4">Uganda High Commission</h3>
              <p className="text-sm">
                Uganda House<br />
                58-59 Trafalgar Square<br />
                London WC2N 5DX<br />
                United Kingdom
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.nira.go.ug" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">NIRA Website</a></li>
                <li><a href="https://london.mofa.go.ug" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">High Commission Website</a></li>
                <li><a href="https://www.nira.go.ug/publications/the-guide-to-renewing-replacing-updating-your-national-id" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">ID Requirements Guide</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Important Notice</h3>
              <p className="text-sm">
                You are advised to complete pre-registration on the NIRA website before your appointment 
                to ensure faster service.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Uganda High Commission, London. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
