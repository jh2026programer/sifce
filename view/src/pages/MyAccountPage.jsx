import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import * as authApi from '../api/auth';
import Alert from '../components/Alert.jsx';

// RF03 - Gestión de Perfil de Usuario
export default function MyAccountPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const payload = { fullName };
      if (password) payload.password = password;
      await authApi.updateMyAccount(payload);
      setMessage('Tus datos se actualizaron correctamente.');
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Mi cuenta</h2>
      <div className="card" style={{ maxWidth: 480 }}>
        <Alert type="success">{message}</Alert>
        <Alert type="error">{error}</Alert>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Correo electrónico</label>
            <input className="form-control" value={user.email} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Nombre completo</label>
            <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <input
              className="form-control" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Dejar en blanco para no cambiarla"
            />
          </div>
          <button className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</button>
        </form>
      </div>
    </div>
  );
}
