import { ArrowRight, BookOpenCheck, CircleCheck, ClipboardCheck, ClipboardList, Clock, Flame, Mic, Target, Trophy, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCountUp } from '../../hooks/useMotion';
import { formatDate, formatScore, pluralize, skillLabel } from '../../utils/formatters';
import Alert from '../Alert';
import Achievements from './Achievements';
import { TargetCard, WeekGoalCard } from './GoalCards';
import StrengthCard from './StrengthCard';

function Stat({ icon: Icon, label, value, sub, suffix = '', progress, to }) {
  const shown = value === null || value === undefined ? '—' : `${Math.round(value * progress)}${suffix}`;
  const body = (
    <>
      <div className="vmt-stat-top">
        <span className="vmt-stat-label">{label}</span>
        <span className="vmt-stat-icon" aria-hidden="true">
          <Icon className="vmt-icon" />
        </span>
      </div>
      <span className="vmt-stat-value">{shown}</span>
      {sub && <span className="vmt-stat-sub">{sub}</span>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="vmt-card vmt-stat vmt-stat-link">
        {body}
      </Link>
    );
  }
  return <div className="vmt-card vmt-stat">{body}</div>;
}

function StudentStats({ stats, focusSkill }) {
  const progress = useCountUp({ duration: 1100, delay: 120 });
  return (
    <div className="vmt-profile-stats">
      <Stat icon={ClipboardCheck} label="Tests finished" value={stats.tests_completed} progress={progress} />
      <Stat
        icon={Target}
        label="Average test score"
        value={stats.average_score}
        suffix="%"
        progress={progress}
        sub={focusSkill ? `Work on: ${skillLabel(focusSkill)}` : undefined}
      />
      <Stat
        icon={Flame}
        label="Current streak"
        value={stats.current_streak}
        progress={progress}
        sub={`Longest: ${pluralize(stats.longest_streak, 'day')}`}
      />
      <Stat icon={Mic} label="Minutes spoken" value={stats.minutes_spoken} progress={progress} />
      <Stat icon={Zap} label="Practice answers" value={stats.practice_answers} progress={progress} />
      <Stat icon={BookOpenCheck} label="Notebook items learned" value={stats.notebook_learned} progress={progress} />
    </div>
  );
}

function PersonalBests({ records }) {
  const best = records.best_test;
  return (
    <section className="vmt-card" aria-labelledby="bests-title">
      <h2 id="bests-title" className="title-md" style={{ marginBottom: 'var(--space-2)' }}>
        Personal bests
      </h2>
      <ul className="vmt-bests">
        <li>
          <span className="vmt-bests-icon" aria-hidden="true">
            <Trophy className="vmt-icon" />
          </span>
          <span className="vmt-bests-text">
            <span className="label">Best test score</span>
            <span className="caption vmt-muted">{best ? `${best.title} · ${formatDate(best.date)}` : 'Finish a mock test to set one'}</span>
          </span>
          <span className="vmt-bests-value vmt-num">{best ? formatScore(best.score) : '—'}</span>
          {best && (
            <Link to={`/student/results/${best.attempt_id}`} className="vmt-link vmt-bests-link" aria-label={`See your ${best.title} result`}>
              <ArrowRight className="vmt-icon-sm" aria-hidden="true" />
            </Link>
          )}
        </li>
        <li>
          <span className="vmt-bests-icon" aria-hidden="true">
            <Zap className="vmt-icon" />
          </span>
          <span className="vmt-bests-text">
            <span className="label">Best practice answer</span>
            <span className="caption vmt-muted">Quick practice</span>
          </span>
          <span className="vmt-bests-value vmt-num">{formatScore(records.best_practice)}</span>
        </li>
        <li>
          <span className="vmt-bests-icon" aria-hidden="true">
            <Flame className="vmt-icon" />
          </span>
          <span className="vmt-bests-text">
            <span className="label">Longest streak</span>
            <span className="caption vmt-muted">Days in a row with practice</span>
          </span>
          <span className="vmt-bests-value vmt-num">{records.longest_streak ? pluralize(records.longest_streak, 'day') : '—'}</span>
        </li>
      </ul>
    </section>
  );
}

function AdminStats({ stats }) {
  const progress = useCountUp({ duration: 1100, delay: 120 });
  return (
    <div className="vmt-profile-stats">
      <Stat icon={ClipboardList} label="Tests you created" value={stats.tests_created} progress={progress} to="/admin/tests" />
      <Stat icon={CircleCheck} label="Of those, published" value={stats.tests_published} progress={progress} to="/admin/tests" />
      <Stat icon={Trophy} label="Reviews you published" value={stats.reviews_published} progress={progress} to="/admin/reviews" />
      <Stat
        icon={Clock}
        label="Waiting for review"
        value={stats.waiting_for_review}
        progress={progress}
        to="/admin/reviews"
        sub={stats.waiting_for_review ? 'Open the review queue' : 'All caught up'}
      />
      <Stat icon={Users} label="Active students" value={stats.active_students} progress={progress} to="/admin/students" />
    </div>
  );
}

/** First tab: profile strength, this week, target, numbers, achievements and personal bests (students). */
export default function OverviewTab({ isStudent, summary, celebrate, onDismissCelebrate, onStep, onGoTo }) {
  return (
    <div className="vmt-stack vmt-stack-lg">
      {celebrate && (
        <Alert tone="success" title="Your profile is complete" onClose={onDismissCelebrate}>
          Every step is done. Nice work!
        </Alert>
      )}
      <div className="vmt-profile-layout">
        <div className="vmt-profile-col">
          <StrengthCard key={summary.strength.percent >= 100 ? 'complete' : 'open'} strength={summary.strength} onStep={onStep} />
          {isStudent && (
            <>
              <WeekGoalCard week={summary.week} onSetGoal={() => onGoTo('goals', 'goal-weekly-1')} />
              <TargetCard target={summary.target} onSetTarget={() => onGoTo('goals', 'goal-target')} />
            </>
          )}
        </div>
        <div className="vmt-profile-col">
          {isStudent ? (
            <>
              <StudentStats stats={summary.stats} focusSkill={summary.focus_skill} />
              <Achievements items={summary.achievements} levelsEarned={summary.levels_earned} levelsTotal={summary.levels_total} />
              <PersonalBests records={summary.records} />
            </>
          ) : (
            <AdminStats stats={summary.stats} />
          )}
        </div>
      </div>
    </div>
  );
}
