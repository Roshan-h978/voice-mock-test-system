import { Briefcase, Building2, Globe2, GraduationCap, Handshake, MessageCircle, PenTool, Sparkles } from 'lucide-react';
import { LEVELS, PURPOSES } from '../../utils/constants';
import SaveBar from './SaveBar';

const PURPOSE_ICONS = {
  general: MessageCircle,
  ielts: GraduationCap,
  toefl: PenTool,
  pte: Sparkles,
  interview: Handshake,
  study: Globe2,
  work: Briefcase,
};
const LEVEL_TEXT = {
  beginner: 'Short, simple answers',
  intermediate: 'Everyday topics with some detail',
  advanced: 'Longer answers and opinions',
};

function paceFor(days) {
  if (!days) return 'Choose the days you can really manage. You can change it any time.';
  if (days <= 2) return 'Casual: a steady start that fits a busy week.';
  if (days <= 4) return 'Regular: enough to keep improving week by week.';
  if (days <= 6) return 'Serious: great for an exam that is coming up.';
  return 'Every day: the fastest way to build a streak.';
}

/** Students: what they practise for, their level, a weekly goal and a target score. */
export default function GoalsTab({ form, errors, dirty, saving, saved, average, onChange, onSubmit, onDiscard }) {
  const target = form.target_score ?? 70;
  return (
    <form className="vmt-card vmt-form vmt-goals-form" onSubmit={onSubmit} noValidate aria-labelledby="goals-title">
      <div className="vmt-stack vmt-stack-sm">
        <h2 id="goals-title" className="title-md">
          Learning goals
        </h2>
        <p className="body-sm vmt-muted">Your goals shape the Overview: this week&apos;s days, your target and what to work on next.</p>
      </div>

      <fieldset className="vmt-fieldset">
        <legend className="vmt-label">What are you practising for?</legend>
        <div className="vmt-option-grid">
          {PURPOSES.map((item, index) => {
            const Icon = PURPOSE_ICONS[item.value] || Building2;
            return (
              <label key={item.value} className="vmt-option">
                <input
                  id={index === 0 ? 'goal-purpose' : undefined}
                  type="radio"
                  name="purpose"
                  value={item.value}
                  checked={form.purpose === item.value}
                  onChange={() => onChange({ purpose: item.value })}
                />
                <span className="vmt-option-box">
                  <Icon className="vmt-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.purpose && <span className="vmt-error">{errors.purpose}</span>}
      </fieldset>

      <fieldset className="vmt-fieldset">
        <legend className="vmt-label">Your English level</legend>
        <div className="vmt-segmented vmt-segmented-3">
          {LEVELS.map((level) => (
            <label key={level.value} className="vmt-segment">
              <input
                type="radio"
                name="level"
                value={level.value}
                checked={form.level === level.value}
                onChange={() => onChange({ level: level.value })}
              />
              <span className="vmt-segment-box">
                <span className="label">{level.label}</span>
                <span className="caption">{LEVEL_TEXT[level.value]}</span>
              </span>
            </label>
          ))}
        </div>
        <span className="vmt-help">Your teacher may use this to choose tests for you.</span>
      </fieldset>

      <fieldset className="vmt-fieldset">
        <legend className="vmt-label">Weekly goal: days of practice</legend>
        <div className="vmt-segmented vmt-segmented-7">
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <label key={days} className="vmt-segment">
              <input
                id={`goal-weekly-${days}`}
                type="radio"
                name="weekly_goal"
                value={days}
                checked={form.weekly_goal === days}
                onChange={() => onChange({ weekly_goal: days })}
                aria-label={`${days} ${days === 1 ? 'day' : 'days'} a week`}
              />
              <span className="vmt-segment-box vmt-segment-num">
                <span className="title-sm vmt-num">{days}</span>
              </span>
            </label>
          ))}
        </div>
        <span className="vmt-help" aria-live="polite">
          {paceFor(form.weekly_goal)}
        </span>
        {errors.weekly_goal && <span className="vmt-error">{errors.weekly_goal}</span>}
      </fieldset>

      <fieldset className="vmt-fieldset">
        <legend className="vmt-label">Target score</legend>
        <div className="vmt-target-picker">
          <span className="vmt-target-value vmt-num" aria-hidden="true">
            {form.target_score === null ? '—' : `${form.target_score}%`}
          </span>
          <div className="vmt-target-slider">
            <input
              id="goal-target"
              type="range"
              className="vmt-range"
              min="40"
              max="100"
              step="5"
              value={target}
              onChange={(event) => onChange({ target_score: Number(event.target.value) })}
              aria-label="Target score"
              aria-valuetext={form.target_score === null ? 'Not set' : `${form.target_score} percent`}
              style={{ '--fill': `${((target - 40) / 60) * 100}%` }}
            />
            {average !== null && average !== undefined && average >= 40 && (
              <span className="vmt-target-now" style={{ left: `calc(12px + (100% - 24px) * ${(Math.min(average, 100) - 40) / 60})` }} aria-hidden="true">
                <span>You: {average}%</span>
              </span>
            )}
            <div className="vmt-columns-axis" aria-hidden="true">
              <span>40</span>
              <span>70</span>
              <span>100</span>
            </div>
          </div>
        </div>
        <span className="vmt-help">
          {average !== null && average !== undefined
            ? `Your recent average is ${average}%. A target 5 to 10 points higher is a good next step.`
            : 'Most students start by aiming for 70%.'}
        </span>
        {errors.target_score && <span className="vmt-error">{errors.target_score}</span>}
      </fieldset>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onDiscard={onDiscard} label="Save goals" />
    </form>
  );
}
