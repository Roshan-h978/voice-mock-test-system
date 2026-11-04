"""Tests for the Profile page: photo, details and goals, summary and achievements, sign-ins, data download and
deleting an account."""

import json
import os
import shutil
import tempfile
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.attempts.models import Answer, Attempt
from apps.learning.models import NotebookMark, PracticeAnswer
from apps.notifications.models import Notification
from apps.tests_manager.models import MockTest, Question

from .models import User

PASSWORD = "Speak-Clearly-2026"
TEST_MEDIA = tempfile.mkdtemp()
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 64


def tearDownModule():
    shutil.rmtree(TEST_MEDIA, ignore_errors=True)


def photo(content=PNG, name="me.png", content_type="image/png"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def make_user(email="aarati@example.com", role=User.Role.STUDENT, full_name="Aarati Sharma", **extra):
    return User.objects.create_user(email=email, password=PASSWORD, full_name=full_name, role=role, **extra)


@override_settings(
    MEDIA_ROOT=TEST_MEDIA,
    EVALUATION_DEMO_MODE=True,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    EMAIL_DELIVERY="django",
)
class ProfileTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user()
        self.client.force_authenticate(self.user)

    def sign_in(self, email="aarati@example.com", password=PASSWORD):
        response = self.client.post(reverse("auth-login"), {"email": email, "password": password}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def refresh_works(self, token):
        return self.client.post(reverse("auth-refresh"), {"refresh": token}, format="json").status_code == 200

    def finished_attempt(self, student, overall=72, days_ago=0, seconds=45, title="Everyday conversation"):
        test = MockTest.objects.create(title=title, status=MockTest.Status.PUBLISHED)
        question = Question.objects.create(test=test, text="Describe your favourite place.")
        when = timezone.now() - timedelta(days=days_ago)
        attempt = Attempt.objects.create(
            student=student,
            test=test,
            status=Attempt.Status.SCORED,
            overall=overall,
            fluency=overall,
            pronunciation=overall,
            grammar=overall,
            submitted_at=when,
        )
        Answer.objects.create(
            attempt=attempt,
            question=question,
            question_order=1,
            question_text=question.text,
            audio=ContentFile(b"fake-audio", name="answer.webm"),
            duration_seconds=seconds,
            transcript="I like the river near my house.",
            overall=overall,
        )
        return attempt

    def practice(self, student, overall=65, days_ago=0, seconds=30):
        item = PracticeAnswer.objects.create(
            student=student,
            question_text="Talk about your morning.",
            audio=ContentFile(b"fake-audio", name="practice.webm"),
            duration_seconds=seconds,
            overall=overall,
            fluency=overall,
            pronunciation=overall,
            grammar=overall,
        )
        PracticeAnswer.objects.filter(pk=item.pk).update(created_at=timezone.now() - timedelta(days=days_ago))
        return item


class AccountFieldsTests(ProfileTestCase):
    def test_me_includes_the_profile_fields(self):
        data = self.client.get(reverse("auth-me")).data
        for field in ("bio", "purpose", "weekly_goal", "target_score", "email_updates", "avatar_url", "has_password"):
            self.assertIn(field, data)
        self.assertIsNone(data["avatar_url"])
        self.assertTrue(data["has_password"])
        self.assertTrue(data["email_updates"])

    def test_update_details_and_goals(self):
        response = self.client.patch(
            reverse("auth-me"),
            {
                "bio": "  Nursing student   preparing for  IELTS. ",
                "purpose": "ielts",
                "weekly_goal": 4,
                "target_score": 75,
                "email_updates": False,
                "phone": "+977 980-000 0000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["bio"], "Nursing student preparing for IELTS.")
        self.assertEqual(response.data["purpose"], "ielts")
        self.assertEqual(response.data["weekly_goal"], 4)
        self.assertEqual(response.data["target_score"], 75)
        self.assertFalse(response.data["email_updates"])

    def test_goals_can_be_cleared(self):
        self.client.patch(reverse("auth-me"), {"weekly_goal": 3, "target_score": 70}, format="json")
        response = self.client.patch(reverse("auth-me"), {"weekly_goal": None, "target_score": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["weekly_goal"])

    def test_invalid_values_are_refused_with_field_messages(self):
        cases = {
            "weekly_goal": 8,
            "target_score": 30,
            "purpose": "astronaut",
            "bio": "x" * 161,
            "phone": "call me maybe",
        }
        for field, value in cases.items():
            with self.subTest(field=field):
                response = self.client.patch(reverse("auth-me"), {field: value}, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_email_cannot_be_changed_here(self):
        self.client.patch(reverse("auth-me"), {"email": "other@example.com"}, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "aarati@example.com")


class AvatarTests(ProfileTestCase):
    def test_upload_replace_and_remove_a_photo(self):
        first = self.client.post(reverse("auth-avatar"), {"avatar": photo()}, format="multipart")
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertTrue(first.data["avatar_url"].startswith("http://testserver/media/avatars/user-"))
        self.user.refresh_from_db()
        first_path = self.user.avatar.path
        self.assertTrue(first_path.endswith(".png"))
        self.assertTrue(os.path.exists(first_path))

        second = self.client.post(reverse("auth-avatar"), {"avatar": photo(JPEG, "me.jpg", "image/jpeg")}, format="multipart")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar.name.endswith(".jpg"))
        self.assertFalse(os.path.exists(first_path), "the old photo is removed")

        removed = self.client.delete(reverse("auth-avatar"))
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertIsNone(removed.data["avatar_url"])
        self.assertFalse(os.path.exists(os.path.join(TEST_MEDIA, second.data["avatar_url"].split("/media/")[1])))

    def test_webp_is_accepted(self):
        response = self.client.post(reverse("auth-avatar"), {"avatar": photo(WEBP, "me.webp", "image/webp")}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["avatar_url"].endswith(".webp"))

    def test_only_real_images_are_stored(self):
        svg = photo(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "me.png", "image/png")
        for upload in (svg, photo(b"<html></html>", "me.jpg", "image/jpeg"), photo(b"", "empty.png")):
            with self.subTest(name=upload.name):
                response = self.client.post(reverse("auth-avatar"), {"avatar": upload}, format="multipart")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)

    def test_missing_file(self):
        response = self.client.post(reverse("auth-avatar"), {}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(MAX_AVATAR_UPLOAD_MB=1)
    def test_too_large(self):
        big = photo(PNG + b"\x00" * (1024 * 1024))
        response = self.client.post(reverse("auth-avatar"), {"avatar": big}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("too large", response.data["detail"])

    def test_needs_sign_in(self):
        self.client.force_authenticate(None)
        response = self.client.post(reverse("auth-avatar"), {"avatar": photo()}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_photo_shows_on_sign_in(self):
        self.client.post(reverse("auth-avatar"), {"avatar": photo()}, format="multipart")
        self.client.force_authenticate(None)
        data = self.sign_in()
        self.assertTrue(data["user"]["avatar_url"].startswith("http://testserver/media/avatars/"))


class SummaryTests(ProfileTestCase):
    def test_new_student(self):
        data = self.client.get(reverse("auth-profile-summary")).data
        self.assertEqual(data["role"], "student")
        steps = {step["key"]: step for step in data["strength"]["steps"]}
        self.assertEqual(
            list(steps), ["name", "photo", "bio", "purpose", "goals", "password", "first_test"]
        )
        self.assertTrue(steps["name"]["done"])
        self.assertTrue(steps["password"]["done"])
        self.assertFalse(steps["photo"]["done"])
        self.assertEqual(data["strength"]["percent"], round(2 * 100 / 7))
        self.assertEqual(len(data["achievements"]), 7)
        self.assertEqual(data["badges_earned"], 0)
        self.assertTrue(all(badge["level"] == 0 and badge["next_goal"] == badge["goals"][0] for badge in data["achievements"]))
        self.assertEqual(len(data["week"]["days"]), 7)
        self.assertEqual(data["week"]["active_days"], 0)
        self.assertIsNone(data["records"]["best_test"])
        self.assertEqual(data["sign_ins"]["active"], 0)

    def test_numbers_achievements_and_week(self):
        for days_ago, score in enumerate([58, 66, 84]):
            self.finished_attempt(self.user, overall=score, days_ago=days_ago, seconds=300)
        for _ in range(5):
            self.practice(self.user, overall=62)
        NotebookMark.objects.create(student=self.user, key="c:abc")
        self.user.weekly_goal, self.user.target_score, self.user.purpose = 4, 80, "ielts"
        self.user.save()

        data = self.client.get(reverse("auth-profile-summary")).data
        stats = data["stats"]
        self.assertEqual(stats["tests_completed"], 3)
        self.assertEqual(stats["practice_answers"], 5)
        self.assertEqual(stats["average_score"], 69)
        self.assertEqual(stats["current_streak"], 3)
        self.assertEqual(stats["minutes_spoken"], round((3 * 300 + 5 * 30) / 60))
        self.assertEqual(data["records"]["best_test"]["score"], 84)
        self.assertEqual(data["records"]["best_practice"], 62)

        badges = {badge["key"]: badge for badge in data["achievements"]}
        self.assertEqual(badges["tests"]["level"], 1)  # 3 tests: past 1, not yet 5
        self.assertEqual(badges["tests"]["next_goal"], 5)
        self.assertEqual(badges["streak"]["level"], 1)  # 3 days in a row
        self.assertEqual(badges["score"]["level"], 3)  # 84%: past 60, 70 and 80
        self.assertEqual(badges["practice"]["level"], 1)
        self.assertEqual(badges["notebook"]["level"], 1)
        self.assertEqual(data["levels_earned"], sum(badge["level"] for badge in badges.values()))

        today = timezone.localdate().isoformat()
        today_cell = next(day for day in data["week"]["days"] if day["date"] == today)
        self.assertTrue(today_cell["is_today"])
        self.assertGreater(today_cell["count"], 0)
        self.assertEqual(data["week"]["goal"], 4)
        self.assertEqual(data["target"]["score"], 80)
        steps = {step["key"]: step["done"] for step in data["strength"]["steps"]}
        self.assertTrue(steps["goals"] and steps["purpose"] and steps["first_test"])

    def test_numbers_are_the_students_own(self):
        other = make_user("bikash@example.com", full_name="Bikash Rai")
        self.finished_attempt(other, overall=90)
        data = self.client.get(reverse("auth-profile-summary")).data
        self.assertEqual(data["stats"]["tests_completed"], 0)

    def test_maximum_level(self):
        for days_ago in range(30):
            self.practice(self.user, days_ago=days_ago)
        badges = {badge["key"]: badge for badge in self.client.get(reverse("auth-profile-summary")).data["achievements"]}
        self.assertEqual(badges["streak"]["level"], 4)
        self.assertIsNone(badges["streak"]["next_goal"])

    def test_admin_summary(self):
        admin = make_user("nisha@example.com", role=User.Role.ADMIN, full_name="Nisha Adhikari")
        MockTest.objects.create(title="Travel", status=MockTest.Status.PUBLISHED, created_by=admin)
        MockTest.objects.create(title="Work", created_by=admin)
        self.client.force_authenticate(admin)
        data = self.client.get(reverse("auth-profile-summary")).data
        self.assertEqual(data["role"], "admin")
        self.assertEqual(data["stats"]["tests_created"], 2)
        self.assertEqual(data["stats"]["tests_published"], 1)
        self.assertEqual(data["stats"]["active_students"], 1)
        self.assertNotIn("achievements", data)
        self.assertEqual([step["key"] for step in data["strength"]["steps"]], ["name", "photo", "bio", "password"])


class SignInTests(ProfileTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(None)

    def test_sign_out_other_devices(self):
        laptop = self.sign_in()
        phone = self.sign_in()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {laptop['access']}")
        self.assertEqual(self.client.get(reverse("auth-profile-summary")).data["sign_ins"]["active"], 2)

        response = self.client.post(reverse("auth-sign-out-others"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertFalse(self.refresh_works(phone["refresh"]))
        self.assertFalse(self.refresh_works(laptop["refresh"]))
        self.assertTrue(self.refresh_works(response.data["refresh"]), "this browser keeps going with the new tokens")

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get(reverse("auth-profile-summary")).data["sign_ins"]["active"], 1)

    def test_change_password_and_sign_out_others(self):
        laptop = self.sign_in()
        phone = self.sign_in()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {laptop['access']}")
        response = self.client.post(
            reverse("auth-change-password"),
            {"current_password": PASSWORD, "new_password": "Another-Strong-2026", "sign_out_others": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("refresh", response.data)
        self.assertFalse(self.refresh_works(phone["refresh"]))
        self.assertTrue(self.refresh_works(response.data["refresh"]))

    def test_change_password_alone_keeps_other_devices(self):
        laptop = self.sign_in()
        phone = self.sign_in()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {laptop['access']}")
        response = self.client.post(
            reverse("auth-change-password"),
            {"current_password": PASSWORD, "new_password": "Another-Strong-2026"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("refresh", response.data)
        self.assertTrue(self.refresh_works(phone["refresh"]))


class ExportTests(ProfileTestCase):
    def test_download_my_data(self):
        self.finished_attempt(self.user, overall=71)
        self.practice(self.user)
        NotebookMark.objects.create(student=self.user, key="t:xyz")
        Notification.objects.create(user=self.user, kind="review_published", title="Your test was reviewed")
        other = make_user("bikash@example.com", full_name="Bikash Rai")
        self.finished_attempt(other, overall=90, title="Someone else's test")

        response = self.client.get(reverse("auth-export"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertTrue(response["Content-Type"].startswith("application/json"))
        data = json.loads(response.content)
        self.assertEqual(data["account"]["email"], "aarati@example.com")
        self.assertEqual(len(data["test_results"]), 1)
        self.assertEqual(data["test_results"][0]["scores"]["overall"], 71)
        self.assertEqual(data["test_results"][0]["answers"][0]["transcript"], "I like the river near my house.")
        self.assertEqual(len(data["practice_answers"]), 1)
        self.assertEqual(data["notebook_learned"], ["t:xyz"])
        self.assertEqual(len(data["notifications"]), 1)
        self.assertNotIn("Someone else", response.content.decode())
        self.assertNotIn("password", data["account"])

    def test_needs_sign_in(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("auth-export")).status_code, status.HTTP_401_UNAUTHORIZED)


class DeleteAccountTests(ProfileTestCase):
    def test_wrong_password_keeps_the_account(self):
        response = self.client.post(reverse("auth-delete-account"), {"password": "wrong"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_password_is_required(self):
        response = self.client.post(reverse("auth-delete-account"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_removes_everything(self):
        self.client.force_authenticate(None)
        tokens = self.sign_in()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        self.client.post(reverse("auth-avatar"), {"avatar": photo()}, format="multipart")
        attempt = self.finished_attempt(self.user)
        practice = self.practice(self.user)
        self.user.refresh_from_db()
        files = [self.user.avatar.path, attempt.answers.first().audio.path, practice.audio.path]
        self.assertTrue(all(os.path.exists(path) for path in files))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(reverse("auth-delete-account"), {"password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(Attempt.objects.filter(pk=attempt.pk).exists())
        self.assertFalse(PracticeAnswer.objects.filter(pk=practice.pk).exists())
        self.assertFalse(any(os.path.exists(path) for path in files), "recordings and the photo are removed")
        self.client.credentials()
        self.assertFalse(self.refresh_works(tokens["refresh"]))

    def test_google_only_account_confirms_with_its_email(self):
        self.user.set_unusable_password()
        self.user.save()
        wrong = self.client.post(reverse("auth-delete-account"), {"confirm_email": "nope@example.com"}, format="json")
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_email", wrong.data)
        response = self.client.post(reverse("auth-delete-account"), {"confirm_email": " Aarati@Example.com "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_admins_cannot_delete_themselves(self):
        admin = make_user("nisha@example.com", role=User.Role.ADMIN, full_name="Nisha Adhikari")
        self.client.force_authenticate(admin)
        response = self.client.post(reverse("auth-delete-account"), {"password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=admin.pk).exists())

    def test_admin_removing_a_student_also_removes_practice_recordings(self):
        practice = self.practice(self.user)
        path = practice.audio.path
        admin = make_user("nisha@example.com", role=User.Role.ADMIN, full_name="Nisha Adhikari")
        self.client.force_authenticate(admin)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse("admin-user-detail", args=[self.user.pk]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(os.path.exists(path))


class ReviewEmailPreferenceTests(ProfileTestCase):
    def setUp(self):
        super().setUp()
        self.attempt = self.finished_attempt(self.user)
        self.admin = make_user("nisha@example.com", role=User.Role.ADMIN, full_name="Nisha Adhikari")
        self.client.force_authenticate(self.admin)

    def review(self):
        return self.client.post(
            reverse("admin-attempt-review", args=[self.attempt.pk]), {"notify_student": True}, format="json"
        )

    def test_student_gets_the_email_by_default(self):
        response = self.review()
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["email_sent"])
        self.assertFalse(response.data["email_turned_off"])
        self.assertEqual(len(mail.outbox), 1)

    def test_student_turned_review_emails_off(self):
        self.user.email_updates = False
        self.user.save()
        response = self.review()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["email_sent"])
        self.assertTrue(response.data["email_turned_off"])
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(Notification.objects.filter(user=self.user).exists(), "the in-app notification still arrives")
