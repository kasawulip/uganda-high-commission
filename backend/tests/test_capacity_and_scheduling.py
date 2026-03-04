"""
Test suite for Capacity Indicator and Service-Specific Scheduling features
- GET /api/capacity endpoint (public - no auth required)
- Service-specific scheduling rules (Mon/Wed/Fri vs Mon-Fri)
- NIN requirement for Renewal and Card Pickup services
"""
import pytest
import requests
import os
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestPublicCapacityEndpoint:
    """Test public /api/capacity endpoint - no authentication required"""
    
    def test_capacity_returns_200_without_auth(self):
        """Capacity endpoint should be accessible without authentication"""
        response = requests.get(f"{BASE_URL}/api/capacity")
        assert response.status_code == 200
        data = response.json()
        assert "capacity" in data
        assert "max_slots_per_day" in data
        print("✓ Capacity endpoint accessible without auth")
    
    def test_capacity_returns_correct_structure(self):
        """Capacity response should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/capacity")
        assert response.status_code == 200
        data = response.json()
        
        # Check overall structure
        assert isinstance(data["capacity"], list)
        assert data["max_slots_per_day"] == 50
        
        # Check each capacity item structure
        for item in data["capacity"]:
            assert "date" in item
            assert "booked" in item
            assert "available" in item
            assert "utilization_percent" in item
            assert "level" in item
            assert item["level"] in ["available", "moderate", "limited", "full"]
        print("✓ Capacity response structure is correct")
    
    def test_capacity_with_service_type_filter(self):
        """Capacity endpoint should filter by service type"""
        # Card pickup has Mon-Fri schedule
        response = requests.get(f"{BASE_URL}/api/capacity?service_type=card_pickup")
        assert response.status_code == 200
        data = response.json()
        assert data["service_type"] == "card_pickup"
        
        # Fresh registration has Mon/Wed/Fri schedule - should have fewer dates
        response2 = requests.get(f"{BASE_URL}/api/capacity?service_type=fresh_registration")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Card pickup should have more available dates (Mon-Fri vs Mon/Wed/Fri)
        assert len(data["capacity"]) >= len(data2["capacity"])
        print("✓ Capacity filters by service type correctly")
    
    def test_capacity_levels_calculation(self):
        """Verify capacity levels are calculated correctly"""
        response = requests.get(f"{BASE_URL}/api/capacity")
        data = response.json()
        
        for item in data["capacity"]:
            booked = item["booked"]
            available = item["available"]
            utilization = item["utilization_percent"]
            level = item["level"]
            
            # Check utilization calculation
            expected_util = round((booked / 50) * 100, 1) if 50 > 0 else 0
            assert abs(utilization - expected_util) < 0.2  # Allow small float rounding diff
            
            # Check level assignment
            if available == 0:
                assert level == "full"
            elif utilization >= 80:
                assert level == "limited"
            elif utilization >= 50:
                assert level == "moderate"
            else:
                assert level == "available"
        print("✓ Capacity levels calculated correctly")


class TestServiceSchedulingRules:
    """Test service-specific scheduling rules"""
    
    def get_next_weekday(self, target_weekday):
        """Get next date that falls on target weekday (0=Mon, 1=Tue, etc)"""
        today = date.today()
        days_ahead = target_weekday - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        return today + timedelta(days=days_ahead)
    
    def test_fresh_registration_mon_wed_fri_only(self):
        """Fresh registration should only be available Mon, Wed, Fri"""
        tuesday = self.get_next_weekday(1)  # Tuesday
        
        response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "TEST",
            "first_name": "FreshRegSchedule",
            "email": "testfresh_schedule@example.com",
            "phone": "+447123456789",
            "service_type": "fresh_registration",
            "appointment_date": tuesday.isoformat(),
            "appointment_time": "10:00"
        })
        
        assert response.status_code == 400
        assert "Monday, Wednesday, and Friday" in response.json()["detail"]
        print("✓ Fresh registration rejected on Tuesday")
    
    def test_card_pickup_mon_to_fri(self):
        """Card pickup should be available Mon-Fri"""
        tuesday = self.get_next_weekday(1)  # Tuesday
        
        response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "TEST",
            "first_name": "CardPickupTuesday",
            "email": "testpickup_tue@example.com",
            "phone": "+447123456789",
            "service_type": "card_pickup",
            "appointment_date": tuesday.isoformat(),
            "appointment_time": "10:00",
            "nin_or_application_number": "CM123TEST"
        })
        
        assert response.status_code in [200, 201, 409]  # 409 if slot already taken
        if response.status_code in [200, 201]:
            print("✓ Card pickup accepted on Tuesday")
        else:
            print("✓ Card pickup endpoint works (slot may be full)")
    
    def test_renewal_requires_valid_day(self):
        """Renewal should follow Mon/Wed/Fri schedule"""
        tuesday = self.get_next_weekday(1)  # Tuesday
        
        response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "TEST",
            "first_name": "RenewalSchedule",
            "email": "testrenewal_schedule@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": tuesday.isoformat(),
            "appointment_time": "10:00",
            "nin_or_application_number": "CM123RENEW"
        })
        
        assert response.status_code == 400
        assert "Monday, Wednesday, and Friday" in response.json()["detail"]
        print("✓ Renewal rejected on Tuesday (follows Mon/Wed/Fri rule)")


class TestNINRequirement:
    """Test NIN requirement for Card Pickup and Renewal services"""
    
    def get_valid_appointment_date(self, service_type):
        """Get next valid appointment date for service type"""
        today = date.today()
        # Find next Monday (valid for all service types)
        days_ahead = 0 - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        return today + timedelta(days=days_ahead)
    
    def test_renewal_requires_nin(self):
        """Renewal service should require NIN or Application Number"""
        monday = self.get_valid_appointment_date("renewal")
        
        response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "TEST",
            "first_name": "RenewalNoNIN",
            "email": "testrenewal_nonin@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": monday.isoformat(),
            "appointment_time": "10:00"
        })
        
        assert response.status_code == 400
        assert "NIN or Application Number is required for Renewal" in response.json()["detail"]
        print("✓ Renewal requires NIN - validation working")
    
    def test_renewal_with_nin_succeeds(self):
        """Renewal service with NIN should succeed"""
        monday = self.get_valid_appointment_date("renewal")
        
        response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "TEST",
            "first_name": "RenewalWithNIN",
            "email": f"testrenewal_{monday.isoformat()}@example.com",
            "phone": "+447123456789",
            "service_type": "renewal",
            "appointment_date": monday.isoformat(),
            "appointment_time": "11:00",
            "nin_or_application_number": "CM123RENEWAL"
        })
        
        assert response.status_code in [200, 201, 409]
        if response.status_code in [200, 201]:
            data = response.json()
            assert data["nin_or_application_number"] == "CM123RENEWAL"
            print("✓ Renewal with NIN accepted")
        else:
            print("✓ Renewal endpoint works (slot may be taken)")
    
    def test_card_pickup_requires_nin(self):
        """Card pickup service should require NIN or Application Number"""
        monday = self.get_valid_appointment_date("card_pickup")
        
        response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "TEST",
            "first_name": "CardPickupNoNIN",
            "email": "testpickup_nonin@example.com",
            "phone": "+447123456789",
            "service_type": "card_pickup",
            "appointment_date": monday.isoformat(),
            "appointment_time": "10:00"
        })
        
        assert response.status_code == 400
        assert "NIN or Application Number is required for Card Pick-up" in response.json()["detail"]
        print("✓ Card pickup requires NIN - validation working")
    
    def test_fresh_registration_no_nin_required(self):
        """Fresh registration should NOT require NIN"""
        monday = self.get_valid_appointment_date("fresh_registration")
        
        response = requests.post(f"{BASE_URL}/api/appointments", json={
            "surname": "TEST",
            "first_name": "FreshNoNIN",
            "email": f"testfresh_nonin_{monday.isoformat()}@example.com",
            "phone": "+447123456789",
            "service_type": "fresh_registration",
            "appointment_date": monday.isoformat(),
            "appointment_time": "10:30"
        })
        
        # Should succeed without NIN
        assert response.status_code in [200, 201, 409]
        if response.status_code in [200, 201]:
            print("✓ Fresh registration works without NIN")
        else:
            print("✓ Fresh registration endpoint works (slot may be taken)")


class TestDisabledDatesEndpoint:
    """Test disabled dates endpoint with service type filter"""
    
    def test_disabled_dates_without_service_type(self):
        """Disabled dates should return Mon/Wed/Fri pattern by default"""
        response = requests.get(f"{BASE_URL}/api/disabled-dates")
        assert response.status_code == 200
        data = response.json()
        
        assert "disabled_dates" in data
        assert "holidays" in data
        assert "time_slots" in data
        assert "time_window" in data
        print("✓ Disabled dates endpoint returns correct structure")
    
    def test_disabled_dates_with_card_pickup(self):
        """Card pickup should have fewer disabled dates (Mon-Fri allowed)"""
        response_default = requests.get(f"{BASE_URL}/api/disabled-dates")
        response_pickup = requests.get(f"{BASE_URL}/api/disabled-dates?service_type=card_pickup")
        
        assert response_pickup.status_code == 200
        
        default_disabled = len(response_default.json()["disabled_dates"])
        pickup_disabled = len(response_pickup.json()["disabled_dates"])
        
        # Card pickup should have fewer disabled dates (allows Tue/Thu)
        assert pickup_disabled <= default_disabled
        print(f"✓ Card pickup has {default_disabled - pickup_disabled} fewer disabled dates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
