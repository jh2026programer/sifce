import { useEffect, useState } from 'react';
import * as companiesApi from '../../api/companies';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { IconPlus } from '../../components/Icons.jsx';

const emptyCreateForm = {
  name: '', sector: '', description: '', location: '', contactEmail: '', contactPhone: '',
  adminFullName: '', adminEmail: '', adminPassword: '',
};

const emptyEditForm = { name: '', sector: '', description: '', location: '', contactEmail: '', contactPhone: '' };

export default function CompaniesPage() {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(emptyCreateForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null); // { id, name, nextStatus }

  const [editing, setEditing] = useState(null); // company object being edited
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const load = () => companiesApi.listCompanies().then(setCompanies).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setDetails(null);
    try {
      await companiesApi.createCompany(form);
      setForm(emptyCreateForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
      setDetails(err.details);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!confirm) return;
    try {
      await companiesApi.setCompanyStatus(confirm.id, confirm.nextStatus);
      setConfirm(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirm(null);
    }
  };

  const openEdit = (company) => {
    setEditError('');
    setEditForm({
      name: company.name || '', sector: company.sector || '', description: company.description || '',
      location: company.location || '', contactEmail: company.contact_email || '', contactPhone: company.contact_phone || '',
    });
    setEditing(company);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');
    try {
      await companiesApi.updateCompanyById(editing.id, editForm);
      setEditing(null);
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  if (!companies) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Empresas registradas</h2>
          <p className="muted" style={{ marginBottom: 0 }}>Alta, edición y activación de empresas clientes de la plataforma.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          <IconPlus size={16} />
          {showForm ? 'Cancelar' : 'Registrar empresa'}
        </button>
      </div>
      <Alert type="error" details={details}>{error}</Alert>

      {showForm && (
        <div className="card">
          <h3>Nueva empresa</h3>
          <p className="muted">
            Al crear una empresa desde aquí debes definir también las credenciales de su primer Administrador de
            Empresa — sin esto, la empresa quedaría creada pero nadie podría acceder a ella.
          </p>
          <form onSubmit={handleCreate}>
            <fieldset className="form-section">
              <legend>Datos de la empresa</legend>
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
            </fieldset>

            <fieldset className="form-section">
              <legend>Administrador de Empresa (credenciales de acceso)</legend>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nombre completo</label>
                  <input className="form-control" required value={form.adminFullName} onChange={update('adminFullName')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo electrónico</label>
                  <input className="form-control" type="email" required value={form.adminEmail} onChange={update('adminEmail')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña temporal</label>
                <input className="form-control" type="password" required minLength={8} value={form.adminPassword} onChange={update('adminPassword')} />
                <div className="form-hint">Mínimo 8 caracteres. Compártela de forma segura con el administrador de la empresa.</div>
              </div>
            </fieldset>

            <button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Registrar empresa'}</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Sector</th><th>Ubicación</th><th>Código</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.sector || '—'}</td>
                  <td>{c.location || '—'}</td>
                  <td><code>{c.access_code}</code></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>Editar</button>
                    {c.status === 'active' ? (
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ id: c.id, name: c.name, nextStatus: 'inactive' })}>
                        Desactivar
                      </button>
                    ) : (
                      <button className="btn btn-outline btn-sm" onClick={() => setConfirm({ id: c.id, name: c.name, nextStatus: 'active' })}>
                        Activar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {companies.length === 0 && <p className="empty-state">No hay empresas registradas todavía.</p>}
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.nextStatus === 'inactive' ? 'Desactivar empresa' : 'Activar empresa'}
        message={`¿Confirmas que deseas ${confirm?.nextStatus === 'inactive' ? 'desactivar' : 'activar'} "${confirm?.name}"? ${
          confirm?.nextStatus === 'inactive' ? 'Sus usuarios no podrán iniciar sesión mientras esté desactivada.' : ''
        }`}
        confirmLabel={confirm?.nextStatus === 'inactive' ? 'Desactivar' : 'Activar'}
        danger={confirm?.nextStatus === 'inactive'}
        onConfirm={toggleStatus}
        onCancel={() => setConfirm(null)}
      />

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Editar {editing.name}</h3>
            <Alert type="error">{editError}</Alert>
            <form onSubmit={handleEditSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input className="form-control" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sector</label>
                  <input className="form-control" value={editForm.sector} onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-control" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ubicación</label>
                  <input className="form-control" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo de contacto</label>
                  <input className="form-control" type="email" value={editForm.contactEmail} onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono de contacto</label>
                <input className="form-control" value={editForm.contactPhone} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
                <button className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
