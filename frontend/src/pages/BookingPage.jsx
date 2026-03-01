import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  UserPlus, RefreshCw, CreditCard, Edit3, ChevronLeft, ChevronRight, 
  Check, Loader2, AlertCircle, ExternalLink, Info, Package 
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const serviceDetails = {
  fresh_registration: {
    title: "Fresh Registration",
    icon: UserPlus,
    color: "bg-blue-600",
    below_18: {
      title: "First-Time Applicant Below Age of 18",
      requirements: [
        "A copy of either parent's National ID. (If both parents are deceased, provide a National ID of a blood relative.)",
        "The applicant (child) must be escorted by a parent or guardian who has a National ID.",
        "No fee shall be charged for this service."
      ]
    },
    above_18: {
      title: "First-Time Applicant Above Age of 18",
      requirements: [
        "A copy of either parent's National ID. (If both parents are deceased, provide a National ID of a blood relative.)",
        "Recommendation Letter from the Uganda Embassy (issued upon a physical visit to the Embassy for biometric capture).",
        "No fee shall be charged for this service."
      ]
    }
  },
  renewal: {
    title: "Renewal of National ID",
    icon: RefreshCw,
    color: "bg-emerald-500",
    requirements: [
      "Your current National ID (original or photocopy).",
      "If you lost your National ID and have no photocopy, ensure you have your National Identification Number (NIN) correctly written down.",
      "No fee shall be charged for this service."
    ]
  },
  get_first_id: {
    title: "Get First ID",
    icon: CreditCard,
    color: "bg-violet-500",
    description: "This service is for persons who were registered when they were below the age of 16 years and were issued a National Identification Number (NIN) but have not yet received a physical National ID card. Now that they have attained 16 years of age, they need to update their records so that the ID card can be printed.",
    requirements: [
      "National Identification Number (NIN) only."
    ]
  },
  change_of_particulars: {
    title: "Change of Particulars",
    icon: Edit3,
    color: "bg-amber-500",
    description: "This service is for persons already registered and possessing a National Identification Number (NIN) who wish to make changes to their name, date of birth, place of birth, or other personal details. The requirements vary depending on the specific change requested.",
    link: "https://www.nira.go.ug/publications/the-guide-to-renewing-replacing-updating-your-national-id",
    requirements: [
      "For full details on the particular requirements for the change you desire to undertake, please visit the NIRA website."
    ]
  },
  card_pickup: {
    title: "Card Pick-up",
    icon: Package,
    color: "bg-rose-500",
    description: "This service is for persons who have completed the registration process and their National ID card is ready for collection.",
    requirements: [
      "Your National Identification Number (NIN) or Application Number.",
      "A valid form of identification for verification."
    ],
    requiresNIN: true
  }
};

const services = [
  { id: "fresh_registration", ...serviceDetails.fresh_registration },
  { id: "renewal", ...serviceDetails.renewal },
  { id: "get_first_id", ...serviceDetails.get_first_id },
  { id: "change_of_particulars", ...serviceDetails.change_of_particulars },
  { id: "card_pickup", ...serviceDetails.card_pickup }
];

// International name validation - allows letters, spaces, hyphens, apostrophes, and common diacritics
const isValidName = (name) => {
  // Pattern allows: letters (including accented), spaces, hyphens, apostrophes
  const namePattern = /^[a-zA-ZÀ-ÿ\u00C0-\u024F\u1E00-\u1EFF]+([\s'-][a-zA-ZÀ-ÿ\u00C0-\u024F\u1E00-\u1EFF]+)*$/;
  return namePattern.test(name.trim()) && name.trim().length >= 2;
};

// Phone validation for UK (+44) and Uganda (+256) numbers
const isValidPhone = (phone) => {
  const cleanPhone = phone.replace(/\s/g, '');
  // UK: +44 followed by 10 digits OR 0 followed by 10 digits
  const ukPattern = /^(\+44\d{10}|0\d{10})$/;
  // Uganda: +256 followed by 9 digits OR 0 followed by 9 digits
  const ugandaPattern = /^(\+256\d{9}|0\d{9})$/;
  return ukPattern.test(cleanPhone) || ugandaPattern.test(cleanPhone);
};

export default function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get("service");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [disabledDates, setDisabledDates] = useState([]);
  
  const [formData, setFormData] = useState({
    surname: "",
    first_name: "",
    email: "",
    phone: "",
    service_type: preselectedService || "",
    appointment_date: null,
    nin_or_application_number: ""
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchDisabledDates();
    if (preselectedService && services.find(s => s.id === preselectedService)) {
      setFormData(prev => ({ ...prev, service_type: preselectedService }));
    }
  }, [preselectedService]);

  const fetchDisabledDates = async () => {
    try {
      const response = await axios.get(`${API}/disabled-dates`);
      const dates = response.data.disabled_dates.map(d => parseISO(d));
      setDisabledDates(dates);
    } catch (error) {
      console.error("Failed to fetch disabled dates:", error);
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.surname.trim()) {
      newErrors.surname = "Surname is required";
    } else if (!isValidName(formData.surname)) {
      newErrors.surname = "Please enter a valid surname (letters, hyphens, and apostrophes only)";
    }
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    } else if (!isValidName(formData.first_name)) {
      newErrors.first_name = "Please enter a valid first name (letters, hyphens, and apostrophes only)";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!isValidPhone(formData.phone)) {
      newErrors.phone = "Please enter a valid UK (+44) or Uganda (+256) phone number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.service_type) {
      newErrors.service_type = "Please select a service";
    }
    // If card pickup is selected, NIN or Application Number is required
    if (formData.service_type === "card_pickup" && !formData.nin_or_application_number.trim()) {
      newErrors.nin_or_application_number = "NIN or Application Number is required for Card Pick-up";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!formData.appointment_date) newErrors.appointment_date = "Please select an appointment date";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) handleSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate("/");
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        phone: formData.phone.replace(/\s/g, ''),
        appointment_date: format(formData.appointment_date, "yyyy-MM-dd"),
        nin_or_application_number: formData.nin_or_application_number || null
      };
      
      const response = await axios.post(`${API}/appointments`, payload);
      toast.success("Appointment booked successfully!");
      navigate(`/confirmation/${response.data.id}`);
    } catch (error) {
      console.error("Booking error:", error);
      const message = error.response?.data?.detail || "Failed to book appointment. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const isDateDisabled = (date) => {
    return disabledDates.some(d => 
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );
  };

  const selectedService = formData.service_type ? serviceDetails[formData.service_type] : null;

  return (
    <div className="min-h-screen bg-[#F3F4F6] py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-4"
            data-testid="back-btn"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Book Your Appointment</h1>
          <p className="text-[#4B5563] mt-2">Complete the form below to schedule your visit</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3].map((s, index) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div 
                  className={`step-indicator ${
                    step > s ? 'completed' : step === s ? 'active' : 'pending'
                  }`}
                >
                  {step > s ? <Check className="w-5 h-5" /> : s}
                </div>
                <span className="text-xs mt-2 text-[#4B5563]">
                  {s === 1 ? "Details" : s === 2 ? "Service" : "Date"}
                </span>
              </div>
              {index < 2 && (
                <div className={`step-connector mx-2 ${step > s ? 'active' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="shadow-lg border-0">
          {/* Step 1: Personal Details */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Please enter your details as they appear on your documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="surname">Surname *</Label>
                    <Input
                      id="surname"
                      data-testid="surname-input"
                      value={formData.surname}
                      onChange={(e) => handleInputChange("surname", e.target.value)}
                      placeholder="Enter your surname"
                      className={errors.surname ? "border-red-500" : ""}
                    />
                    {errors.surname && (
                      <p className="text-red-500 text-sm mt-1">{errors.surname}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      data-testid="first-name-input"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                      placeholder="Enter your first name"
                      className={errors.first_name ? "border-red-500" : ""}
                    />
                    {errors.first_name && (
                      <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="email-input"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="your.email@example.com"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">UK Phone Number *</Label>
                  <Input
                    id="phone"
                    data-testid="phone-input"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+447123456789 or 07123456789"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Service Selection */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Select Service</CardTitle>
                <CardDescription>Choose the type of National ID service you require</CardDescription>
              </CardHeader>
              <CardContent>
                {errors.service_type && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.service_type}</AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      data-testid={`select-service-${service.id}`}
                      className={`service-card ${formData.service_type === service.id ? 'selected' : ''}`}
                      onClick={() => handleInputChange("service_type", service.id)}
                    >
                      <div className={`service-icon ${service.color} mb-3`}>
                        <service.icon className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="font-semibold text-[#1A1A1A]">{service.title}</h4>
                      {formData.service_type === service.id && (
                        <div className="absolute top-3 right-3">
                          <Check className="w-5 h-5 text-[#D90000]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Service Requirements */}
                {selectedService && (
                  <div className="bg-[#F9FAFB] rounded-lg p-6 border border-gray-200">
                    <h4 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                      <Info className="w-5 h-5 text-[#D90000]" />
                      Requirements for {selectedService.title}
                    </h4>
                    
                    {selectedService.description && (
                      <p className="text-[#4B5563] mb-4">{selectedService.description}</p>
                    )}

                    {/* Fresh Registration has age-based requirements */}
                    {formData.service_type === "fresh_registration" && (
                      <div className="space-y-6">
                        <div>
                          <h5 className="font-medium text-[#1A1A1A] mb-2">
                            {selectedService.below_18.title}
                          </h5>
                          <ul className="requirements-list">
                            {selectedService.below_18.requirements.map((req, i) => (
                              <li key={i} className="text-[#4B5563]">{req}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-[#1A1A1A] mb-2">
                            {selectedService.above_18.title}
                          </h5>
                          <ul className="requirements-list">
                            {selectedService.above_18.requirements.map((req, i) => (
                              <li key={i} className="text-[#4B5563]">{req}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Other services */}
                    {formData.service_type !== "fresh_registration" && selectedService.requirements && (
                      <ul className="requirements-list">
                        {selectedService.requirements.map((req, i) => (
                          <li key={i} className="text-[#4B5563]">{req}</li>
                        ))}
                      </ul>
                    )}

                    {selectedService.link && (
                      <a 
                        href={selectedService.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#D90000] font-medium mt-4 hover:underline"
                      >
                        Visit NIRA Website for Details <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* Step 3: Date Selection */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Select Appointment Date</CardTitle>
                <CardDescription>
                  Appointments are available on Tuesday, Wednesday, and Friday only. 
                  Weekends and public holidays are not available.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {errors.appointment_date && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.appointment_date}</AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={formData.appointment_date}
                    onSelect={(date) => handleInputChange("appointment_date", date)}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today || isDateDisabled(date);
                    }}
                    className="rounded-md border shadow-sm"
                    data-testid="appointment-calendar"
                  />
                </div>
                {formData.appointment_date && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-800 font-medium">
                      Selected Date: {format(formData.appointment_date, "EEEE, MMMM do, yyyy")}
                    </p>
                  </div>
                )}

                {/* Summary */}
                <div className="mt-6 p-4 bg-[#F9FAFB] rounded-lg border">
                  <h4 className="font-semibold text-[#1A1A1A] mb-3">Booking Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#4B5563]">Name:</span>
                      <span className="font-medium">{formData.first_name} {formData.surname}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#4B5563]">Email:</span>
                      <span className="font-medium">{formData.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#4B5563]">Phone:</span>
                      <span className="font-medium">{formData.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#4B5563]">Service:</span>
                      <span className="font-medium">{selectedService?.title}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Navigation Buttons */}
          <div className="px-6 pb-6 flex justify-between">
            <Button 
              variant="outline" 
              onClick={handleBack}
              data-testid="step-back-btn"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <Button 
              onClick={handleNext}
              disabled={loading}
              className="btn-primary"
              data-testid="step-next-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : step === 3 ? (
                <>
                  Confirm Booking
                  <Check className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
