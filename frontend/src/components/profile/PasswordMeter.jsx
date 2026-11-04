import { Check, Circle } from 'lucide-react';
import { ratePassword } from '../../utils/password';

/** Four bars that fill as the password gets stronger, with the rules underneath. */
export default function PasswordMeter({ password, name, email, id }) {
  const { score, label, rules } = ratePassword(password, { name, email });
  const tone = score <= 1 ? 'is-weak' : score === 2 ? 'is-fair' : 'is-strong';
  return (
    <div className="vmt-pw" id={id}>
      <div className="vmt-pw-head">
        <div className={`vmt-pw-bars ${password ? tone : ''}`} aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={score >= step ? 'is-on' : ''} />
          ))}
        </div>
        <span className="caption vmt-pw-label" aria-live="polite">
          {password ? `Strength: ${label}` : 'Strength'}
        </span>
      </div>
      <ul className="vmt-pw-rules">
        {rules.map((rule) => (
          <li key={rule.key} className={rule.met ? 'is-met' : ''}>
            {rule.met ? <Check className="vmt-icon-sm" aria-hidden="true" /> : <Circle className="vmt-icon-sm" aria-hidden="true" />}
            <span>
              {rule.label}
              <span className="sr-only">{rule.met ? ' (done)' : ' (not yet)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
