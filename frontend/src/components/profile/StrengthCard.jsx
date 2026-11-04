import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';

function strengthWord(percent) {
  if (percent >= 100) return 'Complete';
  if (percent >= 70) return 'Strong';
  if (percent >= 40) return 'Good start';
  return 'Getting started';
}

/**
 * Profile strength: small optional steps, each one a shortcut to where it's done.
 * onStep(step) is called with { key, action } when a step that isn't done yet is clicked.
 */
export default function StrengthCard({ strength, onStep }) {
  const complete = strength.percent >= 100;
  const [open, setOpen] = useState(!complete);
  const next = strength.steps.find((step) => !step.done);

  return (
    <section className={`vmt-card vmt-strength${complete ? ' is-complete' : ''}`} aria-labelledby="strength-title">
      <div className="vmt-strength-head">
        <div className="vmt-stack vmt-stack-sm">
          <span className="overline vmt-teal">Profile strength</span>
          <h2 id="strength-title" className="title-md">
            {complete ? 'Your profile is complete' : strengthWord(strength.percent)}
          </h2>
          <p className="body-sm vmt-muted">
            {complete
              ? 'Every step is done. Your teacher can see who you are and what you are working towards.'
              : `${strength.done} of ${strength.total} steps done. ${next ? `Next: ${next.label.toLowerCase()}.` : ''}`}
          </p>
        </div>
        <span className="vmt-strength-percent vmt-num" aria-label={`${strength.percent} percent complete`}>
          {complete && <Sparkles className="vmt-icon" aria-hidden="true" />}
          {strength.percent}%
        </span>
      </div>

      <div className="vmt-strength-steps" aria-hidden="true">
        {strength.steps.map((step, index) => (
          <span key={step.key} className={index < strength.done ? 'is-done' : ''} />
        ))}
      </div>

      {complete && (
        <button type="button" className="vmt-disclosure" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide steps' : 'Show steps'}
          <ChevronDown className="vmt-icon-sm" aria-hidden="true" />
        </button>
      )}

      {open && (
        <ul className="vmt-strength-list">
          {strength.steps.map((step) => (
            <li key={step.key} className={step.done ? 'is-done' : ''}>
              {step.done ? (
                <span className="vmt-strength-item">
                  <span className="vmt-strength-check" aria-hidden="true">
                    <Check className="vmt-icon-sm" />
                  </span>
                  <span>
                    {step.label}
                    <span className="sr-only"> (done)</span>
                  </span>
                </span>
              ) : (
                <button type="button" className="vmt-strength-item" onClick={() => onStep(step)}>
                  <span className="vmt-strength-check" aria-hidden="true" />
                  <span>{step.label}</span>
                  <ArrowRight className="vmt-icon-sm vmt-strength-go" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
