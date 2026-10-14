export default function Loading({ full, label = 'Cargando...' }) {
  if (full) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-inline">
          <span className="spinner" />
          {label}
        </div>
      </div>
    );
  }
  return (
    <div className="loading-inline">
      <span className="spinner" />
      {label}
    </div>
  );
}
