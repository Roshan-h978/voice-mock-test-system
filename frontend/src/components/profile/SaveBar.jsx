import { Check } from 'lucide-react';
import Button from '../Button';

/** Bottom of a form: whether there are unsaved changes, Discard and Save. Sticks to the screen bottom while scrolling. */
export default function SaveBar({ dirty, saving, saved, onDiscard, label = 'Save changes' }) {
  return (
    <div className={`vmt-savebar${dirty ? ' is-dirty' : ''}`}>
      <span className="body-sm vmt-savebar-state" role="status">
        {dirty ? (
          <>
            <span className="vmt-savebar-dot" aria-hidden="true" /> Unsaved changes
          </>
        ) : saved ? (
          <>
            <Check className="vmt-icon-sm" aria-hidden="true" /> Saved
          </>
        ) : (
          'No changes yet'
        )}
      </span>
      <div className="vmt-row vmt-row-tight">
        <Button variant="ghost" onClick={onDiscard} disabled={!dirty || saving}>
          Discard
        </Button>
        <Button type="submit" loading={saving} disabled={!dirty}>
          {label}
        </Button>
      </div>
    </div>
  );
}
