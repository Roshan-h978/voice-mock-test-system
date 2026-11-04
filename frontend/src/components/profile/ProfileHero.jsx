import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Camera, ClipboardList, Clock, Flame, ImagePlus, Mail, Medal, PenLine, Target, Trash2, Users } from 'lucide-react';
import { useCountUp } from '../../hooks/useMotion';
import { PURPOSES } from '../../utils/constants';
import { levelLabel, timeAgo } from '../../utils/formatters';
import Avatar from '../Avatar';
import Button from '../Button';
import { SoundRings } from '../Shapes';

const RING_RADIUS = 66;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const joinedFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

function QuickStat({ icon: Icon, value, label, progress, suffix = '' }) {
  const shown = value === null || value === undefined ? '—' : `${Math.round(value * progress)}${suffix}`;
  return (
    <div className="vmt-hero-stat">
      <Icon className="vmt-icon" aria-hidden="true" />
      <span className="vmt-hero-stat-value vmt-num">{shown}</span>
      <span className="vmt-hero-stat-label">{label}</span>
    </div>
  );
}

/** Three headline numbers that count up once the summary has loaded. */
function HeroStats({ isStudent, summary }) {
  const progress = useCountUp({ duration: 1000, delay: 100 });
  const stats = summary?.stats || {};
  const value = (key) => (summary ? stats[key] : null);
  return (
    <div className="vmt-hero-stats">
      {isStudent ? (
        <>
          <QuickStat icon={Flame} value={value('current_streak')} label="day streak" progress={progress} />
          <QuickStat
            icon={Medal}
            value={summary ? summary.badges_earned : null}
            label="badges"
            progress={progress}
            suffix={summary ? `/${summary.achievements.length}` : ''}
          />
          <QuickStat icon={Target} value={value('average_score')} label="average" progress={progress} suffix="%" />
        </>
      ) : (
        <>
          <QuickStat icon={ClipboardList} value={value('tests_created')} label="tests made" progress={progress} />
          <QuickStat icon={Medal} value={value('reviews_published')} label="reviews" progress={progress} />
          <QuickStat icon={Users} value={value('active_students')} label="students" progress={progress} />
        </>
      )}
    </div>
  );
}

/**
 * Top of the Profile page: photo (with the profile-strength ring around it), name, bio, a few facts and
 * three headline numbers. The photo button opens the file picker, or a small menu when there is a photo.
 */
export default function ProfileHero({ user, summary, uploading, onChoosePhoto, onRemovePhoto, onDropPhoto, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const menuRef = useRef(null);
  const isStudent = user.role === 'student';
  const percent = summary?.strength?.percent ?? 0;
  const purpose = PURPOSES.find((item) => item.value === user.purpose)?.label;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const handlePhotoButton = () => {
    if (user.avatar_url) setMenuOpen((open) => !open);
    else onChoosePhoto();
  };

  const dropProps = {
    onDragOver: (event) => {
      if (![...event.dataTransfer.types].includes('Files')) return;
      event.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (event) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onDropPhoto(file);
    },
  };

  return (
    <section className="vmt-profile-hero" aria-labelledby="profile-name">
      <div className="vmt-profile-geo" aria-hidden="true">
        <SoundRings className="vmt-profile-rings" />
        <span className="vmt-dots vmt-profile-dots" />
      </div>

      <div className="vmt-profile-hero-inner">
        <div className={`vmt-profile-photo${dragOver ? ' is-drop' : ''}`} {...dropProps}>
          <svg className="vmt-strength-ring" viewBox="0 0 148 148" aria-hidden="true">
            <circle className="vmt-strength-ring-track" cx="74" cy="74" r={RING_RADIUS} />
            <circle
              className={`vmt-strength-ring-fill${percent ? '' : ' is-empty'}`}
              cx="74"
              cy="74"
              r={RING_RADIUS}
              strokeDasharray={`${(RING_LENGTH * percent) / 100} ${RING_LENGTH}`}
            />
          </svg>
          <Avatar user={user} size="xl" />
          {uploading && <span className="vmt-profile-photo-busy" role="status" aria-label="Saving your photo" />}
          <div className="vmt-photo-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="vmt-photo-btn"
              onClick={handlePhotoButton}
              aria-label={user.avatar_url ? 'Change or remove profile photo' : 'Add a profile photo'}
              aria-haspopup={user.avatar_url ? 'menu' : undefined}
              aria-expanded={user.avatar_url ? menuOpen : undefined}
              disabled={uploading}
            >
              <Camera className="vmt-icon-sm" aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="vmt-photo-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onChoosePhoto();
                  }}
                >
                  <ImagePlus className="vmt-icon-sm" aria-hidden="true" /> Upload a new photo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemovePhoto();
                  }}
                >
                  <Trash2 className="vmt-icon-sm" aria-hidden="true" /> Remove photo
                </button>
              </div>
            )}
          </div>
          <span className="vmt-strength-tag" title="Profile strength">
            {summary ? `${percent}% complete` : 'Profile'}
          </span>
        </div>

        <div className="vmt-profile-id">
          <span className="overline">
            {isStudent ? 'Student' : 'Admin'}
            {isStudent && user.level ? ` · ${levelLabel(user.level)}` : ''}
          </span>
          <h1 id="profile-name" className="vmt-profile-name">
            {user.full_name}
          </h1>
          {user.bio ? (
            <p className="vmt-profile-bio">{user.bio}</p>
          ) : (
            <button type="button" className="vmt-profile-bio-empty" onClick={() => onEdit('bio')}>
              <PenLine className="vmt-icon-sm" aria-hidden="true" />
              {isStudent ? 'Add a short bio: who you are and what you want to improve' : 'Add a short bio, for example your teaching role'}
            </button>
          )}
          <ul className="vmt-profile-facts">
            <li>
              <Mail className="vmt-icon-sm" aria-hidden="true" />
              <span>{user.email}</span>
            </li>
            {isStudent && purpose && (
              <li>
                <Target className="vmt-icon-sm" aria-hidden="true" />
                <span>{purpose}</span>
              </li>
            )}
            <li>
              <CalendarDays className="vmt-icon-sm" aria-hidden="true" />
              <span>Joined {joinedFormat.format(new Date(user.date_joined))}</span>
            </li>
            {user.last_login && (
              <li>
                <Clock className="vmt-icon-sm" aria-hidden="true" />
                <span>Signed in {timeAgo(user.last_login)}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="vmt-profile-side">
          <HeroStats key={summary ? 'ready' : 'loading'} isStudent={isStudent} summary={summary} />
          <Button variant="on-navy" size="sm" icon={PenLine} onClick={() => onEdit('full_name')}>
            Edit profile
          </Button>
        </div>
      </div>
    </section>
  );
}
