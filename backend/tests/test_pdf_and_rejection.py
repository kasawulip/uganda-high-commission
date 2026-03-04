"""
Test PDF Generation and Rejection Notification Features
- PDF download endpoints (server-side PDF generation)
- Rejection notification display for rejected appointments
- Email notifications are disabled (verified via code)
"""

import pytest
import requests
import os
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test rejected appointment reference number
REJECTED_APPOINTMENT_REF = "UHC-20260304-856C28F9"


class TestPDFDownload:
    """Test PDF generation and download endpoints"""
    
    def test_pdf_endpoint_returns_pdf(self):
        """GET /api/appointments/{id}/pdf should return a valid PDF"""
        # First get the appointment ID from reference
        response = requests.get(f"{BASE_URL}/api/appointments/by-reference/{REJECTED_APPOINTMENT_REF}")
        assert response.status_code == 200, f"Failed to get appointment: {response.text}"
        
        appointment = response.json()
        appointment_id = appointment["id"]
        
        # Test PDF download
        pdf_response = requests.get(f"{BASE_URL}/api/appointments/{appointment_id}/pdf")
        
        assert pdf_response.status_code == 200, f"PDF download failed: {pdf_response.status_code}"
        assert pdf_response.headers.get("content-type") == "application/pdf", "Response is not PDF"
        assert "attachment" in pdf_response.headers.get("content-disposition", ""), "Missing download header"
        
        # Check PDF content starts with PDF magic number
        assert pdf_response.content[:4] == b'%PDF', "Invalid PDF content"
        
        print("✓ PDF endpoint returns valid PDF with correct headers")
    
    def test_pdf_for_confirmed_appointment(self):
        """Test PDF download for a confirmed appointment"""
        # Create a test appointment to generate PDF
        response = requests.get(f"{BASE_URL}/api/admin/appointments?status=confirmed", 
                                headers={"Content-Type": "application/json"})
        
        appointments = response.json()
        if appointments:
            apt = appointments[0]
            pdf_response = requests.get(f"{BASE_URL}/api/appointments/{apt['id']}/pdf")
            assert pdf_response.status_code == 200
            assert pdf_response.content[:4] == b'%PDF'
            print(f"✓ PDF download works for confirmed appointment: {apt['reference_number']}")
        else:
            pytest.skip("No confirmed appointments to test")
    
    def test_pdf_endpoint_404_for_invalid_id(self):
        """GET /api/appointments/invalid-id/pdf should return 404"""
        response = requests.get(f"{BASE_URL}/api/appointments/invalid-id-12345/pdf")
        assert response.status_code == 404
        print("✓ PDF endpoint returns 404 for invalid appointment ID")


class TestRejectedAppointment:
    """Test rejected appointment status and data"""
    
    def test_rejected_appointment_has_correct_status(self):
        """Rejected appointment should have status='rejected'"""
        response = requests.get(f"{BASE_URL}/api/appointments/by-reference/{REJECTED_APPOINTMENT_REF}")
        assert response.status_code == 200
        
        appointment = response.json()
        assert appointment["status"] == "rejected", f"Expected status 'rejected', got '{appointment['status']}'"
        print("✓ Rejected appointment has correct status")
    
    def test_rejected_appointment_has_rejection_reason(self):
        """Rejected appointment should have a rejection_reason"""
        response = requests.get(f"{BASE_URL}/api/appointments/by-reference/{REJECTED_APPOINTMENT_REF}")
        appointment = response.json()
        
        assert "rejection_reason" in appointment, "Missing rejection_reason field"
        assert appointment["rejection_reason"] is not None, "rejection_reason is null"
        assert len(appointment["rejection_reason"]) > 10, "rejection_reason too short"
        
        print(f"✓ Rejection reason: {appointment['rejection_reason'][:50]}...")
    
    def test_rejected_appointment_has_timestamp(self):
        """Rejected appointment should have rejected_at timestamp"""
        response = requests.get(f"{BASE_URL}/api/appointments/by-reference/{REJECTED_APPOINTMENT_REF}")
        appointment = response.json()
        
        assert "rejected_at" in appointment, "Missing rejected_at field"
        assert appointment["rejected_at"] is not None, "rejected_at is null"
        # Check ISO format
        assert "2026" in appointment["rejected_at"], "Invalid rejected_at format"
        
        print(f"✓ Rejected timestamp: {appointment['rejected_at']}")
    
    def test_rejected_appointment_has_rejected_by(self):
        """Rejected appointment should have rejected_by user info"""
        response = requests.get(f"{BASE_URL}/api/appointments/by-reference/{REJECTED_APPOINTMENT_REF}")
        appointment = response.json()
        
        assert "rejected_by" in appointment, "Missing rejected_by field"
        assert appointment["rejected_by"] is not None, "rejected_by is null"
        
        print(f"✓ Rejected by: {appointment['rejected_by']}")
    
    def test_rejected_appointment_shows_in_admin_list(self):
        """Rejected appointments should be visible in admin list with status filter"""
        response = requests.get(f"{BASE_URL}/api/admin/appointments?status=rejected")
        assert response.status_code == 200
        
        appointments = response.json()
        assert isinstance(appointments, list)
        
        # Find our test appointment
        found = any(apt["reference_number"] == REJECTED_APPOINTMENT_REF for apt in appointments)
        assert found, f"Rejected appointment {REJECTED_APPOINTMENT_REF} not found in admin list"
        
        print(f"✓ Found {len(appointments)} rejected appointments in admin list")


class TestAdminRejectEndpoint:
    """Test the admin reject endpoint"""
    
    def test_reject_endpoint_requires_reason(self):
        """POST /api/admin/appointments/{id}/reject should require a reason"""
        # Create a new appointment to reject
        today = date.today()
        # Find next valid day (Monday, Wednesday, or Friday for card_pickup)
        days_ahead = 1
        while (today + timedelta(days=days_ahead)).weekday() > 4:  # Mon-Fri
            days_ahead += 1
        
        test_date = (today + timedelta(days=days_ahead)).isoformat()
        
        create_response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "RejectTest",
            "first_name": "API",
            "email": f"reject_test_{days_ahead}@example.com",
            "phone": "+447123456888",
            "service_type": "card_pickup",
            "appointment_date": test_date,
            "appointment_time": "11:00",
            "nin_or_application_number": "CM98765432101234"
        })
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test appointment: {create_response.text}")
        
        appointment = create_response.json()
        
        # Test that reject without reason fails
        reject_response = requests.post(
            f"{BASE_URL}/api/admin/appointments/{appointment['id']}/reject",
            json={"reason": ""}
        )
        assert reject_response.status_code in [400, 422], "Should fail without proper reason"
        
        # Clean up - delete the test appointment
        requests.delete(f"{BASE_URL}/api/admin/appointments/{appointment['id']}")
        
        print("✓ Reject endpoint validates reason length")
    
    def test_reject_only_for_card_pickup(self):
        """Reject with reason should only work for card_pickup service"""
        # Try to reject a non-card-pickup appointment (if any exist)
        response = requests.get(f"{BASE_URL}/api/admin/appointments?status=confirmed")
        appointments = response.json()
        
        non_pickup = [a for a in appointments if a.get("service_type") != "card_pickup"]
        
        if non_pickup:
            apt = non_pickup[0]
            reject_response = requests.post(
                f"{BASE_URL}/api/admin/appointments/{apt['id']}/reject",
                json={"reason": "Test rejection reason that is long enough"}
            )
            assert reject_response.status_code == 400
            print("✓ Reject with reason only works for card_pickup service")
        else:
            pytest.skip("No non-card-pickup appointments to test")


class TestEmailDisabled:
    """Verify email notifications are disabled in the backend code"""
    
    def test_email_commented_out_in_code(self):
        """Check that email sending code is commented out"""
        import subprocess
        
        # Check for commented email lines
        result = subprocess.run(
            ["grep", "-c", "# Email notifications are currently disabled", "/app/backend/server.py"],
            capture_output=True,
            text=True
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip() else 0
        assert count >= 2, f"Expected at least 2 'Email notifications disabled' comments, found {count}"
        
        print(f"✓ Found {count} places where email notifications are disabled")
    
    def test_send_email_calls_commented(self):
        """Check that email function calls are commented out"""
        import subprocess
        
        # Check for commented send_confirmation_email
        result = subprocess.run(
            ["grep", "-c", "# email_sent = await send_confirmation_email", "/app/backend/server.py"],
            capture_output=True,
            text=True
        )
        
        count = int(result.stdout.strip()) if result.stdout.strip() else 0
        assert count >= 1, f"Expected send_confirmation_email to be commented out"
        
        print("✓ Email sending functions are properly commented out")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
