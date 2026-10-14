import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import OtpInput from '../components/OtpInput.jsx';

export default function LoginPage() {
  const { login, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Segundo paso (OTP): si está presente, ya se validaron correo+contraseña
  // y falta el código de verificación antes de emitir la sesión.
  const [otpStep, setOtpStep] = useState(null); // { otpId, maskedEmail }
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const goToDestination = () => {
    const dest = location.state?.from?.pathname || '/dashboard';
    navigate(dest, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresOtp) {
        setOtpStep({ otpId: result.otpId, maskedEmail: result.maskedEmail });
      } else {
        goToDestination();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');
    setVerifying(true);
    try {
      await verifyOtp(otpStep.otpId, otpCode);
      goToDestination();
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setOtpError('');
    setResendMessage('');
    try {
      const newOtpId = await resendOtp(otpStep.otpId);
      setOtpStep({ ...otpStep, otpId: newOtpId });
      setOtpCode('');
      setResendMessage('Se envió un nuevo código.');
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/sifce-logo.png" alt="SIFCE" className="auth-logo-img" />
        </div>

        {!otpStep ? (
          <>
            <h2>Iniciar sesión</h2>
            <Alert type="error">{error}</Alert>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-control" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input className="form-control" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Verificando...' : 'Ingresar'}
              </button>
            </form>
            <div className="auth-switch">
              ¿Aún no tienes cuenta? <Link to="/register/candidate">Regístrate como candidato</Link> o{' '}
              <Link to="/register/company">registra tu empresa</Link>.
            </div>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: 'center' }}>Verificación en dos pasos</h2>
            <p className="muted" style={{ textAlign: 'center' }}>
              Enviamos un código de 6 dígitos a <strong>{otpStep.maskedEmail}</strong>. Revisa la terminal del
              backend si estás en modo demo (sin correo real configurado).
            </p>
            <Alert type="error">{otpError}</Alert>
            <Alert type="success">{resendMessage}</Alert>
            <form onSubmit={handleVerifyOtp}>
              <OtpInput value={otpCode} onChange={setOtpCode} disabled={verifying} />
              <button className="btn btn-primary btn-block" disabled={verifying || otpCode.length !== 6}>
                {verifying ? 'Verificando...' : 'Verificar y entrar'}
              </button>
            </form>
            <div className="auth-switch">
              ¿No te llegó? <button type="button" className="btn btn-outline btn-sm" disabled={resending} onClick={handleResend} style={{ marginLeft: 6 }}>
                {resending ? 'Enviando...' : 'Reenviar código'}
              </button>
            </div>
            <div className="auth-switch">
              <button
                type="button"
                onClick={() => { setOtpStep(null); setOtpCode(''); setOtpError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
              >
                Volver a intentar con otro correo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
