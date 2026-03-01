import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  LayoutDashboard, Calendar, Users, LogOut, Search, 
  MoreVertical, CheckCircle, XCircle, Trash2, Download,
  RefreshCw, Filter, ChevronLeft, ChevronRight, FileText,
  TrendingUp, Clock, AlertCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const serviceNames = {
  fresh_registration: "Fresh Registration",
  renewal: "Renewal",
  get_first_id: "Get First ID",
  change_of_particulars: "Change of Particulars"
};

const statusColors = {
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800"
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    status: "",
    service_type: "",
    search: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const itemsPerPage = 10;

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/admin");
      return;
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
        navigate("/admin");
      }
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin");
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
      console.error("Failed to update status:", error);
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
      console.error("Failed to delete appointment:", error);
      toast.error("Failed to delete appointment");
    } finally {
      setActionLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Reference", "Name", "Email", "Phone", "Service", "Date", "Status"];
    const rows = filteredAppointments.map(a => [
      a.reference_number,
      `${a.first_name} ${a.surname}`,
      a.email,
      a.phone,
      serviceNames[a.service_type],
      a.appointment_date,
      a.status
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
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchesSearch = 
        apt.surname.toLowerCase().includes(search) ||
        apt.first_name.toLowerCase().includes(search) ||
        apt.email.toLowerCase().includes(search) ||
        apt.reference_number.toLowerCase().includes(search);
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
      <aside className="admin-sidebar hidden md:block">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">Uganda High Commission</p>
        </div>
        <nav className="py-4">
          <button className="admin-nav-item active w-full" data-testid="nav-dashboard">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button className="admin-nav-item w-full" data-testid="nav-appointments">
            <Calendar className="w-5 h-5" />
            Appointments
          </button>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
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
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
          <Button variant="ghost" onClick={handleLogout} size="sm">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="stats-card" data-testid="stat-total">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="value">{stats?.total || 0}</p>
                  <p className="label">Total Appointments</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="stats-card" data-testid="stat-pending">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="value">{stats?.pending || 0}</p>
                  <p className="label">Confirmed</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="stats-card" data-testid="stat-completed">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="value">{stats?.completed || 0}</p>
                  <p className="label">Completed</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="stats-card" data-testid="stat-cancelled">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="value">{stats?.cancelled || 0}</p>
                  <p className="label">Cancelled</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Appointments Table */}
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
                <Button variant="outline" size="sm" onClick={exportToCSV} data-testid="export-btn">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
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
                    placeholder="Search by name, email, reference..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                    data-testid="search-input"
                  />
                </div>
              </div>
              <Select 
                value={filters.status} 
                onValueChange={(v) => setFilters({ ...filters, status: v })}
              >
                <SelectTrigger className="w-[150px]" data-testid="filter-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={filters.service_type} 
                onValueChange={(v) => setFilters({ ...filters, service_type: v })}
              >
                <SelectTrigger className="w-[180px]" data-testid="filter-service">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Services</SelectItem>
                  <SelectItem value="fresh_registration">Fresh Registration</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="get_first_id">Get First ID</SelectItem>
                  <SelectItem value="change_of_particulars">Change of Particulars</SelectItem>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
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
                            <p className="text-sm text-gray-500">{apt.email}</p>
                          </div>
                        </td>
                        <td>{serviceNames[apt.service_type]}</td>
                        <td>{format(parseISO(apt.appointment_date), "MMM dd, yyyy")}</td>
                        <td>
                          <span className={`status-badge ${statusColors[apt.status]}`}>
                            {apt.status}
                          </span>
                        </td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`actions-${apt.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => updateStatus(apt.id, "completed")}
                                disabled={apt.status === "completed"}
                              >
                                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                Mark Complete
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateStatus(apt.id, "cancelled")}
                                disabled={apt.status === "cancelled"}
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAppointments.length)} of {filteredAppointments.length} results
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="prev-page-btn"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="next-page-btn"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
            <div className="py-4">
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
    </div>
  );
}
