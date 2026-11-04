import { useState } from 'react';
import { BookOpenCheck, Check, ClipboardCheck, Flame, Lock, Mic, Scale, Trophy, Zap } from 'lucide-react';

const ICONS = { tests: ClipboardCheck, streak: Flame, score: Trophy, practice: Zap, minutes: Mic, notebook: BookOpenCheck, balanced: Scale };

function amount(value, unit) {
  if (unit[0] === '%') return `${value}%`;
  return `${value} ${value === 1 ? unit[0] : unit[1]}`;
}

function progressText(badge) {
  if (badge.next_goal === null) return 'Every level reached';
  if (badge.unit[0] === '%') return badge.value ? `${badge.value}% / ${badge.next_goal}%` : `No score yet · goal ${badge.next_goal}%`;
  return `${badge.value} / ${amount(badge.next_goal, badge.unit)}`;
}

function Badge({ badge, open, onToggle, index }) {
  const Icon = ICONS[badge.key] || Trophy;
  const locked = badge.level === 0;
  const share = badge.next_goal === null ? 1 : Math.min(1, badge.value / badge.next_goal);
  const detailId = `badge-${badge.key}-levels`;

  return (
    <li className={`vmt-achievement is-level-${badge.level}${open ? ' is-open' : ''}`} style={{ '--d': `${index * 60}ms` }}>
      <button type="button" className="vmt-achievement-main" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className="vmt-medal" aria-hidden="true">
          <Icon className="vmt-icon-lg" />
          {locked && (
            <span className="vmt-medal-lock">
              <Lock className="vmt-icon-sm" />
            </span>
          )}
        </span>
        <span className="vmt-achievement-text">
          <span className="title-sm">{badge.title}</span>
          <span className="vmt-pips" role="img" aria-label={`Level ${badge.level} of ${badge.max_level}`}>
            {Array.from({ length: badge.max_level }, (_, step) => (
              <span key={step} className={step < badge.level ? 'is-on' : ''} aria-hidden="true" />
            ))}
          </span>
        </span>
      </button>
      <div className="vmt-bar" aria-hidden="true">
        <div className="vmt-bar-fill" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <span className="caption vmt-muted vmt-num">
        <strong className="vmt-achievement-level">{locked ? 'Not started' : `Level ${badge.level}`}</strong> · {progressText(badge)}
      </span>

      <div id={detailId} className="vmt-achievement-detail" hidden={!open}>
        <p className="body-sm">{badge.description}</p>
        <ol className="vmt-levels">
          {badge.goals.map((goal, step) => (
            <li key={goal} className={step < badge.level ? 'is-done' : ''}>
              <span className="vmt-levels-mark" aria-hidden="true">
                {step < badge.level ? <Check className="vmt-icon-sm" /> : step + 1}
              </span>
              <span>
                Level {step + 1}: {amount(goal, badge.unit)}
                <span className="sr-only">{step < badge.level ? ' (reached)' : ' (not yet)'}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </li>
  );
}

/** Badges with four levels each, like trophies on a shelf. Tap one to see every level. */
export default function Achievements({ items, levelsEarned, levelsTotal }) {
  const [openKey, setOpenKey] = useState(null);
  return (
    <section className="vmt-card" aria-labelledby="achievements-title">
      <div className="vmt-card-head">
        <div className="vmt-stack vmt-stack-sm">
          <h2 id="achievements-title" className="title-md">
            Achievements
          </h2>
          <p className="body-sm vmt-muted">Earn levels by practising. Select a badge to see what each level needs.</p>
        </div>
        <span className="vmt-chip vmt-num">
          {levelsEarned} of {levelsTotal} levels
        </span>
      </div>
      <ul className="vmt-achievements">
        {items.map((badge, index) => (
          <Badge
            key={badge.key}
            badge={badge}
            index={index}
            open={openKey === badge.key}
            onToggle={() => setOpenKey((current) => (current === badge.key ? null : badge.key))}
          />
        ))}
      </ul>
    </section>
  );
}
