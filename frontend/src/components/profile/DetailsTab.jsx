import { useState } from 'react';
import { ImagePlus, Mail, Trash2 } from 'lucide-react';
import Avatar from '../Avatar';
import Button from '../Button';
import TextField from '../TextField';
import SaveBar from './SaveBar';

const BIO_MAX = 160;

/** Photo, name, phone and bio (and, for students, the review email switch). */
export default function DetailsTab({
  user,
  form,
  errors,
  dirty,
  saving,
  saved,
  onChange,
  onSubmit,
  onDiscard,
  photoBusy,
  onChoosePhoto,
  onRemovePhoto,
  onDropPhoto,
  emailSaving,
  onToggleEmail,
}) {
  const [dragOver, setDragOver] = useState(false);
  const isStudent = user.role === 'student';
  const bioLeft = BIO_MAX - form.bio.length;

  return (
    <div className="vmt-profile-layout">
      <div className="vmt-profile-col">
        <section className="vmt-card vmt-stack" aria-labelledby="photo-title">
          <h2 id="photo-title" className="title-md">
            Profile photo
          </h2>
          <div
            className={`vmt-dropzone${dragOver ? ' is-over' : ''}`}
            onDragOver={(event) => {
              if (![...event.dataTransfer.types].includes('Files')) return;
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) onDropPhoto(file);
            }}
          >
            <Avatar user={user} size="lg" />
            <p className="body-sm vmt-muted">
              Drag a photo here, or choose one. JPG, PNG or WebP. You can move and zoom it before saving.
            </p>
            <div className="vmt-row vmt-row-tight" style={{ justifyContent: 'center' }}>
              <Button size="sm" icon={ImagePlus} onClick={onChoosePhoto} loading={photoBusy}>
                {user.avatar_url ? 'Change photo' : 'Choose a photo'}
              </Button>
              {user.avatar_url && (
                <Button size="sm" variant="ghost" icon={Trash2} onClick={onRemovePhoto} disabled={photoBusy}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          <p className="caption vmt-muted">Your photo is shown to you and your teachers only.</p>
        </section>

        {isStudent && (
          <section className="vmt-card vmt-stack" aria-labelledby="emails-title">
            <h2 id="emails-title" className="title-md">
              Email updates
            </h2>
            <label className="vmt-switch-row" htmlFor="email-updates">
              <span className="vmt-stack vmt-stack-sm">
                <span className="label">Email me when a teacher reviews my test</span>
                <span className="caption vmt-muted">You always see reviews in Notifications, even with emails off.</span>
              </span>
              <span className="vmt-switch">
                <input
                  id="email-updates"
                  type="checkbox"
                  role="switch"
                  checked={user.email_updates}
                  disabled={emailSaving}
                  onChange={(event) => onToggleEmail(event.target.checked)}
                />
                <span className="vmt-switch-track" aria-hidden="true" />
              </span>
            </label>
          </section>
        )}
      </div>

      <div className="vmt-profile-col">
        <form className="vmt-card vmt-form" onSubmit={onSubmit} noValidate aria-labelledby="details-title">
          <div className="vmt-stack vmt-stack-sm">
            <h2 id="details-title" className="title-md">
              Personal details
            </h2>
            <p className="body-sm vmt-muted">This is how you appear to your {isStudent ? 'teachers' : 'students and other admins'}.</p>
          </div>
          <div className="vmt-form-grid">
            <TextField
              id="profile-full_name"
              label="Full name"
              value={form.full_name}
              onChange={(event) => onChange({ full_name: event.target.value })}
              error={errors.full_name}
              autoComplete="name"
              required
              maxLength={150}
            />
            <TextField
              id="profile-phone"
              label="Phone (optional)"
              type="tel"
              value={form.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
              error={errors.phone}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+977 98XXXXXXXX"
              maxLength={30}
            />
            <div className="vmt-field is-wide">
              <span className="vmt-label">Email address</span>
              <div className="vmt-readonly">
                <Mail className="vmt-icon-sm" aria-hidden="true" />
                <span>{user.email}</span>
              </div>
              <span className="vmt-help">This is your sign-in address. Ask an admin if it needs to change.</span>
            </div>
            <div className={`vmt-field is-wide${errors.bio ? ' is-error' : ''}`}>
              <div className="vmt-row vmt-row-between">
                <label className="vmt-label" htmlFor="profile-bio">
                  Short bio (optional)
                </label>
                <span id="profile-bio-count" className={`caption vmt-num ${bioLeft < 20 ? 'vmt-bio-low' : 'vmt-muted'}`}>
                  {bioLeft} characters left
                </span>
              </div>
              <textarea
                id="profile-bio"
                className="vmt-textarea vmt-textarea-sm"
                value={form.bio}
                maxLength={BIO_MAX}
                rows={3}
                onChange={(event) => onChange({ bio: event.target.value })}
                placeholder={
                  isStudent
                    ? 'For example: Nursing student preparing for IELTS. I want to speak more fluently about my work.'
                    : 'For example: English teacher, Grade 11 and 12.'
                }
                aria-describedby={errors.bio ? 'profile-bio-count profile-bio-error' : 'profile-bio-count'}
                aria-invalid={Boolean(errors.bio) || undefined}
              />
              {errors.bio && (
                <span id="profile-bio-error" className="vmt-error">
                  {errors.bio}
                </span>
              )}
            </div>
          </div>
          <SaveBar dirty={dirty} saving={saving} saved={saved} onDiscard={onDiscard} />
        </form>
      </div>
    </div>
  );
}
