import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import CaptchaWidget from '../components/CaptchaWidget.jsx';
import { useCaptchaConfig } from '../hooks/useCaptchaConfig.js';

export default function RegisterCompanyPage() {
  const { registerCompany } = useAuth();
  const navigate = useNavigate();
  const captchaSiteKey = useCaptchaConfig();
  const [captchaToken, setCaptchaToken] = useState('');
  const [form, setForm] = useState({ companyName: '', sector: '', adminFullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDetails(null);
    setLoading(true);
    try {
      await registerCompany({ ...form, captchaToken });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setDetails(err.details);
    } finally {
      setLoading(false);
    }
  };

  const captchaPending = !!captchaSiteKey && !captchaToken;

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-brand">
          <img src="/sifce-logo.png" alt="SIFCE" className="auth-logo-img" />
        </div>
        <h2>Registrar mi empresa</h2>
        <p className="muted">
          Crea el espacio privado de tu empresa en SIFCE junto con tu cuenta de Administrador de Empresa. Al
          terminar recibirás un código único de acceso para invitar candidatos a tu entorno — nadie puede ver tus
          vacantes sin ese código. El Superadministrador de la plataforma podrá activar o desactivar tu empresa
          según corresponda.
        </p>
        <Alert type="error" details={details}>{error}</Alert>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre de la empresa</label>
            <input className="form-control" required value={form.companyName} onChange={update('companyName')} />
          </div>
          <div className="form-group">
            <label className="form-label">Sector</label>
            <input className="form-control" value={form.sector} onChange={update('sector')} placeholder="Ej. Tecnología, Retail, Salud..." />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre del administrador</label>
            <input className="form-control" required value={form.adminFullName} onChange={update('adminFullName')} />
          </div>
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input className="form-control" type="email" required value={form.email} onChange={update('email')} />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input className="form-control" type="password" required minLength={8} value={form.password} onChange={update('password')} />
            <div className="form-hint">Mínimo 8 caracteres.</div>
          </div>
          <CaptchaWidget siteKey={captchaSiteKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
          <button className="btn btn-primary btn-block" disabled={loading || captchaPending}>
            {loading ? 'Creando empresa...' : 'Registrar empresa'}
          </button>
        </form>
        <div className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>.
        </div>
      </div>
    </div>
  );
}
