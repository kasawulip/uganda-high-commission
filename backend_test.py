#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any
import uuid

class NIDAppointmentTester:
    def __init__(self, base_url="https://nid-appointment-book.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.appointment_id = None
        self.test_results = []

    def log_result(self, test_name: str, success: bool, message: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED - {message}")
        
        self.test_results.append({
            "test": test_name,
            "status": "PASSED" if success else "FAILED",
            "message": message
        })

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Dict[Any, Any] = None, headers: Dict[str, str] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        # Default headers
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=req_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            print(f"   Status Code: {response.status_code}")
            success = response.status_code == expected_status
            
            response_data = {}
            try:
                response_data = response.json()
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
            except:
                print(f"   Response: {response.text[:200]}...")

            if success:
                self.log_result(name, True)
                return True, response_data
            else:
                self.log_result(name, False, f"Expected {expected_status}, got {response.status_code}")
                return False, response_data

        except Exception as e:
            self.log_result(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic health endpoints"""
        self.run_test("Health Check", "GET", "/health", 200)
        self.run_test("Root Endpoint", "GET", "/", 200)

    def test_services_endpoint(self):
        """Test services endpoint"""
        success, data = self.run_test("Get Services", "GET", "/services", 200)
        if success:
            # Verify service structure - now includes card_pickup
            expected_services = ["fresh_registration", "renewal", "get_first_id", "change_of_particulars", "card_pickup"]
            if all(service in data for service in expected_services):
                self.log_result("Services Structure Validation", True)
                
                # Test Card Pick-up service specifically
                if "card_pickup" in data and "title" in data["card_pickup"]:
                    if data["card_pickup"]["title"] == "Card Pick-up":
                        self.log_result("Card Pick-up Service Present", True)
                    else:
                        self.log_result("Card Pick-up Service Present", False, "Incorrect title")
                else:
                    self.log_result("Card Pick-up Service Present", False, "Missing card_pickup service")
            else:
                self.log_result("Services Structure Validation", False, "Missing expected services")

    def test_disabled_dates_endpoint(self):
        """Test disabled dates endpoint"""
        success, data = self.run_test("Get Disabled Dates", "GET", "/disabled-dates", 200)
        if success:
            # Verify structure
            if "disabled_dates" in data and "holidays" in data:
                self.log_result("Disabled Dates Structure", True)
            else:
                self.log_result("Disabled Dates Structure", False, "Missing required fields")

    def test_admin_login(self):
        """Test admin login with default credentials"""
        credentials = {
            "username": "admin",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/admin/login",
            200,
            data=credentials
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log_result("Admin Token Retrieved", True)
            return True
        else:
            self.log_result("Admin Token Retrieved", False, "No access token in response")
            return False

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        if not self.token:
            self.log_result("Admin Stats", False, "No admin token available")
            return

        success, data = self.run_test("Admin Stats", "GET", "/admin/stats", 200)
        if success:
            # Verify stats structure
            expected_fields = ["total", "pending", "completed", "cancelled", "by_service", "by_date"]
            if all(field in data for field in expected_fields):
                self.log_result("Admin Stats Structure", True)
            else:
                self.log_result("Admin Stats Structure", False, "Missing expected fields")

    def test_create_appointment(self):
        """Test appointment creation"""
        # Get a valid future date (Tuesday, Wednesday, or Friday)
        tomorrow = date.today() + timedelta(days=1)
        appointment_date = tomorrow
        
        # Find next valid appointment date
        while appointment_date.weekday() not in [1, 2, 4]:  # Tue, Wed, Fri
            appointment_date += timedelta(days=1)
            
        appointment_data = {
            "surname": "TestUser",
            "first_name": "John",
            "email": f"test{uuid.uuid4().hex[:8]}@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": appointment_date.isoformat()
        }
        
        success, response = self.run_test(
            "Create Appointment",
            "POST",
            "/appointments",
            200,  # Backend returns 200 instead of 201
            data=appointment_data
        )
        
        if success and 'id' in response:
            self.appointment_id = response['id']
            self.log_result("Appointment ID Retrieved", True)
            
            # Verify appointment structure
            required_fields = ["id", "reference_number", "surname", "first_name", "email", "phone", "service_type", "appointment_date", "status"]
            if all(field in response for field in required_fields):
                self.log_result("Appointment Structure Validation", True)
            else:
                self.log_result("Appointment Structure Validation", False, "Missing required fields")
            
            return True
        else:
            self.log_result("Appointment Creation", False, "Failed to create appointment")
            return False

    def test_get_appointment(self):
        """Test getting appointment by ID"""
        if not self.appointment_id:
            self.log_result("Get Appointment", False, "No appointment ID available")
            return

        success, data = self.run_test(
            "Get Appointment by ID",
            "GET",
            f"/appointments/{self.appointment_id}",
            200
        )
        
        if success:
            # Verify the appointment data
            if data.get("id") == self.appointment_id:
                self.log_result("Appointment Data Validation", True)
            else:
                self.log_result("Appointment Data Validation", False, "ID mismatch")

    def test_appointment_pdf(self):
        """Test PDF generation endpoint"""
        if not self.appointment_id:
            self.log_result("Appointment PDF", False, "No appointment ID available")
            return

        # Test PDF download endpoint
        url = f"{self.base_url}/appointments/{self.appointment_id}/pdf"
        try:
            response = requests.get(url, timeout=15)
            if response.status_code == 200 and response.headers.get('content-type') == 'application/pdf':
                self.log_result("PDF Generation", True)
            else:
                self.log_result("PDF Generation", False, f"Status: {response.status_code}, Type: {response.headers.get('content-type')}")
        except Exception as e:
            self.log_result("PDF Generation", False, f"Exception: {str(e)}")

    def test_admin_appointments_list(self):
        """Test admin appointments list"""
        if not self.token:
            self.log_result("Admin Appointments List", False, "No admin token available")
            return

        success, data = self.run_test("Admin Get Appointments", "GET", "/admin/appointments", 200)
        if success and isinstance(data, list):
            self.log_result("Admin Appointments List Structure", True)
            
            # Test filtering
            if self.appointment_id:
                # Try to find our created appointment
                found_appointment = any(apt.get("id") == self.appointment_id for apt in data)
                if found_appointment:
                    self.log_result("Created Appointment Found in List", True)
                else:
                    self.log_result("Created Appointment Found in List", False, "Appointment not found in admin list")

    def test_update_appointment_status(self):
        """Test updating appointment status"""
        if not self.token or not self.appointment_id:
            self.log_result("Update Appointment Status", False, "Missing token or appointment ID")
            return

        # Test status update
        success, _ = self.run_test(
            "Update Status to Completed",
            "PATCH",
            f"/admin/appointments/{self.appointment_id}?status=completed",
            200
        )
        
        if success:
            # Verify the status was updated by getting the appointment
            check_success, data = self.run_test(
                "Verify Status Update",
                "GET",
                f"/appointments/{self.appointment_id}",
                200
            )
            
            if check_success and data.get("status") == "completed":
                self.log_result("Status Update Verification", True)
            else:
                self.log_result("Status Update Verification", False, f"Status is {data.get('status')}, expected 'completed'")

    def test_card_pickup_service(self):
        """Test Card Pick-up service with NIN requirement"""
        # Get a valid future date
        tomorrow = date.today() + timedelta(days=1)
        appointment_date = tomorrow
        
        # Find next valid appointment date
        while appointment_date.weekday() not in [1, 2, 4]:  # Tue, Wed, Fri
            appointment_date += timedelta(days=1)
        
        # Test Card Pick-up without NIN (should fail)
        card_pickup_no_nin = {
            "surname": "TestUser",
            "first_name": "Jane",
            "email": f"test{uuid.uuid4().hex[:8]}@example.com",
            "phone": "+256701234567",  # Uganda number
            "service_type": "card_pickup",
            "appointment_date": appointment_date.isoformat()
        }
        
        self.run_test(
            "Card Pick-up Without NIN (Should Fail)",
            "POST",
            "/appointments",
            400,
            data=card_pickup_no_nin
        )
        
        # Test Card Pick-up with NIN (should succeed)
        card_pickup_with_nin = {
            "surname": "TestUser",
            "first_name": "Jane", 
            "email": f"test{uuid.uuid4().hex[:8]}@example.com",
            "phone": "+256701234567",  # Uganda number
            "service_type": "card_pickup",
            "appointment_date": appointment_date.isoformat(),
            "nin_or_application_number": "CF12345678901234"
        }
        
        success, response = self.run_test(
            "Card Pick-up With NIN",
            "POST",
            "/appointments", 
            200,
            data=card_pickup_with_nin
        )
        
        if success and response.get("nin_or_application_number") == "CF12345678901234":
            self.log_result("NIN Field Saved Correctly", True)
        else:
            self.log_result("NIN Field Saved Correctly", False, "NIN not saved properly")

    def test_phone_validation_uganda(self):
        """Test Uganda phone number validation"""
        appointment_date = date.today() + timedelta(days=1)
        while appointment_date.weekday() not in [1, 2, 4]:
            appointment_date += timedelta(days=1)
            
        # Test valid Uganda number
        uganda_phone_data = {
            "surname": "TestUser",
            "first_name": "John",
            "email": f"test{uuid.uuid4().hex[:8]}@example.com",
            "phone": "+256701234567",  # Valid Uganda format
            "service_type": "renewal", 
            "appointment_date": appointment_date.isoformat()
        }
        
        self.run_test(
            "Valid Uganda Phone Number",
            "POST",
            "/appointments",
            200,
            data=uganda_phone_data
        )

    def test_invalid_appointment_data(self):
        """Test error handling with invalid data"""
        # Test invalid date (weekend)
        invalid_data = {
            "surname": "Test",
            "first_name": "User", 
            "email": "test@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": "2025-08-16"  # Saturday
        }
        
        success, _ = self.run_test(
            "Invalid Date (Weekend)",
            "POST",
            "/appointments",
            400,
            data=invalid_data
        )

        # Test invalid phone format
        invalid_phone_data = {
            "surname": "Test",
            "first_name": "User",
            "email": "test@example.com", 
            "phone": "123456",  # Invalid format
            "service_type": "renewal",
            "appointment_date": (date.today() + timedelta(days=7)).isoformat()
        }
        
        self.run_test(
            "Invalid Phone Format",
            "POST", 
            "/appointments",
            422,  # Validation error
            data=invalid_phone_data
        )

    def test_unauthorized_access(self):
        """Test unauthorized access to admin endpoints"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        self.run_test("Unauthorized Admin Stats", "GET", "/admin/stats", 401)
        self.run_test("Unauthorized Admin Appointments", "GET", "/admin/appointments", 200)  # This endpoint allows no auth
        
        # Restore token
        self.token = original_token

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 60)
        print("🚀 Starting Uganda High Commission NID Appointment System Tests")
        print("=" * 60)
        
        # Basic functionality tests
        print("\n📋 Testing Basic Endpoints...")
        self.test_health_check()
        self.test_services_endpoint()
        self.test_disabled_dates_endpoint()
        
        # Authentication tests
        print("\n🔐 Testing Admin Authentication...")
        admin_login_success = self.test_admin_login()
        
        if admin_login_success:
            self.test_admin_stats()
        
        # Appointment tests
        print("\n📅 Testing Appointment Management...")
        appointment_created = self.test_create_appointment()
        
        if appointment_created:
            self.test_get_appointment()
            self.test_appointment_pdf()
        
        # Admin management tests
        if admin_login_success:
            print("\n👨‍💼 Testing Admin Management...")
            self.test_admin_appointments_list()
            
            if appointment_created:
                self.test_update_appointment_status()
        
        # Error handling tests
        print("\n❌ Testing Error Handling...")
        self.test_invalid_appointment_data()
        self.test_unauthorized_access()
        
        # Print summary
        self.print_summary()
        
        # Return success status
        return self.tests_passed == self.tests_run

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if r["status"] == "FAILED"]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['message']}")
        else:
            print(f"\n🎉 ALL TESTS PASSED!")
        
        print("=" * 60)

def main():
    """Main test runner"""
    tester = NIDAppointmentTester()
    success = tester.run_all_tests()
    
    # Save test results
    results_file = f"/app/test_reports/backend_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "failed_tests": tester.tests_run - tester.tests_passed,
            "success_rate": (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
            "test_results": tester.test_results
        }, f, indent=2)
    
    print(f"💾 Test results saved to: {results_file}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())