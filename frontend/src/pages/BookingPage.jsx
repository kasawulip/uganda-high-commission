import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, RefreshCw, CreditCard, Edit3, ChevronLeft, ChevronRight, 
  Check, Loader2, AlertCircle, ExternalLink, Info, Package, Clock,
  Users, TrendingUp
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Time slots available: 10:00 AM - 1:00 PM
const TIME_SLOTS = [
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "12:30", label: "12:30 PM" }
];

const TIME_WINDOW = "10:00 AM – 1:00 PM";

// Scheduling rules per service type
const SCHEDULING_RULES = {
  card_pickup: {
    days: "Monday to Friday",
    description: "Card Pick-up appointments are available Monday to Friday, 10:00 AM – 1:00 PM"
  },
  default: {
    days: "Monday, Wednesday, and Friday",
    description: "Appointments are available Monday, Wednesday, and Friday, 10:00 AM – 1:00 PM"
  }
};

const serviceDetails = {
  fresh_registration: {
    title: "Fresh Registration",
    icon: UserPlus,
    color: "bg-blue-600",
    schedulingRule: "default",
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
    schedulingRule: "default",
    requiresNIN: false,
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
    schedulingRule: "default",
    description: "This service is for persons who were registered when they were below the age of 16 years and were issued a National Identification Number (NIN) but have not yet received a physical National ID card. Now that they have attained 16 years of age, they need to update their records so that the ID card can be printed.",
    requirements: [
      "National Identification Number (NIN) only."
    ]
  },
  change_of_particulars: {
    title: "Change of Particulars",
    icon: Edit3,
    color: "bg-amber-500",
    schedulingRule: "default",
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
    schedulingRule: "card_pickup",
    description: "This service is for persons who have completed the registration process and their National ID card is ready for collection.",
    requirements: [
      "Your National Identification Number (NIN) or Application Number."
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
  const namePattern = /^[a-zA-ZÀ-ÿ\u00C0-\u024F\u1E00-\u1EFF]+([\s'-][a-zA-ZÀ-ÿ\u00C0-\u024F\u1E00-\u1EFF]+)*$/;
  return namePattern.test(name.trim()) && name.trim().length >= 2;
};

// Phone validation for UK (+44) and Uganda (+256) numbers
const isValidPhone = (phone) => {
  const cleanPhone = phone.replace(/\s/g, '');
  const ukPattern = /^(\+44\d{10}|0\d{10})$/;
  const ugandaPattern = /^(\+256\d{9}|0\d{9})$/;
  return ukPattern.test(cleanPhone) || ugandaPattern.test(cleanPhone);
};

// Capacity level colors and labels
const capacityLevels = {
  available: { color: "bg-green-500", textColor: "text-green-700", bgColor: "bg-green-50", label: "Available", icon: "✓" },
  moderate: { color: "bg-yellow-500", textColor: "text-yellow-700", bgColor: "bg-yellow-50", label: "Filling Up", icon: "●" },
  limited: { color: "bg-orange-500", textColor: "text-orange-700", bgColor: "bg-orange-50", label: "Limited", icon: "!" },
  full: { color: "bg-red-500", textColor: "text-red-700", bgColor: "bg-red-50", label: "Full", icon: "✗" }
};

export default function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get("service");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [disabledDates, setDisabledDates] = useState([]);
  const [capacityData, setCapacityData] = useState({});
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  
  const [formData, setFormData] = useState({
    surname: "",
    first_name: "",
    email: "",
    phone: "",
    service_type: preselectedService || "",
    applicant_type: "", // For fresh registration: "below_18" or "above_18"
    appointment_date: null,
    appointment_time: "",
    nin_or_application_number: ""
  });

  const [errors, setErrors] = useState({});

  // Fetch capacity data for the calendar
  const fetchCapacity = useCallback(async (serviceType = null) => {
    setLoadingCapacity(true);
    try {
      const url = serviceType 
        ? `${API}/capacity?service_type=${serviceType}`
        : `${API}/capacity`;
      const response = await axios.get(url);
      
      // Convert array to object keyed by date for quick lookup
      const capacityMap = {};
      response.data.capacity.forEach(item => {
        capacityMap[item.date] = item;
      });
      setCapacityData(capacityMap);
    } catch (error) {
      console.error("Failed to fetch capacity:", error);
    } finally {
      setLoadingCapacity(false);
    }
  }, []);

  useEffect(() => {
    if (preselectedService && services.find(s => s.id === preselectedService)) {
      setFormData(prev => ({ ...prev, service_type: preselectedService }));
      fetchDisabledDates(preselectedService);
      fetchCapacity(preselectedService);
    } else {
      fetchDisabledDates();
      fetchCapacity();
    }
  }, [preselectedService, fetchCapacity]);

  // Refetch disabled dates and capacity when service type changes
  useEffect(() => {
    if (formData.service_type) {
      fetchDisabledDates(formData.service_type);
      fetchCapacity(formData.service_type);
      // Reset date and time when service changes
      setFormData(prev => ({ ...prev, appointment_date: null, appointment_time: "" }));
    }
  }, [formData.service_type, fetchCapacity]);

  const fetchDisabledDates = async (serviceType = null) => {
    try {
      const url = serviceType 
        ? `${API}/disabled-dates?service_type=${serviceType}`
        : `${API}/disabled-dates`;
      const response = await axios.get(url);
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
    // If fresh registration, applicant type is required
    if (formData.service_type === "fresh_registration" && !formData.applicant_type) {
      newErrors.applicant_type = "Please select whether applicant is below or above 18 years";
    }
    // If card pickup is selected, NIN or Application Number is required
    const selectedSvc = serviceDetails[formData.service_type];
    if (selectedSvc?.requiresNIN && !formData.nin_or_application_number.trim()) {
      newErrors.nin_or_application_number = `NIN or Application Number is required for ${selectedSvc.title}`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!formData.appointment_date) newErrors.appointment_date = "Please select an appointment date";
    if (!formData.appointment_time) newErrors.appointment_time = "Please select a time slot";
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
        appointment_time: formData.appointment_time,
        nin_or_application_number: formData.nin_or_application_number || null,
        applicant_type: formData.applicant_type || null
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

  // Get capacity info for a specific date
  const getDateCapacity = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return capacityData[dateStr] || null;
  };

  const selectedService = formData.service_type ? serviceDetails[formData.service_type] : null;
  const selectedDateCapacity = formData.appointment_date ? getDateCapacity(formData.appointment_date) : null;

  return (
    <div className="min-h-screen bg-[#F3F4F6] py-6 md:py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mb-3 md:mb-4"
            data-testid="back-btn"
            aria-label="Go back to previous page"
          >
            <ChevronLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A1A]">Book Your Appointment</h1>
          <p className="text-[#4B5563] mt-1 md:mt-2 text-sm md:text-base">Complete the form below to schedule your visit</p>
        </div>

        {/* Progress Steps - Accessible */}
        <nav aria-label="Booking progress" className="mb-6 md:mb-8">
          <ol className="flex items-center justify-between" role="list">
            {[
              { num: 1, label: "Personal Details" },
              { num: 2, label: "Service Selection" },
              { num: 3, label: "Date & Time" }
            ].map((s, index) => (
              <li key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div 
                    className={`step-indicator ${
                      step > s.num ? 'completed' : step === s.num ? 'active' : 'pending'
                    }`}
                    aria-current={step === s.num ? "step" : undefined}
                    role="img"
                    aria-label={`Step ${s.num}: ${s.label} - ${step > s.num ? 'completed' : step === s.num ? 'current' : 'pending'}`}
                  >
                    {step > s.num ? <Check className="w-5 h-5" aria-hidden="true" /> : s.num}
                  </div>
                  <span className="text-xs mt-2 text-[#4B5563] hidden sm:block">{s.label.split(' ')[0]}</span>
                </div>
                {index < 2 && (
                  <div className={`step-connector mx-1 md:mx-2 ${step > s.num ? 'active' : ''}`} aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </nav>

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
                    <Label htmlFor="surname">Surname <span className="text-red-500" aria-hidden="true">*</span></Label>
                    <Input
                      id="surname"
                      data-testid="surname-input"
                      value={formData.surname}
                      onChange={(e) => handleInputChange("surname", e.target.value)}
                      placeholder="Enter your surname"
                      className={errors.surname ? "border-red-500" : ""}
                      aria-required="true"
                      aria-invalid={!!errors.surname}
                      aria-describedby={errors.surname ? "surname-error" : undefined}
                      autoComplete="family-name"
                    />
                    {errors.surname && (
                      <p id="surname-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">{errors.surname}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="first_name">First Name <span className="text-red-500" aria-hidden="true">*</span></Label>
                    <Input
                      id="first_name"
                      data-testid="first-name-input"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                      placeholder="Enter your first name"
                      className={errors.first_name ? "border-red-500" : ""}
                      aria-required="true"
                      aria-invalid={!!errors.first_name}
                      aria-describedby={errors.first_name ? "firstname-error" : undefined}
                      autoComplete="given-name"
                    />
                    {errors.first_name && (
                      <p id="firstname-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">{errors.first_name}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email Address <span className="text-red-500" aria-hidden="true">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="email-input"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="your.email@example.com"
                    className={errors.email ? "border-red-500" : ""}
                    aria-required="true"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p id="email-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">{errors.email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number (UK or Uganda) <span className="text-red-500" aria-hidden="true">*</span></Label>
                  <Input
                    id="phone"
                    type="tel"
                    data-testid="phone-input"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+447123456789 or +256701234567"
                    className={errors.phone ? "border-red-500" : ""}
                    aria-required="true"
                    aria-invalid={!!errors.phone}
                    aria-describedby="phone-hint phone-error"
                    autoComplete="tel"
                  />
                  <p id="phone-hint" className="text-xs text-[#6B7280] mt-1">UK (+44) or Uganda (+256) numbers accepted</p>
                  {errors.phone && (
                    <p id="phone-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">{errors.phone}</p>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Service Selection */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Select Service</CardTitle>
                <CardDescription className="text-sm">Choose the type of National ID service you require</CardDescription>
              </CardHeader>
              <CardContent>
                {errors.service_type && (
                  <Alert variant="destructive" className="mb-4" role="alert">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>{errors.service_type}</AlertDescription>
                  </Alert>
                )}
                <fieldset>
                  <legend className="sr-only">Select a service type</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6" role="radiogroup">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        data-testid={`select-service-${service.id}`}
                        className={`service-card ${formData.service_type === service.id ? 'selected' : ''}`}
                        onClick={() => handleInputChange("service_type", service.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleInputChange("service_type", service.id);
                          }
                        }}
                        role="radio"
                        aria-checked={formData.service_type === service.id}
                        tabIndex={0}
                        aria-label={`${service.title}${formData.service_type === service.id ? ' - selected' : ''}`}
                      >
                        <div className={`service-icon ${service.color} mb-3`} aria-hidden="true">
                          <service.icon className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-semibold text-[#1A1A1A] text-sm md:text-base">{service.title}</h4>
                        {formData.service_type === service.id && (
                          <div className="absolute top-3 right-3" aria-hidden="true">
                            <Check className="w-5 h-5 text-[#D90000]" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </fieldset>

                {/* Applicant Type Selection for Fresh Registration */}
                {formData.service_type === "fresh_registration" && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Label className="text-[#1A1A1A] font-medium mb-3 block">
                      Applicant Age Category <span className="text-red-500" aria-hidden="true">*</span>
                    </Label>
                    {errors.applicant_type && (
                      <p className="text-red-500 text-xs md:text-sm mb-3" role="alert">{errors.applicant_type}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        data-testid="applicant-type-below-18"
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.applicant_type === "below_18"
                            ? "border-[#D90000] bg-white shadow-sm"
                            : "border-gray-200 bg-white hover:border-blue-300"
                        }`}
                        onClick={() => handleInputChange("applicant_type", "below_18")}
                        role="radio"
                        aria-checked={formData.applicant_type === "below_18"}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleInputChange("applicant_type", "below_18");
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.applicant_type === "below_18" ? "border-[#D90000]" : "border-gray-300"
                          }`}>
                            {formData.applicant_type === "below_18" && (
                              <div className="w-3 h-3 rounded-full bg-[#D90000]" />
                            )}
                          </div>
                          <span className="font-medium text-[#1A1A1A]">Below Age of 18</span>
                        </div>
                      </div>
                      <div
                        data-testid="applicant-type-above-18"
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.applicant_type === "above_18"
                            ? "border-[#D90000] bg-white shadow-sm"
                            : "border-gray-200 bg-white hover:border-blue-300"
                        }`}
                        onClick={() => handleInputChange("applicant_type", "above_18")}
                        role="radio"
                        aria-checked={formData.applicant_type === "above_18"}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleInputChange("applicant_type", "above_18");
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.applicant_type === "above_18" ? "border-[#D90000]" : "border-gray-300"
                          }`}>
                            {formData.applicant_type === "above_18" && (
                              <div className="w-3 h-3 rounded-full bg-[#D90000]" />
                            )}
                          </div>
                          <span className="font-medium text-[#1A1A1A]">Above Age of 18</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* NIN/Application Number input for services that require it */}
                {selectedService?.requiresNIN && (
                  <div className="mb-6 p-4 bg-rose-50 rounded-lg border border-rose-200">
                    <Label htmlFor="nin_or_application_number" className="text-[#1A1A1A] font-medium">
                      NIN or Application Number <span className="text-red-500" aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="nin_or_application_number"
                      data-testid="nin-input"
                      value={formData.nin_or_application_number}
                      onChange={(e) => handleInputChange("nin_or_application_number", e.target.value)}
                      placeholder="Enter your NIN or Application Number"
                      className={`mt-2 ${errors.nin_or_application_number ? "border-red-500" : ""}`}
                      aria-required="true"
                      aria-invalid={!!errors.nin_or_application_number}
                      aria-describedby={errors.nin_or_application_number ? "nin-error" : undefined}
                    />
                    {errors.nin_or_application_number && (
                      <p id="nin-error" className="text-red-500 text-xs md:text-sm mt-1" role="alert">{errors.nin_or_application_number}</p>
                    )}
                  </div>
                )}

                {/* Service Requirements */}
                {selectedService && (
                  <div className="bg-[#F9FAFB] rounded-lg p-4 md:p-6 border border-gray-200">
                    <h4 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                      <Info className="w-5 h-5 text-[#D90000]" aria-hidden="true" />
                      Requirements for {selectedService.title}
                      {formData.service_type === "fresh_registration" && formData.applicant_type && (
                        <span className="text-sm font-normal text-[#4B5563]">
                          ({formData.applicant_type === "below_18" ? "Below 18" : "Above 18"})
                        </span>
                      )}
                    </h4>
                    
                    {selectedService.description && (
                      <p className="text-[#4B5563] mb-4 text-sm md:text-base">{selectedService.description}</p>
                    )}

                    {/* Fresh Registration - show requirements based on selected age category */}
                    {formData.service_type === "fresh_registration" && (
                      <>
                        {!formData.applicant_type ? (
                          <p className="text-[#6B7280] italic">Please select an age category above to see the requirements.</p>
                        ) : formData.applicant_type === "below_18" ? (
                          <div>
                            <h5 className="font-medium text-[#1A1A1A] mb-2 text-sm md:text-base">
                              {selectedService.below_18.title}
                            </h5>
                            <ul className="requirements-list">
                              {selectedService.below_18.requirements.map((req, i) => (
                                <li key={i} className="text-[#4B5563] text-sm md:text-base">{req}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div>
                            <h5 className="font-medium text-[#1A1A1A] mb-2 text-sm md:text-base">
                              {selectedService.above_18.title}
                            </h5>
                            <ul className="requirements-list">
                              {selectedService.above_18.requirements.map((req, i) => (
                                <li key={i} className="text-[#4B5563] text-sm md:text-base">{req}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {/* Other services */}
                    {formData.service_type !== "fresh_registration" && selectedService.requirements && (
                      <ul className="requirements-list">
                        {selectedService.requirements.map((req, i) => (
                          <li key={i} className="text-[#4B5563] text-sm md:text-base">{req}</li>
                        ))}
                      </ul>
                    )}

                    {selectedService.link && (
                      <a 
                        href={selectedService.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#D90000] font-medium mt-4 hover:underline text-sm md:text-base"
                      >
                        Visit NIRA Website for Details <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        <span className="sr-only">(opens in new tab)</span>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </>
          )}

          {/* Step 3: Date and Time Selection */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Select Appointment Date & Time</CardTitle>
                <CardDescription>
                  {formData.service_type === "card_pickup" 
                    ? "Card Pick-up appointments are available Monday to Friday, 10:00 AM – 1:00 PM. No daily booking limit."
                    : "Appointments are available Monday, Wednesday, and Friday only, 10:00 AM – 1:00 PM. Combined daily limit of 50 bookings for this service type."
                  }
                  {" "}Public holidays are not available.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(errors.appointment_date || errors.appointment_time) && (
                  <Alert variant="destructive" className="mb-4" role="alert">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>
                      {errors.appointment_date || errors.appointment_time}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Capacity Legend - only show for non-card-pickup services */}
                {formData.service_type !== "card_pickup" && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-gray-600" aria-hidden="true" />
                      <span className="text-sm font-medium text-gray-700">Availability (Combined limit: 50/day)</span>
                      {loadingCapacity && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {Object.entries(capacityLevels).map(([key, level]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className={`w-3 h-3 rounded-full ${level.color}`} aria-hidden="true"></span>
                          <span className="text-gray-600">{level.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card Pickup - no limit notice */}
                {formData.service_type === "card_pickup" && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                      <span className="text-sm text-green-700">Card Pick-up has no daily booking limit. All available dates are open.</span>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Calendar with Capacity Indicators */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Select Date</Label>
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
                        modifiers={{
                          available: (date) => {
                            const capacity = getDateCapacity(date);
                            return capacity?.level === 'available';
                          },
                          moderate: (date) => {
                            const capacity = getDateCapacity(date);
                            return capacity?.level === 'moderate';
                          },
                          limited: (date) => {
                            const capacity = getDateCapacity(date);
                            return capacity?.level === 'limited';
                          },
                          full: (date) => {
                            const capacity = getDateCapacity(date);
                            return capacity?.level === 'full';
                          }
                        }}
                        modifiersStyles={{
                          available: { 
                            backgroundColor: '#dcfce7',
                            color: '#166534'
                          },
                          moderate: { 
                            backgroundColor: '#fef9c3',
                            color: '#854d0e'
                          },
                          limited: { 
                            backgroundColor: '#fed7aa',
                            color: '#c2410c'
                          },
                          full: { 
                            backgroundColor: '#fecaca',
                            color: '#b91c1c'
                          }
                        }}
                        className="rounded-md border shadow-sm"
                        data-testid="appointment-calendar"
                        aria-label="Select appointment date"
                      />
                    </div>
                    
                    {/* Selected Date Capacity Info - only for non-card-pickup */}
                    {selectedDateCapacity && formData.appointment_date && formData.service_type !== "card_pickup" && (
                      <div className={`mt-3 p-3 rounded-lg ${capacityLevels[selectedDateCapacity.level]?.bgColor || 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" aria-hidden="true" />
                            <span className="text-sm font-medium">
                              {format(formData.appointment_date, "MMM d")} Availability
                            </span>
                          </div>
                          <Badge variant="outline" className={capacityLevels[selectedDateCapacity.level]?.textColor}>
                            {selectedDateCapacity.available} slots left
                          </Badge>
                        </div>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${capacityLevels[selectedDateCapacity.level]?.color}`}
                              style={{ width: `${selectedDateCapacity.utilization_percent}%` }}
                              role="progressbar"
                              aria-valuenow={selectedDateCapacity.utilization_percent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${selectedDateCapacity.utilization_percent}% booked`}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedDateCapacity.booked} of 50 slots booked ({selectedDateCapacity.utilization_percent}%)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Time Slots */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Select Time Slot</Label>
                    <div className="bg-[#F9FAFB] p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-4 text-sm text-[#4B5563]">
                        <Clock className="w-4 h-4" aria-hidden="true" />
                        <span>Time Window: {TIME_WINDOW}</span>
                      </div>
                      <fieldset>
                        <legend className="sr-only">Select a time slot</legend>
                        <div className="grid grid-cols-2 gap-2" role="radiogroup">
                          {TIME_SLOTS.map((slot) => (
                            <button
                              key={slot.value}
                              type="button"
                              data-testid={`time-slot-${slot.value}`}
                              onClick={() => handleInputChange("appointment_time", slot.value)}
                              className={`p-3 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#D90000] focus:ring-offset-2 ${
                                formData.appointment_time === slot.value
                                  ? 'bg-[#D90000] text-white'
                                  : 'bg-white border border-gray-300 text-[#1A1A1A] hover:border-[#D90000]'
                              }`}
                              role="radio"
                              aria-checked={formData.appointment_time === slot.value}
                              aria-label={`${slot.label}${formData.appointment_time === slot.value ? ' - selected' : ''}`}
                            >
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </div>
                </div>
                
                {/* Selection Summary */}
                {formData.appointment_date && formData.appointment_time && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200" role="status" aria-live="polite">
                    <p className="text-green-800 font-medium">
                      <Check className="w-4 h-4 inline mr-2" aria-hidden="true" />
                      Selected: {format(formData.appointment_date, "EEEE, MMMM do, yyyy")} at {TIME_SLOTS.find(s => s.value === formData.appointment_time)?.label}
                    </p>
                  </div>
                )}
                
                {/* Important Notice */}
                <Alert className="mt-4 border-[#D90000] bg-red-50">
                  <AlertCircle className="h-4 w-4 text-[#D90000]" aria-hidden="true" />
                  <AlertDescription className="text-[#D90000] font-medium text-sm md:text-base">
                    You are required to present yourself at the Uganda High Commission within the scheduled 
                    timeframe ({TIME_WINDOW}) on your selected appointment date. Late arrivals outside 
                    this timeframe may not be attended to.
                  </AlertDescription>
                </Alert>

                {/* Summary */}
                <div className="mt-6 p-4 bg-[#F9FAFB] rounded-lg border">
                  <h4 className="font-semibold text-[#1A1A1A] mb-3">Booking Summary</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-[#4B5563]">Name:</dt>
                      <dd className="font-medium">{formData.first_name} {formData.surname}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#4B5563]">Email:</dt>
                      <dd className="font-medium break-all">{formData.email}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#4B5563]">Phone:</dt>
                      <dd className="font-medium">{formData.phone}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#4B5563]">Service:</dt>
                      <dd className="font-medium">{selectedService?.title}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#4B5563]">Time Window:</dt>
                      <dd className="font-medium">{TIME_WINDOW}</dd>
                    </div>
                  </dl>
                </div>
              </CardContent>
            </>
          )}

          {/* Navigation Buttons */}
          <div className="px-4 md:px-6 pb-6 flex flex-col sm:flex-row justify-between gap-3">
            <Button 
              variant="outline" 
              onClick={handleBack}
              data-testid="step-back-btn"
              className="order-2 sm:order-1"
            >
              <ChevronLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <Button 
              onClick={handleNext}
              disabled={loading}
              className="btn-primary order-1 sm:order-2"
              data-testid="step-next-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  <span>Booking...</span>
                </>
              ) : step === 3 ? (
                <>
                  <span>Confirm Booking</span>
                  <Check className="w-4 h-4 ml-2" aria-hidden="true" />
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
