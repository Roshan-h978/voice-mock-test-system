import { CalendarCheck, Crosshair, PartyPopper } from 'lucide-react';
import { pluralize } from '../../utils/formatters';
import Button from '../Button';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const RADIUS = 30;
const LENGTH = 2 * Math.PI * RADIUS;

/** This week, Monday to Sunday: which days had practice, against the weekly goal. */
export function WeekGoalCard({ week, onSetGoal }) {
  const goal = week.goal;
  const done = week.active_days;
  const reached = goal && done >= goal;
  const share = goal ? Math.min(1, done / goal) : 0;
  // Days still free to practise this week: the days to come, and today if nothing was done yet.
  const available = week.days.filter((day) => day.is_future || (day.is_today && !day.count)).length;

  let message;
  if (!goal) message = 'Choose how many days a week you want to practise. Tests and Quick practice both count.';
  else if (reached) message = done > goal ? `Goal beaten: ${pluralize(done, 'day')} this week.` : 'Goal reached for this week. Great habit!';
  else {
    const remaining = goal - done;
    message =
      remaining > available
        ? `${pluralize(available, 'practice day')} left this week. Every answer still counts towards your streak.`
        : `${pluralize(remaining, 'more day')} to reach your goal this week.`;
  }

  return (
    <section className={`vmt-card vmt-goal-card${reached ? ' is-reached' : ''}`} aria-labelledby="week-title">
      <div className="vmt-goal-top">
        <div className="vmt-stack vmt-stack-sm">
          <span className="overline vmt-teal">This week</span>
          <h2 id="week-title" className="title-md">
            {goal ? `${done} of ${pluralize(goal, 'day')}` : pluralize(done, 'active day')}
          </h2>
        </div>
        <div className="vmt-goal-ring" role="img" aria-label={goal ? `${done} of ${goal} practice days this week` : `${done} practice days this week`}>
          <svg className="vmt-goal-ring-svg" viewBox="0 0 72 72" aria-hidden="true">
            <circle className="vmt-goal-ring-track" cx="36" cy="36" r={RADIUS} />
            {share > 0 && <circle className="vmt-goal-ring-fill" cx="36" cy="36" r={RADIUS} strokeDasharray={`${LENGTH * share} ${LENGTH}`} />}
          </svg>
          {reached ? <PartyPopper className="vmt-icon" aria-hidden="true" /> : <CalendarCheck className="vmt-icon" aria-hidden="true" />}
        </div>
      </div>

      <ol className="vmt-week" aria-label="Practice days this week">
        {week.days.map((day, index) => {
          const date = new Date(`${day.date}T00:00:00`);
          const state = day.count ? 'practised' : day.is_future ? 'still to come' : 'no practice';
          return (
            <li
              key={day.date}
              className={['vmt-week-day', day.count && 'is-active', day.is_today && 'is-today', day.is_future && 'is-future'].filter(Boolean).join(' ')}
            >
              <span className="vmt-week-dot" aria-hidden="true">
                {day.count ? '✓' : ''}
              </span>
              <span className="vmt-week-letter" aria-hidden="true">
                {DAY_LETTERS[index]}
              </span>
              <span className="sr-only">
                {dayName.format(date)}
                {day.is_today ? ' (today)' : ''}: {state}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="body-sm vmt-muted">{message}</p>
      {!goal && (
        <Button variant="secondary" size="sm" onClick={onSetGoal}>
          Set a weekly goal
        </Button>
      )}
    </section>
  );
}

/** Target score: the recent average on a 0–100 track, with a marker at the target. */
export function TargetCard({ target, onSetTarget }) {
  const goal = target.score;
  const current = target.recent ?? target.average;
  const gap = goal && current !== null && current !== undefined ? goal - current : null;

  let message;
  if (!goal)
    message =
      current === null || current === undefined
        ? 'Pick the overall score you are aiming for. We show how close your recent answers are.'
        : `Your recent average is ${current}%. Pick the score you are aiming for to see how close you are.`;
  else if (current === null || current === undefined) message = 'Finish a test or a Quick practice answer to see how close you are.';
  else if (gap > 0) message = `${pluralize(gap, 'point')} to go. Your recent average is ${current}%.`;
  else message = `You're at ${current}%, on or above your target. Time to aim higher?`;

  return (
    <section className={`vmt-card vmt-goal-card${gap !== null && gap <= 0 ? ' is-reached' : ''}`} aria-labelledby="target-title">
      <div className="vmt-goal-top">
        <div className="vmt-stack vmt-stack-sm">
          <span className="overline vmt-teal">Target score</span>
          <h2 id="target-title" className="title-md">
            {goal ? `${goal}%` : 'Not set yet'}
          </h2>
        </div>
        <span className="vmt-goal-icon" aria-hidden="true">
          <Crosshair className="vmt-icon" />
        </span>
      </div>

      <div
        className="vmt-target-track"
        role="img"
        aria-label={goal ? `Recent average ${current ?? 'not available'}, target ${goal}` : 'No target set'}
      >
        <span className="vmt-target-fill" style={{ width: `${current ?? 0}%` }} />
        {goal && (
          <span className={`vmt-target-marker${goal >= 88 ? ' is-end' : ''}`} style={{ left: `${goal}%` }}>
            <span className="vmt-target-flag">Target</span>
          </span>
        )}
      </div>
      <div className="vmt-columns-axis" aria-hidden="true">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>

      <p className="body-sm vmt-muted">{message}</p>
      {!goal && (
        <Button variant="secondary" size="sm" onClick={onSetTarget}>
          Set a target score
        </Button>
      )}
    </section>
  );
}
