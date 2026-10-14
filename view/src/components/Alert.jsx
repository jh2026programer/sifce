export default function Alert({ type = 'info', children, details }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`}>
      {children}
      {Array.isArray(details) && details.length > 0 && (
        <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
          {details.map((d, i) => (
            <li key={i}>{d.message || JSON.stringify(d)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
