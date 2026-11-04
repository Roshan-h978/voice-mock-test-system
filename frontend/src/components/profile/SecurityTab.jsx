import { useState } from 'react';
import { Download, KeyRound, LaptopMinimal, LogOut, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { changePassword, deleteAccount, downloadMyData, signOutOtherDevices } from '../../services/authService';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { formatDateTime, pluralize, timeAgo } from '../../utils/formatters';
import Alert from '../Alert';
import Button from '../Button';
import Modal from '../Modal';
import TextField from '../TextField';
import PasswordMeter from './PasswordMeter';

const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' };

function PasswordCard({ user, onChanged }) {
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!user.has_password) {
    return (
      <section className="vmt-card vmt-stack" aria-labelledby="password-title">
        <h2 id="password-title" className="title-md">
          Password
        </h2>
        <Alert tone="info" title="You sign in with Google">
          Your account has no password yet. To add one, sign out and choose &quot;Forgot password?&quot; on the sign-in page.
        </Alert>
      </section>
    );
  }

  const update = (field) => (event) => {
    setPasswords((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    const found = {};
    if (!passwords.current) found.current = 'Enter your current password.';
    if (passwords.next.length < 8) found.next = 'Use at least 8 characters.';
    else if (passwords.next === passwords.current) found.next = 'Choose a password different from your current one.';
    if (passwords.confirm !== passwords.next) found.confirm = 'The passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`password-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const data = await changePassword(passwords.current, passwords.next, signOutOthers);
      setPasswords(EMPTY_PASSWORDS);
      setMessage({ tone: 'success', text: data.detail });
      onChanged();
    } catch (error) {
      const fields = getFieldErrors(error);
      setErrors({ current: fields.current_password, next: fields.new_password });
      setMessage({ tone: 'danger', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const matches = passwords.confirm && passwords.confirm === passwords.next;

  return (
    <form className="vmt-card vmt-form" onSubmit={submit} noValidate aria-labelledby="password-title">
      <div className="vmt-row vmt-row-tight">
        <span className="vmt-stat-icon" aria-hidden="true">
          <KeyRound className="vmt-icon" />
        </span>
        <h2 id="password-title" className="title-md">
          Change password
        </h2>
      </div>
      {user.uses_default_password && (
        <Alert tone="warning" title="Choose your own password">
          {user.role === 'admin'
            ? 'This account still uses the starting password from setup. Change it before you share the site.'
            : 'Your teacher set your current password. Change it to one only you know.'}
        </Alert>
      )}
      {message && (
        <Alert tone={message.tone} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      <TextField
        id="password-current"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={passwords.current}
        onChange={update('current')}
        error={errors.current}
      />
      <TextField
        id="password-next"
        label="New password"
        type="password"
        autoComplete="new-password"
        value={passwords.next}
        onChange={update('next')}
        error={errors.next}
        aria-describedby="password-meter"
      />
      <PasswordMeter id="password-meter" password={passwords.next} name={user.full_name} email={user.email} />
      <TextField
        id="password-confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={passwords.confirm}
        onChange={update('confirm')}
        error={errors.confirm}
        help={matches ? '✓ The passwords match' : undefined}
      />
      <label className="vmt-check">
        <input type="checkbox" checked={signOutOthers} onChange={(event) => setSignOutOthers(event.target.checked)} />
        Also sign out of my other browsers and devices
      </label>
      <div>
        <Button type="submit" loading={saving} icon={ShieldCheck}>
          Change password
        </Button>
      </div>
    </form>
  );
}

function SignInsCard({ signIns, onSignedOut }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const others = Math.max(0, signIns.active - 1);

  const signOut = async () => {
    setBusy(true);
    try {
      const data = await signOutOtherDevices();
      setMessage({ tone: 'success', text: data.detail });
      setConfirming(false);
      onSignedOut();
    } catch (error) {
      setMessage({ tone: 'danger', text: getErrorMessage(error) });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="vmt-card vmt-stack" aria-labelledby="signins-title">
      <div className="vmt-row vmt-row-tight">
        <span className="vmt-stat-icon" aria-hidden="true">
          <LaptopMinimal className="vmt-icon" />
        </span>
        <h2 id="signins-title" className="title-md">
          Where you&apos;re signed in
        </h2>
      </div>
      {message && (
        <Alert tone={message.tone} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      <dl className="vmt-facts">
        <div>
          <dt>Signed in on</dt>
          <dd className="vmt-num">
            {pluralize(Math.max(1, signIns.active), 'browser or device', 'browsers or devices')}
            {others > 0 ? ` (this one and ${others} more)` : ' (just this one)'}
          </dd>
        </div>
        <div>
          <dt>Last sign-in</dt>
          <dd>{signIns.last_login ? `${formatDateTime(signIns.last_login)} (${timeAgo(signIns.last_login)})` : '—'}</dd>
        </div>
      </dl>
      <p className="caption vmt-muted">
        Don&apos;t recognise a sign-in, or used a shared computer? Sign out everywhere else, then change your password.
      </p>
      <div>
        <Button variant="secondary" icon={LogOut} onClick={() => setConfirming(true)} disabled={others === 0}>
          Sign out of other devices
        </Button>
      </div>
      <Modal
        open={confirming}
        title="Sign out of other devices?"
        description="Every other browser and device signed in to your account will be signed out within half an hour. You stay signed in here."
        onClose={busy ? undefined : () => setConfirming(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={signOut} loading={busy} icon={LogOut}>
              Sign them out
            </Button>
          </>
        }
      />
    </section>
  );
}

function DataCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      await downloadMyData();
    } catch (failure) {
      setError(getErrorMessage(failure, "We couldn't prepare your data. Please try again in a few minutes."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="vmt-card vmt-stack" aria-labelledby="data-title">
      <div className="vmt-row vmt-row-tight">
        <span className="vmt-stat-icon" aria-hidden="true">
          <Download className="vmt-icon" />
        </span>
        <h2 id="data-title" className="title-md">
          Your data
        </h2>
      </div>
      <p className="body-sm vmt-muted">
        Download a copy of your account, results, transcripts, feedback and notifications as a JSON file you can keep or open in
        any text editor.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Button variant="secondary" icon={Download} onClick={download} loading={busy}>
          Download my data
        </Button>
      </div>
    </section>
  );
}

function DeleteAccountCard({ user, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setPassword('');
    setEmail('');
    setUnderstood(false);
    setErrors({});
    setError('');
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteAccount(user.has_password ? { password } : { confirm_email: email });
      onDeleted();
    } catch (failure) {
      const fields = getFieldErrors(failure);
      setErrors(fields);
      if (!fields.password && !fields.confirm_email) setError(getErrorMessage(failure));
      setBusy(false);
    }
  };

  const ready = understood && (user.has_password ? password : email);

  return (
    <section className="vmt-card vmt-danger-zone" aria-labelledby="delete-title">
      <div className="vmt-stack vmt-stack-sm">
        <div className="vmt-row vmt-row-tight">
          <ShieldAlert className="vmt-icon" aria-hidden="true" />
          <h2 id="delete-title" className="title-md">
            Delete my account
          </h2>
        </div>
        <p className="body-sm">
          Permanently removes your account, every test result, practice answer, recording and your profile photo. This can&apos;t be
          undone. Download your data first if you want a copy.
        </p>
      </div>
      <div>
        <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </div>
      <Modal
        open={open}
        title="Delete your account?"
        description="Everything below is removed straight away and can't be brought back."
        onClose={busy ? undefined : close}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Keep my account
            </Button>
            <Button variant="danger" icon={Trash2} onClick={confirm} loading={busy} disabled={!ready}>
              Delete for good
            </Button>
          </>
        }
      >
        <ul className="vmt-delete-list">
          <li>Your account and profile ({user.email})</li>
          <li>All test results, scores, feedback and recordings</li>
          <li>Quick practice answers and your Mistakes notebook</li>
          <li>Your profile photo and notifications</li>
        </ul>
        {error && <Alert tone="danger">{error}</Alert>}
        {user.has_password ? (
          <TextField
            label="Enter your password to confirm"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
        ) : (
          <TextField
            label={`Type your email address (${user.email}) to confirm`}
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.confirm_email}
          />
        )}
        <label className="vmt-check">
          <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />I understand this
          can&apos;t be undone
        </label>
      </Modal>
    </section>
  );
}

/** Password, sign-ins, "Download my data" and (students) deleting the account. */
export default function SecurityTab({ user, summary, onChanged, onDeleted }) {
  const { refreshUser } = useAuth();
  const isStudent = user.role === 'student';
  return (
    <div className="vmt-stack vmt-stack-lg">
      <div className="vmt-security-grid">
        <PasswordCard
          user={user}
          onChanged={() => {
            refreshUser().catch(() => {});
            onChanged();
          }}
        />
        <div className="vmt-stack vmt-stack-lg">
          {summary && <SignInsCard signIns={summary.sign_ins} onSignedOut={onChanged} />}
          <DataCard />
        </div>
      </div>
      {isStudent ? (
        <DeleteAccountCard user={user} onDeleted={onDeleted} />
      ) : (
        <p className="caption vmt-muted">Admin accounts can only be removed by another admin, from the Students page.</p>
      )}
    </div>
  );
}
