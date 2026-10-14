import { useEffect, useState } from 'react';
import * as companiesApi from '../../api/companies';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

export default function CompanySettingsPage() {
  const [form, setForm] = useState(null);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () =>
    companiesApi.getMyCompany()
      .then((c) => {
        setForm({
          name: c.name || '', sector: c.sector || '', description: c.description || '',
          location: c.location || '', contactEmail: c.contact_email || '', contactPhone: c.contact_phone || '',
        });
        setAccessCode(c.access_code);
      })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await companiesApi.updateMyCompany(form);
      setMessage('La información de la empresa se actualizó correctamente.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(accessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setConfirmRegenerate(false);
    try {
      const updated = await companiesApi.regenerateAccessCode();
      setAccessCode(updated.access_code);
      setMessage('Se generó un nuevo código de acceso. Los candidatos ya vinculados no se ven afectados.');
    } catch (err) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  if (!form) return error ? <Alert type="error">{error}</Alert> : <Loading />;

  return (
    <div>
      <h2>Información de la empresa</h2>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Código de vinculación para candidatos</h3>
        <p className="muted">
          Comparte este código con los candidatos que quieras invitar a tu entorno privado de SIFCE. Sin este código
          nadie puede ver tus vacantes ni postularse — no existe ningún listado público.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <code style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.08em', background: 'var(--color-bg)', padding: '8px 16px', borderRadius: 8 }}>
            {accessCode}
          </code>
          <button className="btn btn-outline btn-sm" onClick={handleCopy}>{copied ? 'Copiado ✓' : 'Copiar'}</button>
        </div>
        <button className="btn btn-danger btn-sm" disabled={regenerating} onClick={() => setConfirmRegenerate(true)}>
          {regenerating ? 'Generando...' : 'Generar nuevo código'}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <Alert type="success">{message}</Alert>
        <Alert type="error">{error}</Alert>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-control" required value={form.name} onChange={update('name')} />
            </div>
            <div className="form-group">
              <label className="form-label">Sector</label>
              <input className="form-control" value={form.sector} onChange={update('sector')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={form.description} onChange={update('description')} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ubicación</label>
              <input className="form-control" value={form.location} onChange={update('location')} />
            </div>
            <div className="form-group">
              <label className="form-label">Correo de contacto</label>
              <input className="form-control" type="email" value={form.contactEmail} onChange={update('contactEmail')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono de contacto</label>
            <input className="form-control" value={form.contactPhone} onChange={update('contactPhone')} />
          </div>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </form>
      </div>

      <ConfirmModal
        open={confirmRegenerate}
        title="Generar nuevo código de acceso"
        message="El código actual dejará de funcionar para NUEVAS vinculaciones. Los candidatos ya vinculados a tu empresa no pierden acceso. ¿Deseas continuar?"
        confirmLabel="Generar nuevo código"
        danger
        onConfirm={handleRegenerate}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </div>
  );
}
