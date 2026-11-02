/** A number on a card: label, value, optional icon and a small line underneath. */
export default function StatCard({ label, value, sub, icon: Icon }) {
  // A long word such as "Pronunciation" needs the full row on phones instead of breaking mid-word.
  const wide = typeof value === 'string' && value.length > 9;
  return (
    <div className={`vmt-card vmt-stat${wide ? ' vmt-stat-wide' : ''}`}>
      <div className="vmt-stat-top">
        <span className="vmt-stat-label">{label}</span>
        {Icon && (
          <span className="vmt-stat-icon" aria-hidden="true">
            <Icon className="vmt-icon" />
          </span>
        )}
      </div>
      <span className="vmt-stat-value">{value}</span>
      {sub && <span className="vmt-stat-sub">{sub}</span>}
    </div>
  );
}
