import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  LayoutDashboard, Calendar, Users, LogOut, Search, 
  MoreVertical, CheckCircle, XCircle, Trash2, Download,
  RefreshCw, FileText, Clock, AlertCircle, UserCheck,
  Ban, CalendarDays, ClipboardList, History, UserCog,
  TrendingUp, Shield, Eye, ChevronLeft, ChevronRight, Plus
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const serviceNames = {
  fresh_registration: "Fresh Registration",
  renewal: "Renewal",
  get_first_id: "Get First ID",
  change_of_particulars: "Change of Particulars",
  card_pickup: "Card Pick-up"
};

const statusColors = {
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
  rejected: "bg-red-100 text-red-800"
};

const roleColors = {
  super_admin: "bg-purple-100 text-purple-800",
  operations_admin: "bg-blue-100 text-blue-800",
  front_desk: "bg-green-100 text-green-800"
};

const roleNames = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  front_desk: "Front Desk"
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Filters
  const [filters, setFilters] = useState({
    status: "",
    service_type: "",
    search: "",
    date_from: "",
    date_to: ""
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Dialogs
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showBulkRescheduleDialog, setShowBulkRescheduleDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showAppointmentDetailDialog, setShowAppointmentDetailDialog] = useState(false);
  
  // Form states
  const [rejectReason, setRejectReason] = useState("");
  const [bulkRescheduleData, setBulkRescheduleData] = useState({
    original_date: "",
    service_type: "",
    new_date: "",
    new_time: "10:00",
    reason: ""
  });
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    email: "",
    full_name: "",
    role: "front_desk"
  });
  
  const [actionLoading, setActionLoading] = useState(false);
  const [worklistDate, setWorklistDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    const userData = localStorage.getItem("adminUser");
    if (!token) {
      navigate("/admin");
      return;
    }
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
    fetchData();
  }, [navigate]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("adminToken");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appointmentsRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/appointments`, { headers: getAuthHeaders() }),
        axios.get(`${API}/admin/stats`, { headers: getAuthHeaders() })
      ]);
      setAppointments(appointmentsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        navigate("/admin");
      }
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get(`${API}/admin/audit-logs?limit=100`, { headers: getAuthHeaders() });
      setAuditLogs(res.data);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      if (error.response?.status === 403) {
        toast.error("Insufficient permissions to view audit logs");
      }
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, { headers: getAuthHeaders() });
      setAdminUsers(res.data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      if (error.response?.status === 403) {
        toast.error("Only Super Admin can manage users");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    navigate("/admin");
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "audit" && auditLogs.length === 0) {
      fetchAuditLogs();
    }
    if (tab === "users" && adminUsers.length === 0) {
      fetchAdminUsers();
    }
  };

  // Appointment Actions
  const checkInAppointment = async (appointmentId) => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/admin/appointments/${appointmentId}/check-in`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success("Appointment checked in");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to check in");
    } finally {
      setActionLoading(false);
    }
  };

  const markServed = async (appointmentId) => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/admin/appointments/${appointmentId}/mark-served`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success("Appointment marked as served");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to mark as served");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectAppointment = async () => {
    if (!selectedAppointment || rejectReason.length < 10) {
      toast.error("Please provide a detailed reason (min 10 characters)");
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/admin/appointments/${selectedAppointment.id}/reject`,
        { reason: rejectReason },
        { headers: getAuthHeaders() }
      );
      toast.success("Appointment rejected and applicant notified");
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedAppointment(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject appointment");
    } finally {
      setActionLoading(false);
    }
  };

  const updateStatus = async (appointmentId, newStatus) => {
    setActionLoading(true);
    try {
      await axios.patch(
        `${API}/admin/appointments/${appointmentId}?status=${newStatus}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success(`Status updated to ${newStatus}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteAppointment = async () => {
    if (!selectedAppointment) return;
    
    setActionLoading(true);
    try {
      await axios.delete(
        `${API}/admin/appointments/${selectedAppointment.id}`,
        { headers: getAuthHeaders() }
      );
      toast.success("Appointment deleted");
      setShowDeleteDialog(false);
      setSelectedAppointment(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete appointment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkReschedule = async () => {
    if (!bulkRescheduleData.new_date || !bulkRescheduleData.reason || bulkRescheduleData.reason.length < 10) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!bulkRescheduleData.original_date && !bulkRescheduleData.service_type) {
      toast.error("Please specify either original date or service type");
      return;
    }
    
    setActionLoading(true);
    try {
      const payload = {
        new_date: bulkRescheduleData.new_date,
        new_time: bulkRescheduleData.new_time,
        reason: bulkRescheduleData.reason
      };
      if (bulkRescheduleData.original_date) {
        payload.original_date = bulkRescheduleData.original_date;
      }
      if (bulkRescheduleData.service_type) {
        payload.service_type = bulkRescheduleData.service_type;
      }
      
      const res = await axios.post(
        `${API}/admin/bulk-reschedule`,
        payload,
        { headers: getAuthHeaders() }
      );
      toast.success(res.data.message);
      setShowBulkRescheduleDialog(false);
      setBulkRescheduleData({ original_date: "", service_type: "", new_date: "", new_time: "10:00", reason: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to bulk reschedule");
    } finally {
      setActionLoading(false);
    }
  };

  const createAdminUser = async () => {
    if (!newUserData.username || !newUserData.password || !newUserData.email || !newUserData.full_name) {
      toast.error("Please fill all required fields");
      return;
    }
    
    setActionLoading(true);
    try {
      await axios.post(
        `${API}/admin/users`,
        newUserData,
        { headers: getAuthHeaders() }
      );
      toast.success("User created successfully");
      setShowCreateUserDialog(false);
      setNewUserData({ username: "", password: "", email: "", full_name: "", role: "front_desk" });
      fetchAdminUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create user");
    } finally {
      setActionLoading(false);
    }
  };

  const downloadWorklist = async () => {
    try {
      const res = await axios.get(
        `${API}/admin/reports/daily-worklist/download?report_date=${worklistDate}`,
        { headers: getAuthHeaders(), responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `worklist_${worklistDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Worklist downloaded");
    } catch (error) {
      toast.error("Failed to download worklist");
    }
  };

  const exportAuditLogs = async () => {
    try {
      const res = await axios.get(
        `${API}/admin/audit-logs/export`,
        { headers: getAuthHeaders(), responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Audit logs exported");
    } catch (error) {
      toast.error("Failed to export audit logs");
    }
  };

  const exportToCSV = () => {
    const headers = ["Reference", "Name", "Email", "Phone", "Service", "Date", "Time", "Status", "Checked In", "Served"];
    const rows = filteredAppointments.map(a => [
      a.reference_number,
      `${a.first_name} ${a.surname}`,
      a.email,
      a.phone,
      serviceNames[a.service_type],
      a.appointment_date,
      a.appointment_time || "10:00",
      a.status,
      a.checked_in ? "Yes" : "No",
      a.served ? "Yes" : "No"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `appointments_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export complete");
  };

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    if (filters.status && apt.status !== filters.status) return false;
    if (filters.service_type && apt.service_type !== filters.service_type) return false;
    if (filters.date_from && apt.appointment_date < filters.date_from) return false;
    if (filters.date_to && apt.appointment_date > filters.date_to) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchesSearch = 
        apt.surname?.toLowerCase().includes(search) ||
        apt.first_name?.toLowerCase().includes(search) ||
        apt.email?.toLowerCase().includes(search) ||
        apt.reference_number?.toLowerCase().includes(search) ||
        apt.nin_or_application_number?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Permission checks
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isOperationsAdmin = currentUser?.role === "operations_admin";
  const isFrontDesk = currentUser?.role === "front_desk";
  const canManageUsers = isSuperAdmin;
  const canViewAuditLogs = isSuperAdmin || isOperationsAdmin;
  const canManageAppointments = isSuperAdmin || isOperationsAdmin; // Check-in, Mark Served, Reject, Cancel, Delete
  const canBulkReschedule = isSuperAdmin || isOperationsAdmin;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex">
      {/* Sidebar */}
      <aside className="admin-sidebar hidden md:flex flex-col w-64 bg-[#1A1A1A]">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">Uganda High Commission</p>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          <button 
            className={`admin-nav-item w-full ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
            data-testid="nav-dashboard"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            className={`admin-nav-item w-full ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => handleTabChange('appointments')}
            data-testid="nav-appointments"
          >
            <Calendar className="w-5 h-5" />
            Appointments
          </button>
          <button 
            className={`admin-nav-item w-full ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleTabChange('reports')}
            data-testid="nav-reports"
          >
            <ClipboardList className="w-5 h-5" />
            Reports
          </button>
          {canViewAuditLogs && (
            <button 
              className={`admin-nav-item w-full ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => handleTabChange('audit')}
              data-testid="nav-audit"
            >
              <History className="w-5 h-5" />
              Audit Logs
            </button>
          )}
          {canManageUsers && (
            <button 
              className={`admin-nav-item w-full ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => handleTabChange('users')}
              data-testid="nav-users"
            >
              <UserCog className="w-5 h-5" />
              User Management
            </button>
          )}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="text-sm text-gray-400 mb-2">
            <p className="font-medium text-white">{currentUser?.full_name || currentUser?.username}</p>
            <p className="text-xs">{roleNames[currentUser?.role] || currentUser?.role}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="admin-nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <Button variant="ghost" onClick={handleLogout} size="sm">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="md:hidden mb-4 overflow-x-auto">
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'dashboard' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => handleTabChange('dashboard')}
            >
              Dashboard
            </Button>
            <Button 
              variant={activeTab === 'appointments' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => handleTabChange('appointments')}
            >
              Appointments
            </Button>
            <Button 
              variant={activeTab === 'reports' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => handleTabChange('reports')}
            >
              Reports
            </Button>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="stats-card" data-testid="stat-total">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{stats?.total || 0}</p>
                      <p className="text-sm text-gray-500">Total Appointments</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="stats-card" data-testid="stat-today">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{stats?.today_bookings || 0}</p>
                      <p className="text-sm text-gray-500">Today's Bookings</p>
                    </div>
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <CalendarDays className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="stats-card" data-testid="stat-checkedin">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{stats?.checked_in || 0}</p>
                      <p className="text-sm text-gray-500">Checked In</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="stats-card" data-testid="stat-served">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">{stats?.served || 0}</p>
                      <p className="text-sm text-gray-500">Served</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.next_7_days || 0}</p>
                      <p className="text-sm text-gray-500">Next 7 Days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.cancelled || 0}</p>
                      <p className="text-sm text-gray-500">Cancelled</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Ban className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.rejected || 0}</p>
                      <p className="text-sm text-gray-500">Rejected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Service Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Appointments by Service</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(stats?.by_service || {}).map(([service, count]) => (
                    <div key={service} className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-800">{count}</p>
                      <p className="text-xs text-gray-500 mt-1">{serviceNames[service] || service}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <Card className="shadow-sm">
            <CardHeader className="border-b">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Appointments
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={fetchData} data-testid="refresh-btn">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  {canBulkReschedule && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowBulkRescheduleDialog(true)}
                      data-testid="bulk-reschedule-btn"
                    >
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Bulk Reschedule
                    </Button>
                  )}
                  {canManageAppointments && (
                    <Button variant="outline" size="sm" onClick={exportToCSV} data-testid="export-btn">
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filters */}
              <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search name, email, reference, NIN..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-10"
                      data-testid="search-input"
                    />
                  </div>
                </div>
                <Select 
                  value={filters.status || "all"} 
                  onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v })}
                >
                  <SelectTrigger className="w-[140px]" data-testid="filter-status">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select 
                  value={filters.service_type || "all"} 
                  onValueChange={(v) => setFilters({ ...filters, service_type: v === "all" ? "" : v })}
                >
                  <SelectTrigger className="w-[160px]" data-testid="filter-service">
                    <SelectValue placeholder="All Services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    <SelectItem value="fresh_registration">Fresh Registration</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                    <SelectItem value="get_first_id">Get First ID</SelectItem>
                    <SelectItem value="change_of_particulars">Change of Particulars</SelectItem>
                    <SelectItem value="card_pickup">Card Pick-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Name</th>
                      <th>Service</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Check-in</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-500">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          No appointments found
                        </td>
                      </tr>
                    ) : (
                      paginatedAppointments.map((apt) => (
                        <tr key={apt.id} data-testid={`appointment-row-${apt.id}`}>
                          <td className="font-mono text-sm">{apt.reference_number}</td>
                          <td>
                            <div>
                              <p className="font-medium">{apt.first_name} {apt.surname}</p>
                              <p className="text-xs text-gray-500">{apt.email}</p>
                            </div>
                          </td>
                          <td className="text-sm">{serviceNames[apt.service_type]}</td>
                          <td className="text-sm">
                            {format(parseISO(apt.appointment_date), "MMM dd, yyyy")}
                            <br />
                            <span className="text-xs text-gray-500">{apt.appointment_time || "10:00"}</span>
                          </td>
                          <td>
                            <span className={`status-badge ${statusColors[apt.status] || 'bg-gray-100'}`}>
                              {apt.status}
                            </span>
                          </td>
                          <td>
                            {apt.checked_in ? (
                              <span className="text-green-600 text-xs flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Yes
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">No</span>
                            )}
                          </td>
                          <td>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`actions-${apt.id}`}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedAppointment(apt);
                                  setShowAppointmentDetailDialog(true);
                                }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {canManageAppointments && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {apt.status === 'confirmed' && !apt.checked_in && (
                                      <DropdownMenuItem onClick={() => checkInAppointment(apt.id)}>
                                        <UserCheck className="w-4 h-4 mr-2 text-blue-500" />
                                        Check In
                                      </DropdownMenuItem>
                                    )}
                                    {apt.checked_in && !apt.served && apt.status !== 'completed' && (
                                      <DropdownMenuItem onClick={() => markServed(apt.id)}>
                                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                        Mark Served
                                      </DropdownMenuItem>
                                    )}
                                    {apt.service_type === 'card_pickup' && apt.status === 'confirmed' && (
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedAppointment(apt);
                                        setShowRejectDialog(true);
                                      }}>
                                        <Ban className="w-4 h-4 mr-2 text-orange-500" />
                                        Reject (Card Not Ready)
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => updateStatus(apt.id, "cancelled")}
                                      disabled={apt.status === "cancelled" || apt.status === "completed"}
                                    >
                                      <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                      Cancel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedAppointment(apt);
                                        setShowDeleteDialog(true);
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAppointments.length)} of {filteredAppointments.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">Page {currentPage} of {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Daily Worklist
                </CardTitle>
                <CardDescription>Download the day's appointment list for operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <Label htmlFor="worklist-date">Select Date</Label>
                    <Input
                      id="worklist-date"
                      type="date"
                      value={worklistDate}
                      onChange={(e) => setWorklistDate(e.target.value)}
                      className="w-[200px] mt-1"
                    />
                  </div>
                  <Button onClick={downloadWorklist} data-testid="download-worklist-btn">
                    <Download className="w-4 h-4 mr-2" />
                    Download Worklist
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{stats?.pending || 0}</p>
                    <p className="text-sm text-gray-600">Pending</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{stats?.completed || 0}</p>
                    <p className="text-sm text-gray-600">Completed</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">{stats?.next_30_days || 0}</p>
                    <p className="text-sm text-gray-600">Next 30 Days</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-3xl font-bold text-purple-600">{stats?.served || 0}</p>
                    <p className="text-sm text-gray-600">Total Served</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && canViewAuditLogs && (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Audit Logs
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  {isSuperAdmin && (
                    <Button variant="outline" size="sm" onClick={exportAuditLogs}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">
                          No audit logs found
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="text-sm">
                            {format(parseISO(log.timestamp), "MMM dd, yyyy HH:mm")}
                          </td>
                          <td className="font-medium">{log.username}</td>
                          <td>
                            <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                              {log.action}
                            </span>
                          </td>
                          <td className="text-sm">{log.resource_type}</td>
                          <td className="text-sm text-gray-500 max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && canManageUsers && (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  User Management
                </CardTitle>
                <Button onClick={() => setShowCreateUserDialog(true)} data-testid="create-user-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      adminUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="font-medium">{user.username}</td>
                          <td>{user.full_name || '-'}</td>
                          <td className="text-sm">{user.email || '-'}</td>
                          <td>
                            <span className={`status-badge ${roleColors[user.role] || 'bg-gray-100'}`}>
                              {roleNames[user.role] || user.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${user.active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {user.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="text-sm text-gray-500">
                            {user.last_login ? format(parseISO(user.last_login), "MMM dd, HH:mm") : 'Never'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="py-4 space-y-2">
              <p><strong>Reference:</strong> {selectedAppointment.reference_number}</p>
              <p><strong>Name:</strong> {selectedAppointment.first_name} {selectedAppointment.surname}</p>
              <p><strong>Date:</strong> {selectedAppointment.appointment_date}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteAppointment}
              disabled={actionLoading}
              data-testid="confirm-delete-btn"
            >
              {actionLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Card Pick-up Appointment</DialogTitle>
            <DialogDescription>
              This will notify the applicant that their card is not ready for collection.
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p><strong>Applicant:</strong> {selectedAppointment.first_name} {selectedAppointment.surname}</p>
                <p><strong>NIN:</strong> {selectedAppointment.nin_or_application_number || 'N/A'}</p>
              </div>
              <div>
                <Label htmlFor="reject-reason">Rejection Reason (min 10 characters)</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="e.g., Your National ID card has not yet been delivered to the High Commission. Please reschedule your appointment after one month."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-2"
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectReason("");
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={rejectAppointment}
              disabled={actionLoading || rejectReason.length < 10}
              data-testid="confirm-reject-btn"
            >
              {actionLoading ? "Processing..." : "Reject & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reschedule Dialog */}
      <Dialog open={showBulkRescheduleDialog} onOpenChange={setShowBulkRescheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Reschedule Appointments</DialogTitle>
            <DialogDescription>
              Reschedule multiple appointments at once (e.g., for office closure)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Filter by Original Date (optional)</Label>
              <Input
                type="date"
                value={bulkRescheduleData.original_date}
                onChange={(e) => setBulkRescheduleData({...bulkRescheduleData, original_date: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Or Filter by Service Type (optional)</Label>
              <Select 
                value={bulkRescheduleData.service_type || "none"} 
                onValueChange={(v) => setBulkRescheduleData({...bulkRescheduleData, service_type: v === "none" ? "" : v})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="fresh_registration">Fresh Registration</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="get_first_id">Get First ID</SelectItem>
                  <SelectItem value="change_of_particulars">Change of Particulars</SelectItem>
                  <SelectItem value="card_pickup">Card Pick-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Date *</Label>
              <Input
                type="date"
                value={bulkRescheduleData.new_date}
                onChange={(e) => setBulkRescheduleData({...bulkRescheduleData, new_date: e.target.value})}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>New Time *</Label>
              <Select 
                value={bulkRescheduleData.new_time} 
                onValueChange={(v) => setBulkRescheduleData({...bulkRescheduleData, new_time: v})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10:00">10:00</SelectItem>
                  <SelectItem value="10:30">10:30</SelectItem>
                  <SelectItem value="11:00">11:00</SelectItem>
                  <SelectItem value="11:30">11:30</SelectItem>
                  <SelectItem value="12:00">12:00</SelectItem>
                  <SelectItem value="12:30">12:30</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason for Rescheduling * (min 10 characters)</Label>
              <Textarea
                placeholder="e.g., Office closure due to public holiday"
                value={bulkRescheduleData.reason}
                onChange={(e) => setBulkRescheduleData({...bulkRescheduleData, reason: e.target.value})}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkRescheduleDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkReschedule}
              disabled={actionLoading}
              data-testid="confirm-bulk-reschedule-btn"
            >
              {actionLoading ? "Processing..." : "Reschedule All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-username">Username *</Label>
              <Input
                id="new-username"
                value={newUserData.username}
                onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-password">Password *</Label>
              <Input
                id="new-password"
                type="password"
                value={newUserData.password}
                onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-fullname">Full Name *</Label>
              <Input
                id="new-fullname"
                value={newUserData.full_name}
                onChange={(e) => setNewUserData({...newUserData, full_name: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select 
                value={newUserData.role} 
                onValueChange={(v) => setNewUserData({...newUserData, role: v})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="front_desk">Front Desk</SelectItem>
                  <SelectItem value="operations_admin">Operations Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createAdminUser}
              disabled={actionLoading}
              data-testid="confirm-create-user-btn"
            >
              {actionLoading ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={showAppointmentDetailDialog} onOpenChange={setShowAppointmentDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Reference</Label>
                  <p className="font-mono font-medium">{selectedAppointment.reference_number}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <p>
                    <span className={`status-badge ${statusColors[selectedAppointment.status]}`}>
                      {selectedAppointment.status}
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Full Name</Label>
                  <p className="font-medium">{selectedAppointment.first_name} {selectedAppointment.surname}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Service</Label>
                  <p>{serviceNames[selectedAppointment.service_type]}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Email</Label>
                  <p className="text-sm">{selectedAppointment.email}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Phone</Label>
                  <p>{selectedAppointment.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Appointment Date</Label>
                  <p>{format(parseISO(selectedAppointment.appointment_date), "MMMM dd, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Time</Label>
                  <p>{selectedAppointment.appointment_time || "10:00"}</p>
                </div>
              </div>
              {selectedAppointment.nin_or_application_number && (
                <div>
                  <Label className="text-gray-500">NIN / Application Number</Label>
                  <p className="font-mono">{selectedAppointment.nin_or_application_number}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-gray-500">Checked In</Label>
                  <p className={selectedAppointment.checked_in ? "text-green-600" : "text-gray-400"}>
                    {selectedAppointment.checked_in ? `Yes (${selectedAppointment.checked_in_at ? format(parseISO(selectedAppointment.checked_in_at), "HH:mm") : ''})` : 'No'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Served</Label>
                  <p className={selectedAppointment.served ? "text-green-600" : "text-gray-400"}>
                    {selectedAppointment.served ? `Yes (${selectedAppointment.served_at ? format(parseISO(selectedAppointment.served_at), "HH:mm") : ''})` : 'No'}
                  </p>
                </div>
              </div>
              {selectedAppointment.rejection_reason && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <Label className="text-red-600">Rejection Reason</Label>
                  <p className="text-red-800">{selectedAppointment.rejection_reason}</p>
                </div>
              )}
              <div className="text-xs text-gray-400">
                Created: {format(parseISO(selectedAppointment.created_at), "MMM dd, yyyy HH:mm")}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAppointmentDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
