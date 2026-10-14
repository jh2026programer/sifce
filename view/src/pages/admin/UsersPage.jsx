import { useEffect, useState } from 'react';
import * as usersApi from '../../api/users';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import { roleLabel } from '../../constants/roles.js';

const emptyForm = { fullName: '', email: '', password: '', role: 'recruiter' };

export default function UsersPage() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => usersApi.listCompanyUsers().then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setDetails(null);
    try {
      await usersApi.createCompanyUser(form);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
      setDetails(err.details);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user) => {
    try {
      await usersApi.updateCompanyUser(user.id, { isActive: !user.is_active });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!users) return <Loading />;

  return (
    <div>
      <div className="section-title-row">
        <h2>Usuarios de la empresa</h2>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancelar' : '+ Nuevo usuario'}
        </button>
      </div>
      <Alert type="error" details={details}>{error}</Alert>

      {showForm && (
        <div className="card">
          <h3>Nuevo usuario</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input className="form-control" required value={form.fullName} onChange={update('fullName')} />
              </div>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-control" type="email" required value={form.email} onChange={update('email')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contraseña temporal</label>
                <input className="form-control" type="password" required minLength={8} value={form.password} onChange={update('password')} />
              </div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select className="form-control" value={form.role} onChange={update('role')}>
                  <option value="recruiter">Reclutador</option>
                  <option value="company_admin">Administrador de Empresa</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.is_active ? <span className="badge badge-active">Activo</span> : <span className="badge badge-inactive">Inactivo</span>}</td>
                  <td>
                    <button className={u.is_active ? 'btn btn-danger btn-sm' : 'btn btn-outline btn-sm'} onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="empty-state">Aún no has creado usuarios en tu empresa.</p>}
        </div>
      </div>
    </div>
  );
}
