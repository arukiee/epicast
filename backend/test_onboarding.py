"""
test_onboarding.py — Integration tests for EPICAST approval onboarding workflow.
Runs using Python's built-in unittest library.
"""

import unittest
import os
import secrets
from datetime import datetime, timedelta, timezone

# Ensure we use an in-memory or separate test database
os.environ["DATABASE_URL"] = "sqlite:///./epicast_test.db"
os.environ["EPICAST_ENV"] = "development"
os.environ["EMAIL_ALLOW_CONSOLE_FALLBACK"] = "true"

# Now import app components
from fastapi.testclient import TestClient
from main import app
from database import engine, SessionLocal
from models import Base, AccessRequest, User
from auth import verify_password, hash_password
from token_utils import token_matches


class TestOnboardingWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create schema in test DB
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Drop test DB tables and remove file
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("epicast_test.db"):
            try:
                os.remove("epicast_test.db")
            except Exception:
                pass

    def setUp(self):
        # Clear database rows before each test
        self.db = SessionLocal()
        self.db.query(User).filter(User.username != "admin").delete()
        self.db.query(AccessRequest).delete()
        self.db.commit()

        # Seed admin user if missing
        admin = self.db.query(User).filter(User.username == "admin").first()
        if not admin:
            self.db.add(User(
                username="admin",
                password=hash_password("admin123"),
                role="admin",
                status="active",
                email="admin@epicast.health"
            ))
            self.db.commit()

    def tearDown(self):
        self.db.close()

    def _get_admin_token(self):
        # Log in as admin to get access token
        resp = self.client.post("/login", json={
            "email": "admin",
            "password": "admin123"
        })
        self.assertEqual(resp.status_code, 200)
        return resp.json()["access_token"]

    def _post_access_request(self, payload: dict):
        return self.client.post("/request-demo", json=payload)

    def test_complete_onboarding_activation_flow(self):
        # 1. User submits request (demo registration)
        email = "doctor.test@hospital.org"
        req_payload = {
            "full_name": "Dr. Test User",
            "email": email,
            "organization": "Test General Hospital",
            "use_case": "Disease outbreak tracking in Gachibowli"
        }
        resp = self._post_access_request(req_payload)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("submitted successfully", resp.json()["message"])

        # Verify database record exists with 'pending_approval' status
        req_row = self.db.query(AccessRequest).filter(AccessRequest.email == email).first()
        self.assertIsNotNone(req_row)
        self.assertEqual(req_row.status, "pending_approval")
        self.assertIsNone(req_row.verification_token)

        # 2. Admin reviews and approves the request (assigning username, role, area, clinic)
        admin_token = self._get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}
        list_resp = self.client.get("/admin/access-requests", headers=headers)
        self.assertEqual(list_resp.status_code, 200)
        
        # Verify the request is returned in the list with pending_approval status
        items = list_resp.json()
        target_item = next((x for x in items if x["email"] == email), None)
        self.assertIsNotNone(target_item)
        self.assertEqual(target_item["status"], "pending_approval")

        approve_payload = {
            "username": "dr_test",
            "role": "clinic_staff",
            "assigned_area": "Gachibowli",
            "assigned_clinic": "Medicover Clinic"
        }
        approve_resp = self.client.post(
            f"/admin/access-requests/{req_row.id}/approve",
            json=approve_payload,
            headers=headers
        )
        self.assertEqual(approve_resp.status_code, 200)
        self.assertIn("verification email", approve_resp.json()["message"])

        # Confirm request status is 'pending_verification' and token is generated
        self.db.refresh(req_row)
        self.assertEqual(req_row.status, "pending_verification")
        self.assertIsNotNone(req_row.verification_token)
        self.assertIsNotNone(req_row.verification_expires)

        verify_token = approve_resp.json().get("verification_token")
        self.assertIsNotNone(verify_token)

        # 3. User verifies email address
        verify_resp = self.client.post("/auth/verify-email", json={
            "token": verify_token
        })
        self.assertEqual(verify_resp.status_code, 200)
        self.assertIn("verified successfully", verify_resp.json()["message"])
        self.assertIn("setup_token", verify_resp.json())
        setup_token = verify_resp.json()["setup_token"]

        # Confirm request status is 'active' and username is provisioned
        self.db.refresh(req_row)
        self.assertEqual(req_row.status, "active")
        self.assertEqual(req_row.provisioned_username, "dr_test")

        # Confirm User record is created with active status and password setup token
        user_row = self.db.query(User).filter(User.username == "dr_test").first()
        self.assertIsNotNone(user_row)
        self.assertEqual(user_row.status, "active")
        self.assertEqual(user_row.email, email)
        self.assertEqual(user_row.role, "clinic_staff")
        self.assertEqual(user_row.assigned_area, "Gachibowli")
        self.assertEqual(user_row.assigned_clinic, "Medicover Clinic")
        self.assertTrue(token_matches(setup_token, user_row.password_setup_token))

        # 4. User sets password using the password setup token
        setup_resp = self.client.post("/auth/setup-password", json={
            "token": setup_token,
            "password": "securepassword123"
        })
        self.assertEqual(setup_resp.status_code, 200)
        self.assertIn("Password configured successfully", setup_resp.json()["message"])

        # Confirm setup token is invalidated (cleared)
        self.db.refresh(user_row)
        self.assertIsNone(user_row.password_setup_token)
        self.assertIsNone(user_row.password_setup_expires)

        # 5. User logs in with new credentials
        login_resp = self.client.post("/login", json={
            "email": "dr_test",
            "password": "securepassword123"
        })
        self.assertEqual(login_resp.status_code, 200)
        self.assertEqual(login_resp.json()["username"], "dr_test")
        self.assertEqual(login_resp.json()["role"], "clinic_staff")

        # Re-using verify link after password is set should not offer setup again
        reuse_verify = self.client.post("/auth/verify-email", json={
            "token": verify_token
        })
        self.assertEqual(reuse_verify.status_code, 200)
        self.assertTrue(reuse_verify.json().get("already_completed"))
        self.assertNotIn("setup_token", reuse_verify.json())

    def test_request_demo_rejects_registered_email(self):
        self._post_access_request({
            "full_name": "Dr. Test User",
            "email": "doctor.test@hospital.org",
            "organization": "Test Clinic",
            "use_case": "Initial request",
        })
        admin_token = self._get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}
        req_row = self.db.query(AccessRequest).filter(
            AccessRequest.email == "doctor.test@hospital.org"
        ).first()
        approve_resp = self.client.post(
            f"/admin/access-requests/{req_row.id}/approve",
            json={
                "username": "dr_registered",
                "role": "clinic_staff",
                "assigned_area": "Gachibowli",
                "assigned_clinic": "Test Clinic",
            },
            headers=headers,
        )
        self.assertEqual(approve_resp.status_code, 200)
        verify_token = approve_resp.json().get("verification_token")
        self.assertIsNotNone(verify_token)

        verify_resp = self.client.post("/auth/verify-email", json={"token": verify_token})
        self.assertEqual(verify_resp.status_code, 200)
        setup_token = verify_resp.json()["setup_token"]
        self.client.post("/auth/setup-password", json={
            "token": setup_token,
            "password": "securepassword123",
        })

        check = self.client.get("/request-demo/check-email", params={
            "email": "doctor.test@hospital.org"
        })
        self.assertEqual(check.status_code, 200)
        self.assertFalse(check.json()["available"])

        dup = self.client.post("/request-demo", json={
            "full_name": "Someone Else",
            "email": "doctor.test@hospital.org",
            "organization": "Other Clinic",
            "use_case": "Duplicate",
        })
        self.assertEqual(dup.status_code, 400)
        self.assertIn("already registered", dup.json()["detail"].lower())

    def test_undeliverable_email_is_rejected(self):
        check = self.client.get("/request-demo/check-email", params={
            "email": "nobody@invalid-domain-epicast-test.invalid",
        })
        self.assertEqual(check.status_code, 200)
        self.assertFalse(check.json()["deliverable"])
        self.assertFalse(check.json()["available"])

    def test_email_validate_endpoint_reports_syntax_and_mx(self):
        bad = self.client.get("/email/validate", params={"email": "not-an-email"})
        self.assertEqual(bad.status_code, 200)
        self.assertFalse(bad.json()["deliverable"])
        self.assertFalse(bad.json()["syntax_valid"])

        good = self.client.get("/email/validate", params={"email": "user@gmail.com"})
        self.assertEqual(good.status_code, 200)
        body = good.json()
        self.assertTrue(body["deliverable"])
        self.assertTrue(body["syntax_valid"])
        self.assertTrue(body["mx_found"])
        self.assertEqual(body["check_method"], "dns_mx")
        self.assertTrue(body.get("mx_hosts"))

    def test_fake_format_with_no_mx_rejected_on_submit(self):
        """Addresses that look like email@domain.tld but have no MX must fail."""
        resp = self.client.post("/request-demo", json={
            "full_name": "Fake Domain",
            "email": "user@invalid-domain-epicast-test.invalid",
            "organization": "Test Org",
            "use_case": "Should fail DNS",
        })
        self.assertEqual(resp.status_code, 422)

    def test_duplicate_verify_email_is_idempotent(self):
        """Simulates React StrictMode double-submit: second verify must not fail."""
        email = "duplicate.verify@test.org"
        self._post_access_request({
            "full_name": "Dr. Duplicate",
            "email": email,
            "organization": "Test Clinic",
            "use_case": "Testing duplicate verify",
        })
        req_row = self.db.query(AccessRequest).filter(AccessRequest.email == email).first()
        admin_token = self._get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}
        approve_resp = self.client.post(
            f"/admin/access-requests/{req_row.id}/approve",
            json={
                "username": "dr_dup",
                "role": "clinic_staff",
                "assigned_area": "Secunderabad",
                "assigned_clinic": "Test Clinic",
            },
            headers=headers,
        )
        token = approve_resp.json().get("verification_token")
        self.assertIsNotNone(token)

        first = self.client.post("/auth/verify-email", json={"token": token})
        second = self.client.post("/auth/verify-email", json={"token": token})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertIn("setup_token", first.json())
        self.assertIn("setup_token", second.json())
        self.assertEqual(self.db.query(User).filter(User.email == email).count(), 1)

    def test_cannot_approve_unverified_request(self):
        # Create request that is already awaiting verification
        req = AccessRequest(
            full_name="Dr. Unverified",
            email="unverified@test.org",
            organization="Clinic A",
            created_at=datetime.now(timezone.utc).isoformat(),
            status="pending_verification",
            verification_token="unverified-tok"
        )
        self.db.add(req)
        self.db.commit()

        admin_token = self._get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Approve request — should fail since status is not 'pending_approval'
        resp = self.client.post(
            f"/admin/access-requests/{req.id}/approve",
            json={
                "username": "dr_unverified",
                "role": "clinic_staff"
            },
            headers=headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("must be pending approval first", resp.json()["detail"])

    def test_admin_can_reject_request(self):
        # Create request
        req = AccessRequest(
            full_name="Dr. Spam",
            email="spam@spam.org",
            organization="Spam Inc",
            created_at=datetime.now(timezone.utc).isoformat(),
            status="pending_verification",
            verification_token="spam-tok"
        )
        self.db.add(req)
        self.db.commit()

        admin_token = self._get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Reject request
        resp = self.client.post(
            f"/admin/access-requests/{req.id}/reject",
            headers=headers
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["message"], "Access request rejected.")

        # Check DB status
        self.db.refresh(req)
        self.assertEqual(req.status, "rejected")

    def test_background_cleanup_task(self):
        import asyncio
        from tasks import cleanup_expired_records

        # Create expired verification request
        past_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        expired_req = AccessRequest(
            full_name="Expired User",
            email="expired@test.org",
            organization="Clinic B",
            created_at=past_time,
            status="pending_verification",
            verification_token="expired-verify-token",
            verification_expires=past_time
        )
        self.db.add(expired_req)

        # Create expired user setup token
        expired_user = User(
            username="expired_user",
            password="somepassword",
            email="expired_user@test.org",
            role="clinic_staff",
            status="active",
            password_setup_token="expired-setup-token",
            password_setup_expires=past_time
        )
        self.db.add(expired_user)
        self.db.commit()

        # Run the cleanup logic manually
        asyncio.run(cleanup_expired_records())

        # Verify request status became 'expired' and token is cleared
        self.db.refresh(expired_req)
        self.assertEqual(expired_req.status, "expired")
        self.assertIsNone(expired_req.verification_token)
        self.assertIsNone(expired_req.verification_expires)

        # Verify user password setup token and expires are cleared
        self.db.refresh(expired_user)
        self.assertIsNone(expired_user.password_setup_token)
        self.assertIsNone(expired_user.password_setup_expires)

    def test_report_validations(self):
        admin_token = self._get_admin_token()
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Report case with future date (should fail validation)
        future_date = (datetime.now() + timedelta(days=2)).date().isoformat()
        payload = {
            "area_id": "HYD-GACHI",
            "area_name": "Gachibowli",
            "clinic_name": "AIG Hospital",
            "latitude": 17.44,
            "longitude": 78.3489,
            "disease_name": "Dengue",
            "case_count": 10,
            "date": future_date
        }
        resp = self.client.post("/report_case", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 422)

        # 2. Report death with future date (should fail validation)
        payload_death = {
            "area_id": "HYD-GACHI",
            "area_name": "Gachibowli",
            "clinic_name": "AIG Hospital",
            "latitude": 17.44,
            "longitude": 78.3489,
            "disease_name": "Dengue",
            "death_count": 5,
            "date": future_date
        }
        resp = self.client.post("/report_death", json=payload_death, headers=headers)
        self.assertEqual(resp.status_code, 422)

        # 3. Report death when there are no cases (should fail with 400 Bad Request)
        today = datetime.now().date().isoformat()
        payload_death["date"] = today
        resp = self.client.post("/report_death", json=payload_death, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Cumulative deaths", resp.json()["detail"])

        # 4. Report case successfully
        payload["date"] = today
        resp = self.client.post("/report_case", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 201)

        # 5. Report death successfully (deaths <= cases)
        resp = self.client.post("/report_death", json=payload_death, headers=headers)
        self.assertEqual(resp.status_code, 201)

        # 6. Report death that exceeds cumulative cases (should fail with 400 Bad Request)
        payload_death["death_count"] = 10  # total deaths would be 5 + 10 = 15, which exceeds 10 cases
        resp = self.client.post("/report_death", json=payload_death, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Cumulative deaths", resp.json()["detail"])


if __name__ == "__main__":
    unittest.main()
