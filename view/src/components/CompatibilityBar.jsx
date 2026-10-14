export default function CompatibilityBar({ score, label }) {
  const value = score === null || score === undefined ? null : Number(score);
  return (
    <div style={{ marginBottom: label ? 6 : 0 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
          <span>{label}</span>
          <span>{value === null ? '—' : `${value.toFixed(0)}%`}</span>
        </div>
      )}
      <div className="compat-bar-wrap">
        <div className="compat-bar-fill" style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}
