import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import DetailsTab from '../../components/profile/DetailsTab';
import GoalsTab from '../../components/profile/GoalsTab';
import OverviewTab from '../../components/profile/OverviewTab';
import PhotoCropper from '../../components/profile/PhotoCropper';
import ProfileHero from '../../components/profile/ProfileHero';
import SecurityTab from '../../components/profile/SecurityTab';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { getProfileSummary, removeAvatar, updateMe, uploadAvatar } from '../../services/authService';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_MB = 15; // the cropper shrinks it to about 50 KB before upload

const TAB_LABELS = { overview: 'Overview', details: 'Details', goals: 'Goals', security: 'Security' };
const FOCUS_FOR_STEP = {
  name: 'profile-full_name',
  bio: 'profile-bio',
  purpose: 'goal-purpose',
  goals: 'goal-weekly-1',
  password: 'password-current',
};

const detailsFrom = (user) => ({ full_name: user.full_name || '', phone: user.phone || '', bio: user.bio || '' });
const goalsFrom = (user) => ({
  purpose: user.purpose || '',
  level: user.level || 'beginner',
  weekly_goal: user.weekly_goal ?? null,
  target_score: user.target_score ?? null,
});

/** Only the fields that changed, so untouched values are never re-checked or overwritten. */
function changes(form, saved) {
  return Object.fromEntries(Object.entries(form).filter(([key, value]) => value !== saved[key]));
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Profile page for students and admins: hero, then Overview, Details, Goals (students) and Security tabs. */
const SIGNED_OUT = { role: '', full_name: '', email: '' }; // for the moment between deleting the account and leaving

export default function StudentProfile() {
  const { user: signedInUser, setUser } = useAuth();
  const user = signedInUser || SIGNED_OUT;
  const navigate = useNavigate();
  const isStudent = user.role === 'student';
  const tabs = isStudent ? ['overview', 'details', 'goals', 'security'] : ['overview', 'details', 'security'];
  const [params, setParams] = useSearchParams();
  const tab = tabs.includes(params.get('tab')) ? params.get('tab') : 'overview';

  // Profile summary (strength, numbers, achievements, sign-ins)
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const lastPercent = useRef(null);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getProfileSummary();
      if (lastPercent.current !== null && lastPercent.current < 100 && data.strength.percent >= 100) setCelebrate(true);
      lastPercent.current = data.strength.percent;
      setSummary(data);
      setSummaryError('');
    } catch (error) {
      setSummaryError(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Page-level messages (photo saved, and so on)
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  const showNotice = useCallback((tone, text) => {
    clearTimeout(noticeTimer.current);
    setNotice({ tone, text });
    if (tone === 'success') noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // Tabs, and moving focus to a field when a shortcut leads there
  const pendingFocus = useRef(null);
  const tabRefs = useRef({});
  const goTo = useCallback(
    (nextTab, focusId) => {
      pendingFocus.current = focusId || null;
      setParams(nextTab === 'overview' ? {} : { tab: nextTab }, { replace: true });
    },
    [setParams],
  );
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return undefined;
    pendingFocus.current = null;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (!element) return;
      element.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      element.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab]);

  const handleTabKey = (event) => {
    const index = tabs.indexOf(event.currentTarget.dataset.tab);
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
    goTo(next);
    tabRefs.current[next]?.focus();
  };

  // Details form
  const [details, setDetails] = useState(() => detailsFrom(user));
  const [detailsErrors, setDetailsErrors] = useState({});
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const detailsChanges = changes(details, detailsFrom(user));
  const detailsDirty = Object.keys(detailsChanges).length > 0;

  // Goals form
  const [goals, setGoals] = useState(() => goalsFrom(user));
  const [goalsErrors, setGoalsErrors] = useState({});
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [goalsSaved, setGoalsSaved] = useState(false);
  const goalsChanges = changes(goals, goalsFrom(user));
  const goalsDirty = Object.keys(goalsChanges).length > 0;

  // Ask before leaving the site with unsaved changes.
  useEffect(() => {
    if (!detailsDirty && !goalsDirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [detailsDirty, goalsDirty]);

  const saveDetails = async (event) => {
    event.preventDefault();
    const found = {};
    if (details.full_name.trim().length < 2) found.full_name = 'Enter your full name.';
    if (details.phone.trim() && !/^[0-9+()\-. ]{6,30}$/.test(details.phone.trim())) found.phone = 'Use digits, spaces and + ( ) - only.';
    setDetailsErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`profile-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setDetailsSaving(true);
    try {
      const updated = await updateMe(detailsChanges);
      setUser(updated);
      setDetails(detailsFrom(updated));
      setDetailsSaved(true);
      loadSummary();
    } catch (error) {
      setDetailsErrors(getFieldErrors(error));
      showNotice('danger', getErrorMessage(error));
    } finally {
      setDetailsSaving(false);
    }
  };

  const saveGoals = async (event) => {
    event.preventDefault();
    setGoalsSaving(true);
    try {
      const updated = await updateMe(goalsChanges);
      setUser(updated);
      setGoals(goalsFrom(updated));
      setGoalsSaved(true);
      loadSummary();
    } catch (error) {
      setGoalsErrors(getFieldErrors(error));
      showNotice('danger', getErrorMessage(error));
    } finally {
      setGoalsSaving(false);
    }
  };

  // Review emails switch: saves straight away, like a phone setting.
  const [emailSaving, setEmailSaving] = useState(false);
  const toggleEmail = async (checked) => {
    setEmailSaving(true);
    setUser({ ...user, email_updates: checked });
    try {
      const updated = await updateMe({ email_updates: checked });
      setUser(updated);
      showNotice('success', checked ? 'Review emails are on.' : 'Review emails are off. Reviews still appear in Notifications.');
    } catch (error) {
      setUser({ ...user, email_updates: !checked });
      showNotice('danger', getErrorMessage(error));
    } finally {
      setEmailSaving(false);
    }
  };

  // Profile photo: choose (or drop) → crop → upload
  const fileInput = useRef(null);
  const [photo, setPhoto] = useState(null); // { file, key }
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const openPhoto = (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      showNotice('danger', 'Choose a JPG, PNG or WebP photo.');
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      showNotice('danger', `That photo is over ${MAX_PHOTO_MB} MB. Choose a smaller one.`);
      return;
    }
    setPhotoError('');
    setPhoto({ file, key: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}` });
  };
  const choosePhoto = () => fileInput.current?.click();

  const savePhoto = async (blob) => {
    setPhotoSaving(true);
    setPhotoError('');
    try {
      const updated = await uploadAvatar(blob);
      setUser(updated);
      setPhoto(null);
      showNotice('success', 'Your new photo is saved.');
      loadSummary();
    } catch (error) {
      setPhotoError(getErrorMessage(error));
    } finally {
      setPhotoSaving(false);
    }
  };

  const [removingPhoto, setRemovingPhoto] = useState(false);
  const deletePhoto = async () => {
    setRemovingPhoto(true);
    try {
      const updated = await removeAvatar();
      setUser(updated);
      showNotice('success', 'Your photo was removed. Your initials show instead.');
      loadSummary();
    } catch (error) {
      showNotice('danger', getErrorMessage(error));
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleStep = (step) => {
    if (step.action === 'photo') choosePhoto();
    else if (step.action === 'tests') navigate('/student');
    else goTo(step.action, FOCUS_FOR_STEP[step.key]);
  };

  const handleDeleted = () => {
    // One update: the sign-in page (with this message) and the signed-out state arrive together.
    startTransition(() => {
      navigate('/login', { replace: true, state: { notice: 'Your account and everything in it have been deleted.' } });
      setUser(null);
    });
  };

  const unsaved = { details: detailsDirty, goals: goalsDirty };
  if (!signedInUser) return null;

  return (
    <>
      <ProfileHero
        user={user}
        summary={summary}
        uploading={photoSaving || removingPhoto}
        onChoosePhoto={choosePhoto}
        onRemovePhoto={deletePhoto}
        onDropPhoto={openPhoto}
        onEdit={(field) => goTo('details', `profile-${field}`)}
      />
      <input
        ref={fileInput}
        type="file"
        accept={PHOTO_TYPES.join(',')}
        hidden
        onChange={(event) => {
          openPhoto(event.target.files?.[0]);
          event.target.value = ''; // so the same file can be chosen again
        }}
      />

      {notice && (
        <Alert tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <div className="vmt-profile-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map((name) => (
          <button
            key={name}
            ref={(element) => {
              tabRefs.current[name] = element;
            }}
            type="button"
            role="tab"
            id={`profile-tab-${name}`}
            data-tab={name}
            aria-selected={tab === name}
            aria-controls={`profile-panel-${name}`}
            tabIndex={tab === name ? 0 : -1}
            className={`vmt-profile-tab${tab === name ? ' is-active' : ''}`}
            onClick={() => goTo(name)}
            onKeyDown={handleTabKey}
          >
            {TAB_LABELS[name]}
            {unsaved[name] && <span className="vmt-tab-dot" aria-label="(unsaved changes)" />}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} className="vmt-profile-panel">
        {tab === 'overview' &&
          (summary ? (
            <OverviewTab
              isStudent={isStudent}
              summary={summary}
              celebrate={celebrate}
              onDismissCelebrate={() => setCelebrate(false)}
              onStep={handleStep}
              onGoTo={goTo}
            />
          ) : summaryError ? (
            <Alert tone="danger" title="We couldn't load your profile summary">
              {summaryError}{' '}
              <button type="button" className="vmt-link vmt-link-button" onClick={loadSummary}>
                Try again
              </button>
            </Alert>
          ) : (
            <LoadingSpinner label="Loading your profile…" />
          ))}

        {tab === 'details' && (
          <DetailsTab
            user={user}
            form={details}
            errors={detailsErrors}
            dirty={detailsDirty}
            saving={detailsSaving}
            saved={detailsSaved}
            onChange={(change) => {
              setDetails((current) => ({ ...current, ...change }));
              setDetailsErrors((current) => ({ ...current, ...Object.fromEntries(Object.keys(change).map((key) => [key, undefined])) }));
              setDetailsSaved(false);
            }}
            onSubmit={saveDetails}
            onDiscard={() => {
              setDetails(detailsFrom(user));
              setDetailsErrors({});
            }}
            photoBusy={photoSaving || removingPhoto}
            onChoosePhoto={choosePhoto}
            onRemovePhoto={deletePhoto}
            onDropPhoto={openPhoto}
            emailSaving={emailSaving}
            onToggleEmail={toggleEmail}
          />
        )}

        {tab === 'goals' && isStudent && (
          <GoalsTab
            form={goals}
            errors={goalsErrors}
            dirty={goalsDirty}
            saving={goalsSaving}
            saved={goalsSaved}
            average={summary ? summary.target.recent ?? summary.target.average : null}
            onChange={(change) => {
              setGoals((current) => ({ ...current, ...change }));
              setGoalsErrors({});
              setGoalsSaved(false);
            }}
            onSubmit={saveGoals}
            onDiscard={() => {
              setGoals(goalsFrom(user));
              setGoalsErrors({});
            }}
          />
        )}

        {tab === 'security' && <SecurityTab user={user} summary={summary} onChanged={loadSummary} onDeleted={handleDeleted} />}
      </div>

      {photo && (
        <PhotoCropper
          key={photo.key}
          file={photo.file}
          saving={photoSaving}
          error={photoError}
          onCancel={() => setPhoto(null)}
          onSave={savePhoto}
        />
      )}
    </>
  );
}
