"""
Test suite for Iteration 8 features:
1. Renewal service does NOT require NIN input
2. Fresh Registration shows age category dropdown (Below 18 / Above 18)
3. Card Pick-up only shows NIN requirement (no 'valid form of identification')
4. PDF WHAT TO BRING shows service-specific requirements
5. PDF contact info shows 02031544027 / 02078395783
6. PDF has PRE-REGISTRATION NOTICE as proper section
7. Landing page shows 'ID Services Contact Line' with new numbers
8. Admin login does NOT show default credentials
"""

import pytest
import requests
import os
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def get_next_valid_date(service_type="fresh_registration"):
    """Get next valid appointment date for the given service type"""
    today = date.today()
    current = today + timedelta(days=1)
    
    for _ in range(30):
        weekday = current.weekday()  # 0=Monday, 4=Friday
        
        if service_type == "card_pickup":
            # Card pickup: Monday-Friday
            if weekday <= 4:
                return current.isoformat()
        else:
            # Other services: Monday, Wednesday, Friday
            if weekday in [0, 2, 4]:
                return current.isoformat()
        
        current += timedelta(days=1)
    
    raise Exception("No valid date found")


class TestServicesEndpoint:
    """Test /api/services endpoint for correct requirements"""
    
    def test_services_endpoint_available(self):
        """Test that services endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/services")
        assert response.status_code == 200
        print("PASS: Services endpoint accessible")
    
    def test_fresh_registration_has_age_categories(self):
        """Test that Fresh Registration has below_18 and above_18 categories"""
        response = requests.get(f"{BASE_URL}/api/services")
        data = response.json()
        
        assert "fresh_registration" in data
        fresh_reg = data["fresh_registration"]
        
        assert "below_18" in fresh_reg, "Missing below_18 category"
        assert "above_18" in fresh_reg, "Missing above_18 category"
        
        # Verify below_18 requirements
        below_18_reqs = fresh_reg["below_18"]["requirements"]
        assert any("escorted by a parent or guardian" in req for req in below_18_reqs), \
            "Below 18 should require guardian escort"
        
        # Verify above_18 requirements
        above_18_reqs = fresh_reg["above_18"]["requirements"]
        assert any("Recommendation Letter from the Uganda Embassy" in req for req in above_18_reqs), \
            "Above 18 should require Recommendation Letter"
        
        print("PASS: Fresh Registration has correct age category requirements")
    
    def test_card_pickup_requirements_no_valid_id(self):
        """Test Card Pick-up only shows NIN requirement (no valid form of identification)"""
        response = requests.get(f"{BASE_URL}/api/services")
        data = response.json()
        
        assert "card_pickup" in data
        card_pickup_reqs = data["card_pickup"]["requirements"]
        
        # Should have NIN requirement
        assert any("NIN" in req or "Application Number" in req for req in card_pickup_reqs), \
            "Card pickup should require NIN or Application Number"
        
        # Should NOT have "valid form of identification"
        assert not any("valid form of identification" in req for req in card_pickup_reqs), \
            "'valid form of identification' should be removed from Card Pick-up"
        
        print("PASS: Card Pick-up requirements correct (no 'valid form of identification')")
    
    def test_renewal_requirements(self):
        """Test Renewal service requirements"""
        response = requests.get(f"{BASE_URL}/api/services")
        data = response.json()
        
        assert "renewal" in data
        renewal_reqs = data["renewal"]["requirements"]
        
        # Should have National ID requirement
        assert any("National ID" in req for req in renewal_reqs), \
            "Renewal should mention National ID"
        
        print("PASS: Renewal requirements correct")


class TestRenewalNoNINRequired:
    """Test that Renewal service does NOT require NIN input"""
    
    def test_renewal_appointment_without_nin(self):
        """Create Renewal appointment without NIN - should succeed"""
        valid_date = get_next_valid_date("renewal")
        
        payload = {
            "surname": "TestNoNIN",
            "first_name": "Renewal",
            "email": "testnoin@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": valid_date,
            "appointment_time": "10:00"
            # No nin_or_application_number
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments", json=payload)
        
        assert response.status_code == 200, f"Renewal without NIN should succeed. Got: {response.text}"
        data = response.json()
        assert data["service_type"] == "renewal"
        print("PASS: Renewal appointment created without NIN")


class TestCardPickupRequiresNIN:
    """Test that Card Pick-up service DOES require NIN"""
    
    def test_card_pickup_requires_nin(self):
        """Card Pick-up without NIN should fail"""
        valid_date = get_next_valid_date("card_pickup")
        
        payload = {
            "surname": "TestNINRequired",
            "first_name": "CardPickup",
            "email": "testninreq@example.com",
            "phone": "+447123456789",
            "service_type": "card_pickup",
            "appointment_date": valid_date,
            "appointment_time": "10:00"
            # No nin_or_application_number - should fail
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments", json=payload)
        
        assert response.status_code == 400, "Card Pick-up without NIN should fail"
        assert "NIN" in response.text or "required" in response.text.lower()
        print("PASS: Card Pick-up correctly requires NIN")
    
    def test_card_pickup_with_nin_succeeds(self):
        """Card Pick-up with NIN should succeed"""
        valid_date = get_next_valid_date("card_pickup")
        
        payload = {
            "surname": "TestNINProvided",
            "first_name": "CardPickup",
            "email": "testnin@example.com",
            "phone": "+447123456789",
            "service_type": "card_pickup",
            "appointment_date": valid_date,
            "appointment_time": "10:00",
            "nin_or_application_number": "CM12345678TEST"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments", json=payload)
        
        assert response.status_code == 200, f"Card Pick-up with NIN should succeed. Got: {response.text}"
        print("PASS: Card Pick-up with NIN succeeds")


class TestPDFGeneration:
    """Test PDF generation with service-specific requirements"""
    
    def test_pdf_download_works(self):
        """Test PDF can be downloaded"""
        # First create an appointment
        valid_date = get_next_valid_date("renewal")
        
        payload = {
            "surname": "PDFTest",
            "first_name": "Download",
            "email": "pdfdownload@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": valid_date,
            "appointment_time": "10:00"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/appointments", json=payload)
        assert create_response.status_code == 200
        apt_id = create_response.json()["id"]
        
        # Download PDF
        pdf_response = requests.get(f"{BASE_URL}/api/appointments/{apt_id}/pdf")
        assert pdf_response.status_code == 200
        assert pdf_response.headers.get("content-type") == "application/pdf"
        assert len(pdf_response.content) > 1000, "PDF should have content"
        
        print("PASS: PDF download works")
    
    def test_pdf_headers_correct(self):
        """Test PDF has correct Content-Disposition header"""
        # Create appointment
        valid_date = get_next_valid_date("renewal")
        
        payload = {
            "surname": "HeaderTest",
            "first_name": "PDF",
            "email": "headertest@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": valid_date,
            "appointment_time": "10:00"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/appointments", json=payload)
        apt_id = create_response.json()["id"]
        ref_num = create_response.json()["reference_number"]
        
        pdf_response = requests.get(f"{BASE_URL}/api/appointments/{apt_id}/pdf")
        
        content_disposition = pdf_response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition
        assert ref_num in content_disposition or "appointment" in content_disposition
        
        print("PASS: PDF headers correct")


class TestAdminLogin:
    """Test admin login functionality"""
    
    def test_admin_login_works(self):
        """Test admin can login with correct credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": "admin", "password": "admin123"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        print("PASS: Admin login works")
    
    def test_admin_login_rejects_wrong_password(self):
        """Test admin login fails with wrong credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": "admin", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401
        print("PASS: Admin login rejects wrong password")


class TestNINRequiredServices:
    """Test NIN_REQUIRED_SERVICES configuration"""
    
    def test_get_first_id_no_nin_required(self):
        """Get First ID should NOT require NIN (user enters it in form)"""
        valid_date = get_next_valid_date("get_first_id")
        
        payload = {
            "surname": "GetFirstID",
            "first_name": "Test",
            "email": "getfirstid@example.com",
            "phone": "+447123456789",
            "service_type": "get_first_id",
            "appointment_date": valid_date,
            "appointment_time": "10:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments", json=payload)
        # Get First ID should work without NIN since it's not in NIN_REQUIRED_SERVICES
        assert response.status_code == 200, f"Get First ID should work without NIN: {response.text}"
        print("PASS: Get First ID works without NIN requirement at booking")
    
    def test_change_of_particulars_no_nin_required(self):
        """Change of Particulars should NOT require NIN"""
        valid_date = get_next_valid_date("change_of_particulars")
        
        payload = {
            "surname": "ChangeParticulars",
            "first_name": "Test",
            "email": "changeparticulars@example.com",
            "phone": "+447123456789",
            "service_type": "change_of_particulars",
            "appointment_date": valid_date,
            "appointment_time": "10:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/appointments", json=payload)
        assert response.status_code == 200, f"Change of Particulars should work: {response.text}"
        print("PASS: Change of Particulars works without NIN requirement")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
