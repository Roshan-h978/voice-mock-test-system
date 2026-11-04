"""
The Profile page: profile photo, profile strength, achievements, weekly goal, sign-ins, "Download my data"
and "Delete my account".
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.common.utils import ServiceError

logger = logging.getLogger(__name__)
User = get_user_model()

# ---------------------------------------------------------------------------
# Profile photo
# ---------------------------------------------------------------------------
# Checked from the file's first bytes, not its name or the browser's claim, so nothing else (an SVG or a web
# page with a script in it) can be stored as a profile photo.
IMAGE_SIGNATURES = (
    (b"\xff\xd8\xff", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
)


def image_extension(head: bytes) -> str | None:
    for signature, extension in IMAGE_SIGNATURES:
        if head.startswith(signature):
            return extension
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def save_avatar(user, upload) -> None:
    """Store a new profile photo (JPEG, PNG or WebP) and remove the old one."""
    if upload is None:
        raise ServiceError("Choose a photo to upload.")
    limit_mb = settings.MAX_AVATAR_UPLOAD_MB
    if upload.size > limit_mb * 1024 * 1024:
        raise ServiceError(f"The photo is too large. Choose one under {limit_mb} MB.")
    if upload.size == 0:
        raise ServiceError("The photo file is empty.")
    head = upload.read(16)
    upload.seek(0)
    extension = image_extension(head)
    if extension is None:
        raise ServiceError("Use a JPG, PNG or WebP photo.")

    old_name = user.avatar.name
    storage = user.avatar.storage
    user.avatar.save(f"photo.{extension}", ContentFile(upload.read()), save=False)
    user.save(update_fields=["avatar"])
    if old_name:
        _delete_file(storage, old_name)


def remove_avatar(user) -> None:
    name, storage = user.avatar.name, user.avatar.storage
    if not name:
        return
    user.avatar = ""
    user.save(update_fields=["avatar"])
    _delete_file(storage, name)


def _delete_file(storage, name: str) -> None:
    try:
        storage.delete(name)
    except Exception:  # noqa: BLE001 - a leftover file must never break the request
        logger.warning("Could not delete the file %s", name)


# ---------------------------------------------------------------------------
# Sign-ins (browsers and devices)
# ---------------------------------------------------------------------------
def sign_out_everywhere(user) -> None:
    """Blacklist every refresh token the user holds, so every browser and device is signed out."""
    for token in OutstandingToken.objects.filter(user=user, blacklistedtoken__isnull=True):
        BlacklistedToken.objects.get_or_create(token=token)


def active_sign_ins(user):
    """Refresh tokens that still work: one per browser or device that is signed in."""
    return OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now(), blacklistedtoken__isnull=True)


def sign_in_summary(user) -> dict:
    tokens = active_sign_ins(user)
    latest = tokens.order_by("-created_at").values_list("created_at", flat=True).first()
    return {"active": tokens.count(), "last_activity": latest, "last_login": user.last_login}


# ---------------------------------------------------------------------------
# Achievements (students): each has four levels
# ---------------------------------------------------------------------------
ACHIEVEMENTS = (
    {
        "key": "tests",
        "title": "Test taker",
        "description": "Finish full mock tests.",
        "unit": ["test", "tests"],
        "goals": [1, 5, 10, 25],
    },
    {
        "key": "streak",
        "title": "On a roll",
        "description": "Practise on days in a row. Your longest streak counts.",
        "unit": ["day in a row", "days in a row"],
        "goals": [3, 7, 14, 30],
    },
    {
        "key": "score",
        "title": "High scorer",
        "description": "Reach a top overall score in a mock test.",
        "unit": ["%", "%"],
        "goals": [60, 70, 80, 90],
    },
    {
        "key": "practice",
        "title": "Practice habit",
        "description": "Answer Quick practice questions.",
        "unit": ["answer", "answers"],
        "goals": [5, 20, 50, 100],
    },
    {
        "key": "minutes",
        "title": "Chatterbox",
        "description": "Minutes of English spoken in tests and practice.",
        "unit": ["minute", "minutes"],
        "goals": [10, 30, 60, 180],
    },
    {
        "key": "notebook",
        "title": "Word collector",
        "description": "Corrections and tips you marked as learned in your notebook.",
        "unit": ["item", "items"],
        "goals": [1, 10, 25, 50],
    },
    {
        "key": "balanced",
        "title": "All-rounder",
        "description": "Your weakest skill (fluency, pronunciation or grammar) in your recent answers.",
        "unit": ["%", "%"],
        "goals": [50, 60, 70, 80],
    },
)


def achievements(values: dict) -> list[dict]:
    items = []
    for definition in ACHIEVEMENTS:
        value = values.get(definition["key"]) or 0
        goals = definition["goals"]
        level = sum(1 for goal in goals if value >= goal)
        items.append(
            {
                **definition,
                "value": value,
                "level": level,
                "max_level": len(goals),
                "next_goal": goals[level] if level < len(goals) else None,
            }
        )
    return items


# ---------------------------------------------------------------------------
# Profile strength
# ---------------------------------------------------------------------------
def _step(key, label, done, action):
    return {"key": key, "label": label, "done": bool(done), "action": action}


def profile_strength(user, *, tests_completed: int = 0) -> dict:
    """Small, optional steps that make the profile and the app more useful. `action` tells the page where to go."""
    steps = [
        _step("name", "Add your full name", len(user.full_name.strip()) >= 2, "details"),
        _step("photo", "Add a profile photo", user.avatar, "photo"),
        _step("bio", "Write a short bio", user.bio.strip(), "details"),
    ]
    if user.is_student:
        steps += [
            _step("purpose", "Say what you're practising for", user.purpose, "goals"),
            _step("goals", "Set a weekly goal and a target score", user.weekly_goal and user.target_score, "goals"),
        ]
    steps.append(_step("password", "Choose your own password", not user.uses_default_password, "security"))
    if user.is_student:
        steps.append(_step("first_test", "Finish your first mock test", tests_completed > 0, "tests"))
    done = sum(1 for step in steps if step["done"])
    return {"percent": round(done * 100 / len(steps)), "done": done, "total": len(steps), "steps": steps}


# ---------------------------------------------------------------------------
# Everything the Profile page shows
# ---------------------------------------------------------------------------
def profile_summary(user) -> dict:
    if user.is_student:
        return _student_summary(user)
    return _admin_summary(user)


def _student_summary(user) -> dict:
    from apps.attempts.models import FINISHED_STATUSES, Attempt
    from apps.learning.models import NotebookMark, PracticeAnswer
    from apps.learning.services import progress

    data = progress(user, days=7)  # same numbers as the My progress page
    totals, skills = data["totals"], data["skills"]
    finished = Attempt.objects.filter(student=user, status__in=FINISHED_STATUSES, submitted_at__isnull=False)
    best = finished.filter(overall__isnull=False).select_related("test").order_by("-overall", "submitted_at").first()
    best_practice = PracticeAnswer.objects.filter(student=user).aggregate(value=Max("overall"))["value"]
    skill_now = [skills[skill]["current"] for skill in ("fluency", "pronunciation", "grammar")]
    learned = NotebookMark.objects.filter(student=user).count()

    # This week, Monday to Sunday
    today = timezone.localdate()
    monday = today - timedelta(days=today.weekday())
    counts = {day["date"]: day["count"] for day in data["activity"]}
    week_days = []
    for offset in range(7):
        day = monday + timedelta(days=offset)
        week_days.append(
            {"date": day.isoformat(), "count": counts.get(day.isoformat(), 0), "is_today": day == today, "is_future": day > today}
        )
    active_this_week = sum(1 for day in week_days if day["count"])

    values = {
        "tests": totals["tests_completed"],
        "streak": data["streak"]["longest"],
        "score": best.overall if best else 0,
        "practice": totals["practice_answers"],
        "minutes": totals["minutes_spoken"],
        "notebook": learned,
        "balanced": min(skill_now) if all(value is not None for value in skill_now) else 0,
    }
    badges = achievements(values)
    return {
        "role": "student",
        "strength": profile_strength(user, tests_completed=totals["tests_completed"]),
        "stats": {
            "tests_completed": totals["tests_completed"],
            "practice_answers": totals["practice_answers"],
            "average_score": totals["average_score"],
            "minutes_spoken": totals["minutes_spoken"],
            "current_streak": data["streak"]["current"],
            "longest_streak": data["streak"]["longest"],
            "notebook_learned": learned,
        },
        "records": {
            "best_test": {"score": best.overall, "title": best.test.title, "date": best.submitted_at, "attempt_id": best.id}
            if best
            else None,
            "best_practice": best_practice,
            "longest_streak": data["streak"]["longest"],
        },
        "focus_skill": data["focus_skill"],
        "week": {"goal": user.weekly_goal, "active_days": active_this_week, "days": week_days},
        "target": {"score": user.target_score, "average": totals["average_score"], "recent": skills["overall"]["current"]},
        "achievements": badges,
        "badges_earned": sum(1 for badge in badges if badge["level"]),
        "levels_earned": sum(badge["level"] for badge in badges),
        "levels_total": sum(badge["max_level"] for badge in badges),
        "sign_ins": sign_in_summary(user),
    }


def _admin_summary(user) -> dict:
    from apps.attempts.models import Attempt
    from apps.tests_manager.models import MockTest

    created = MockTest.objects.filter(created_by=user)
    return {
        "role": "admin",
        "strength": profile_strength(user),
        "stats": {
            "tests_created": created.count(),
            "tests_published": created.filter(status=MockTest.Status.PUBLISHED).count(),
            "reviews_published": Attempt.objects.filter(reviewer=user, status=Attempt.Status.REVIEWED).count(),
            "waiting_for_review": Attempt.objects.filter(status=Attempt.Status.NEEDS_REVIEW).count(),
            "active_students": User.objects.filter(role=User.Role.STUDENT, is_active=True, is_superuser=False).count(),
        },
        "sign_ins": sign_in_summary(user),
    }


# ---------------------------------------------------------------------------
# Download my data
# ---------------------------------------------------------------------------
def _scores(item) -> dict:
    return {
        field: getattr(item, field, None)
        for field in ("overall", "fluency", "pronunciation", "grammar", "coherence", "relevance")
        if hasattr(item, field)
    }


def export_data(user) -> dict:
    """Everything the app keeps about this person, as plain JSON (recordings are listed, not attached)."""
    from apps.attempts.models import Attempt
    from apps.learning.models import NotebookMark, PracticeAnswer
    from apps.notifications.models import Notification

    attempts = Attempt.objects.filter(student=user).select_related("test", "reviewer").prefetch_related("answers")
    return {
        "exported_at": timezone.now().isoformat(),
        "account": {
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "level": user.level,
            "phone": user.phone,
            "bio": user.bio,
            "purpose": user.get_purpose_display() if user.purpose else "",
            "weekly_goal_days": user.weekly_goal,
            "target_score": user.target_score,
            "email_updates": user.email_updates,
            "has_profile_photo": bool(user.avatar),
            "date_joined": user.date_joined.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
        },
        "test_results": [
            {
                "test": attempt.test.title,
                "status": attempt.get_status_display(),
                "started_at": attempt.started_at.isoformat(),
                "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                "scores": _scores(attempt),
                "headline": attempt.headline,
                "summary": attempt.summary,
                "strengths": attempt.strengths,
                "tip": attempt.tip,
                "next_step": attempt.next_step,
                "teacher_note": attempt.reviewer_note,
                "reviewed_by": attempt.reviewer.full_name if attempt.reviewer else None,
                "answers": [
                    {
                        "question": answer.question_text,
                        "transcript": answer.transcript,
                        "seconds": answer.duration_seconds,
                        "scores": _scores(answer),
                        "strengths": answer.strengths,
                        "tip": answer.tip,
                        "corrections": answer.corrections,
                        "recording_file": answer.audio.name,
                    }
                    for answer in attempt.answers.all()
                ],
            }
            for attempt in attempts
        ],
        "practice_answers": [
            {
                "question": item.question_text,
                "topic": item.topic,
                "created_at": item.created_at.isoformat(),
                "transcript": item.transcript,
                "seconds": item.duration_seconds,
                "scores": _scores(item),
                "strengths": item.strengths,
                "tip": item.tip,
                "corrections": item.corrections,
                "recording_file": item.audio.name,
            }
            for item in PracticeAnswer.objects.filter(student=user)
        ],
        "notebook_learned": list(NotebookMark.objects.filter(student=user).values_list("key", flat=True)),
        "notifications": [
            {"title": note.title, "body": note.body, "created_at": note.created_at.isoformat(), "read": note.read_at is not None}
            for note in Notification.objects.filter(user=user)
        ],
    }


# ---------------------------------------------------------------------------
# Deleting an account (by the student, or by an admin)
# ---------------------------------------------------------------------------
def delete_account(user) -> None:
    """Remove the account with its results, practice answers, recordings and profile photo.

    Files are removed only after the database change is saved, so a failed delete never loses anything.
    """
    from apps.attempts.models import Attempt
    from apps.attempts.services import delete_attempts
    from apps.learning.models import PracticeAnswer

    with transaction.atomic():
        delete_attempts(Attempt.objects.filter(student=user))
        practice = PracticeAnswer.objects.filter(student=user)
        practice_storage = PracticeAnswer._meta.get_field("audio").storage
        names = [name for name in practice.values_list("audio", flat=True) if name]
        avatar_name, avatar_storage = user.avatar.name, user.avatar.storage
        sign_out_everywhere(user)
        user.delete()  # practice answers, notebook marks, notifications and sign-ins go with it

        def remove_files():
            for name in names:
                _delete_file(practice_storage, name)
            if avatar_name:
                _delete_file(avatar_storage, avatar_name)

        transaction.on_commit(remove_files)
