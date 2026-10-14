import { useEffect, useState } from 'react';
import * as usersApi from '../../api/users';
import * as companiesApi from '../../api/companies';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS, roleLabel } from '../../constants/roles.js';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyFilters = { q: '', role: '', companyId: '', status: '' };

function UserStatus({ user }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {user.is_active ? <span className="badge badge-active">Activo</span> : <span className="badge badge-inactive">Inactivo</span>}
      {user.is_locked && <span className="badge badge-failed">Bloqueado</span>}
    </span>
  );
}

// Gestión de TODOS los usuarios de la plataforma (Superadministrador):
// buscar/filtrar, editar nombre, activar/desactivar, restablecer contraseña y
// desbloquear cuentas bloqueadas por intentos fallidos.
export default function PlatformUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [confirm, setConfirm] = useState(null); // { user, nextActive }
  const [editing, setEditing] = useState(null); // { user, fullName }
  const [resetting, setResetting] = useState(null); // { user, password }
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = (f = filters) =>
    usersApi.listAllUsers({ ...f, q: f.q.trim() }).then(setUsers).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    companiesApi.listCompanies().then(setCompanies).catch(() => setCompanies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los selectores filtran al instante; la búsqueda por texto, al enviar el formulario.
  const changeFilter = (field) => (e) => {
    const next = { ...filters, [field]: e.target.value };
    setFilters(next);
    if (field !== 'q') load(next);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    load(emptyFilters);
  };

  // Ejecuta una acción sobre un usuario y refresca la lista.
  const run = async (action, successMessage) => {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const toggleActive = async () => {
    const { user, nextActive } = confirm;
    setConfirm(null);
    await run(
      () => usersApi.updatePlatformUser(user.id, { isActive: nextActive }),
      `${user.full_name} quedó ${nextActive ? 'activado' : 'desactivado'}.`
    );
  };

  const unlock = (user) => run(() => usersApi.unlockPlatformUser(user.id), `Se desbloqueó la cuenta de ${user.full_name}.`);

  const submitModal = (action, successMessage, close) => async (e) => {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    try {
      await action();
      close(null);
      setNotice(successMessage);
      await load();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user) => {
    setModalError('');
    setEditing({ user, fullName: user.full_name });
  };

  const openReset = (user) => {
    setModalError('');
    setResetting({ user, password: '' });
  };

  if (!users) return <Loading />;

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Usuarios de la plataforma</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Todas las cuentas de todas las empresas y candidatos: búsqueda, edición, activación, contraseñas y desbloqueos.
          </p>
        </div>
      </div>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      <div className="card">
        <form
          className="filters-bar"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="user-search">Buscar</label>
            <input id="user-search" className="form-control" placeholder="Nombre o correo" value={filters.q} onChange={changeFilter('q')} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="user-role">Rol</label>
            <select id="user-role" className="form-control" value={filters.role} onChange={changeFilter('role')}>
              <option value="">Todos</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="user-company">Empresa</label>
            <select id="user-company" className="form-control" value={filters.companyId} onChange={changeFilter('companyId')}>
              <option value="">Todas</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="user-status">Estado</label>
            <select id="user-status" className="form-control" value={filters.status} onChange={changeFilter('status')}>
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="locked">Bloqueados</option>
            </select>
          </div>
          <div className="filters-actions">
            <button className="btn btn-primary">Buscar</button>
            {hasFilters && <button type="button" className="btn btn-outline" onClick={clearFilters}>Limpiar</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>{users.length} usuario(s)</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th>Empresa</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSuperadmin = u.role === 'superadmin';
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-title">{u.full_name}{u.id === me.id && <span className="muted"> (tú)</span>}</div>
                      <div className="cell-sub">{u.email}</div>
                    </td>
                    <td>{roleLabel(u.role)}</td>
                    <td>{u.company_name || '—'}</td>
                    <td><UserStatus user={u} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>Editar</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openReset(u)}>Contraseña</button>
                        {u.is_locked && (
                          <button className="btn btn-outline btn-sm" onClick={() => unlock(u)}>Desbloquear</button>
                        )}
                        {!isSuperadmin && (u.is_active ? (
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ user: u, nextActive: false })}>Desactivar</button>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={() => setConfirm({ user: u, nextActive: true })}>Activar</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="empty-state">{hasFilters ? 'Ningún usuario coincide con los filtros.' : 'No hay usuarios registrados.'}</p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.nextActive ? 'Activar usuario' : 'Desactivar usuario'}
        message={`¿Confirmas que deseas ${confirm?.nextActive ? 'activar' : 'desactivar'} a "${confirm?.user.full_name}"? ${
          confirm?.nextActive ? '' : 'No podrá iniciar sesión y su sesión actual dejará de funcionar de inmediato.'
        }`}
        confirmLabel={confirm?.nextActive ? 'Activar' : 'Desactivar'}
        danger={!confirm?.nextActive}
        onConfirm={toggleActive}
        onCancel={() => setConfirm(null)}
      />

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Editar usuario</h3>
            <p className="muted">{editing.user.email} · {roleLabel(editing.user.role)}</p>
            <Alert type="error">{modalError}</Alert>
            <form
              onSubmit={submitModal(
                () => usersApi.updatePlatformUser(editing.user.id, { fullName: editing.fullName }),
                'Nombre actualizado.',
                setEditing
              )}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">Nombre completo</label>
                <input
                  id="edit-name"
                  className="form-control"
                  required
                  value={editing.fullName}
                  onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetting && (
        <div className="modal-overlay" onClick={() => setResetting(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Restablecer contraseña</h3>
            <p className="muted">
              Nueva contraseña para {resetting.user.full_name} ({resetting.user.email}). Si la cuenta estaba bloqueada
              por intentos fallidos, también se desbloquea.
            </p>
            <Alert type="error">{modalError}</Alert>
            <form
              onSubmit={submitModal(
                () => usersApi.resetPlatformUserPassword(resetting.user.id, resetting.password),
                `Contraseña de ${resetting.user.full_name} restablecida.`,
                setResetting
              )}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="reset-password">Nueva contraseña</label>
                <input
                  id="reset-password"
                  className="form-control"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={resetting.password}
                  onChange={(e) => setResetting({ ...resetting, password: e.target.value })}
                />
                <div className="form-hint">Mínimo 8 caracteres. Compártela de forma segura con el usuario.</div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setResetting(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Restablecer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
