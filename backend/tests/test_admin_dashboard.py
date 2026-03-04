"""
Admin Dashboard API Tests
Tests for admin login, appointments management, check-in, mark-served, 
reject card pickup, bulk reschedule, audit logs, and user management
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nira-high-commission.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test successful admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "access_token missing from response"
        assert "user" in data, "user missing from response"
        assert data["user"]["username"] == ADMIN_USERNAME
        assert data["user"]["role"] == "super_admin"
        assert "full_name" in data["user"]
    
    def test_admin_login_invalid_password(self):
        """Test login with invalid password"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": ADMIN_USERNAME,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_admin_login_invalid_username(self):
        """Test login with invalid username"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": "nonexistent",
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


@pytest.fixture(scope="module")
def admin_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/admin/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


class TestDashboardStats:
    """Dashboard statistics tests"""
    
    def test_get_stats(self, admin_token):
        """Test getting dashboard statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify all required stats fields
        assert "total" in data, "total missing"
        assert "pending" in data, "pending missing"
        assert "completed" in data, "completed missing"
        assert "cancelled" in data, "cancelled missing"
        assert "rejected" in data, "rejected missing"
        assert "checked_in" in data, "checked_in missing"
        assert "served" in data, "served missing"
        assert "today_bookings" in data, "today_bookings missing"
        assert "next_7_days" in data, "next_7_days missing"
        assert "by_service" in data, "by_service missing"


class TestAppointmentsManagement:
    """Appointments CRUD and management tests"""
    
    def test_get_all_appointments(self, admin_token):
        """Test fetching all appointments"""
        response = requests.get(
            f"{BASE_URL}/api/admin/appointments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert isinstance(response.json(), list)
    
    def test_search_appointments(self, admin_token):
        """Test appointment search functionality"""
        response = requests.get(
            f"{BASE_URL}/api/admin/appointments?search=test",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_filter_by_status(self, admin_token):
        """Test filtering appointments by status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/appointments?status=confirmed",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        # All returned appointments should have status = confirmed
        for apt in response.json():
            assert apt.get("status") == "confirmed", f"Expected confirmed status, got {apt.get('status')}"
    
    def test_filter_by_service_type(self, admin_token):
        """Test filtering appointments by service type"""
        response = requests.get(
            f"{BASE_URL}/api/admin/appointments?service_type=card_pickup",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        for apt in response.json():
            assert apt.get("service_type") == "card_pickup"


@pytest.fixture(scope="class")
def test_appointment(admin_token):
    """Create a test appointment for subsequent tests"""
    # Find a valid Monday/Wednesday/Friday date
    today = datetime.now()
    test_date = today + timedelta(days=7)
    while test_date.weekday() not in [0, 2, 4]:  # Mon, Wed, Fri
        test_date += timedelta(days=1)
    
    appointment_data = {
        "surname": "TestAdminUser",
        "first_name": "Testing",
        "email": "testadmin@example.com",
        "phone": "+447123456789",
        "service_type": "fresh_registration",
        "appointment_date": test_date.strftime("%Y-%m-%d"),
        "appointment_time": "10:00"
    }
    
    response = requests.post(f"{BASE_URL}/api/appointments", json=appointment_data)
    if response.status_code == 201 or response.status_code == 200:
        return response.json()
    
    # If appointment creation fails, return None
    print(f"Warning: Could not create test appointment: {response.text}")
    return None


class TestCheckInFunctionality:
    """Check-in appointment tests"""
    
    def test_check_in_appointment(self, admin_token, test_appointment):
        """Test checking in an appointment"""
        if not test_appointment:
            pytest.skip("No test appointment available")
        
        apt_id = test_appointment.get("id")
        response = requests.post(
            f"{BASE_URL}/api/admin/appointments/{apt_id}/check-in",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Either success or already checked in
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "checked_in_at" in data or "message" in data
    
    def test_check_in_invalid_appointment(self, admin_token):
        """Test checking in a non-existent appointment"""
        response = requests.post(
            f"{BASE_URL}/api/admin/appointments/nonexistent-id/check-in",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404


class TestMarkServedFunctionality:
    """Mark as served tests"""
    
    def test_mark_served(self, admin_token, test_appointment):
        """Test marking an appointment as served"""
        if not test_appointment:
            pytest.skip("No test appointment available")
        
        apt_id = test_appointment.get("id")
        
        # First check in if not already
        requests.post(
            f"{BASE_URL}/api/admin/appointments/{apt_id}/check-in",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        response = requests.post(
            f"{BASE_URL}/api/admin/appointments/{apt_id}/mark-served",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"


class TestRejectCardPickup:
    """Reject card pickup appointment tests"""
    
    @pytest.fixture
    def card_pickup_appointment(self, admin_token):
        """Create a card pickup appointment for testing rejection"""
        today = datetime.now()
        test_date = today + timedelta(days=14)
        # Card pickup can be any weekday
        while test_date.weekday() > 4:  # Skip weekend
            test_date += timedelta(days=1)
        
        appointment_data = {
            "surname": "TestCardPickup",
            "first_name": "Rejection",
            "email": "cardpickup@example.com",
            "phone": "+447123456789",
            "service_type": "card_pickup",
            "appointment_date": test_date.strftime("%Y-%m-%d"),
            "appointment_time": "11:00",
            "nin_or_application_number": "CM1234567890ABC"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments", json=appointment_data)
        if response.status_code in [200, 201]:
            return response.json()
        return None
    
    def test_reject_card_pickup_with_reason(self, admin_token, card_pickup_appointment):
        """Test rejecting a card pickup appointment with reason"""
        if not card_pickup_appointment:
            pytest.skip("Could not create card pickup appointment")
        
        apt_id = card_pickup_appointment.get("id")
        response = requests.post(
            f"{BASE_URL}/api/admin/appointments/{apt_id}/reject",
            json={"reason": "Your National ID card has not yet been delivered to the High Commission. Please reschedule after one month."},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the appointment was rejected
        verify_response = requests.get(
            f"{BASE_URL}/api/appointments/{apt_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if verify_response.status_code == 200:
            apt_data = verify_response.json()
            assert apt_data.get("status") == "rejected"
            assert apt_data.get("rejection_reason") is not None
    
    def test_reject_short_reason_fails(self, admin_token, card_pickup_appointment):
        """Test that rejection with short reason fails"""
        if not card_pickup_appointment:
            pytest.skip("Could not create card pickup appointment")
        
        apt_id = card_pickup_appointment.get("id")
        response = requests.post(
            f"{BASE_URL}/api/admin/appointments/{apt_id}/reject",
            json={"reason": "short"},  # Less than 10 characters
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 422, f"Expected 422 for validation error, got {response.status_code}"


class TestBulkReschedule:
    """Bulk reschedule appointments tests"""
    
    def test_bulk_reschedule_requires_filter(self, admin_token):
        """Test that bulk reschedule requires either date or service type"""
        today = datetime.now()
        new_date = today + timedelta(days=21)
        while new_date.weekday() not in [0, 2, 4]:
            new_date += timedelta(days=1)
        
        response = requests.post(
            f"{BASE_URL}/api/admin/bulk-reschedule",
            json={
                "new_date": new_date.strftime("%Y-%m-%d"),
                "new_time": "10:00",
                "reason": "Test bulk reschedule without filter"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_bulk_reschedule_by_date(self, admin_token):
        """Test bulk reschedule with date filter"""
        today = datetime.now()
        original_date = today + timedelta(days=30)
        new_date = today + timedelta(days=35)
        
        while original_date.weekday() not in [0, 2, 4]:
            original_date += timedelta(days=1)
        while new_date.weekday() not in [0, 2, 4]:
            new_date += timedelta(days=1)
        
        response = requests.post(
            f"{BASE_URL}/api/admin/bulk-reschedule",
            json={
                "original_date": original_date.strftime("%Y-%m-%d"),
                "new_date": new_date.strftime("%Y-%m-%d"),
                "new_time": "10:00",
                "reason": "Office closure due to maintenance work"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "count" in data
        assert "message" in data


class TestAuditLogs:
    """Audit logs tests"""
    
    def test_get_audit_logs(self, admin_token):
        """Test fetching audit logs (super_admin or operations_admin)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/audit-logs?limit=50",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        logs = response.json()
        assert isinstance(logs, list)
        
        # Verify log structure if logs exist
        if logs:
            log = logs[0]
            assert "timestamp" in log
            assert "username" in log
            assert "action" in log
            assert "resource_type" in log
    
    def test_export_audit_logs(self, admin_token):
        """Test exporting audit logs as CSV"""
        response = requests.get(
            f"{BASE_URL}/api/admin/audit-logs/export",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify it's CSV format
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type or response.text.startswith("Timestamp")


class TestUserManagement:
    """User management tests (super_admin only)"""
    
    def test_get_admin_users(self, admin_token):
        """Test getting list of admin users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        users = response.json()
        assert isinstance(users, list)
        
        # Verify user structure
        if users:
            user = users[0]
            assert "username" in user
            assert "role" in user
            # Password hash should NOT be returned
            assert "password_hash" not in user
    
    def test_create_admin_user(self, admin_token):
        """Test creating a new admin user"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        new_user = {
            "username": f"test_user_{unique_id}",
            "password": "testpassword123",
            "email": f"testuser_{unique_id}@example.com",
            "full_name": "Test User Admin",
            "role": "front_desk"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users",
            json=new_user,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data or "message" in data
    
    def test_create_duplicate_user_fails(self, admin_token):
        """Test that creating duplicate username fails"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users",
            json={
                "username": "admin",  # Existing user
                "password": "testpassword",
                "email": "duplicate@example.com",
                "full_name": "Duplicate Admin",
                "role": "front_desk"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestDailyWorklist:
    """Daily worklist download tests"""
    
    def test_get_daily_worklist(self, admin_token):
        """Test getting daily worklist"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/admin/reports/daily-worklist?report_date={today}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "date" in data
        assert "total_appointments" in data
        assert "worklist_by_service" in data
    
    def test_download_daily_worklist(self, admin_token):
        """Test downloading daily worklist as CSV"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/admin/reports/daily-worklist/download?report_date={today}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type


class TestRoleBasedAccess:
    """Role-based access control tests"""
    
    @pytest.fixture
    def front_desk_token(self, admin_token):
        """Create and get token for front desk user"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create front desk user
        requests.post(
            f"{BASE_URL}/api/admin/users",
            json={
                "username": f"frontdesk_{unique_id}",
                "password": "frontdesk123",
                "email": f"frontdesk_{unique_id}@example.com",
                "full_name": "Front Desk User",
                "role": "front_desk"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Login as front desk
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "username": f"frontdesk_{unique_id}",
            "password": "frontdesk123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        return None
    
    def test_front_desk_cannot_manage_users(self, front_desk_token):
        """Test that front desk cannot access user management"""
        if not front_desk_token:
            pytest.skip("Could not create front desk user")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {front_desk_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for RBAC, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
