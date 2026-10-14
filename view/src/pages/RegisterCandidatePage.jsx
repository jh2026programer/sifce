import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import CaptchaWidget from '../components/CaptchaWidget.jsx';
import { useCaptchaConfig } from '../hooks/useCaptchaConfig.js';

export default function RegisterCandidatePage() {
  const { registerCandidate } = useAuth();
  const navigate = useNavigate();
  const captchaSiteKey = useCaptchaConfig();
  const [captchaToken, setCaptchaToken] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', companyCode: '' });
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
      await registerCandidate({ ...form, captchaToken });
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
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/sifce-logo.png" alt="SIFCE" className="auth-logo-img" />
        </div>
        <h2>Crear cuenta de candidato</h2>
        <p className="muted">Regístrate para postularte a vacantes y consultar el estado de tus procesos de selección.</p>
        <Alert type="error" details={details}>{error}</Alert>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre completo</label>
            <input className="form-control" required value={form.fullName} onChange={update('fullName')} />
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
          <div className="form-group">
            <label className="form-label">Código de la empresa (opcional)</label>
            <input
              className="form-control" value={form.companyCode}
              onChange={(e) => setForm({ ...form, companyCode: e.target.value.toUpperCase() })}
              placeholder="Si una empresa te invitó, ingresa aquí su código"
            />
            <div className="form-hint">
              Puedes dejarlo en blanco y vincularte a una empresa más adelante desde tu cuenta.
            </div>
          </div>
          <CaptchaWidget siteKey={captchaSiteKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
          <button className="btn btn-primary btn-block" disabled={loading || captchaPending}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
        <div className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>. ¿Eres una empresa?{' '}
          <Link to="/register/company">Regístrala aquí</Link>.
        </div>
      </div>
    </div>
  );
}
