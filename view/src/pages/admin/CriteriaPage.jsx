import { useEffect, useState } from 'react';
import * as criteriaApi from '../../api/criteria';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import { CATEGORY_LABELS } from '../../constants/criteria.js';

const emptyForm = { category: 'formacion', name: '', weight: 25 };

export default function CriteriaPage() {
  const [criteria, setCriteria] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => criteriaApi.listCriteria().then(setCriteria).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await criteriaApi.createCriterion({ ...form, weight: Number(form.weight) });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await criteriaApi.deleteCriterion(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!criteria) return <Loading />;

  const totalsByCategory = criteria.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + Number(c.weight);
    return acc;
  }, {});

  return (
    <div>
      <h2>Criterios de evaluación</h2>
      <p className="muted">
        Define el peso de cada categoría dentro del cálculo de compatibilidad. Si no configuras criterios, el sistema
        usa por defecto 25% para cada una de las cuatro categorías.
      </p>
      <Alert type="error">{error}</Alert>

      <div className="grid-2">
        <div className="card">
          <h3>Nuevo criterio</h3>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-control" value={form.category} onChange={update('category')}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del criterio</label>
              <input className="form-control" required value={form.name} onChange={update('name')} placeholder="Ej. Formación académica" />
            </div>
            <div className="form-group">
              <label className="form-label">Peso (%)</label>
              <input className="form-control" type="number" min={0} max={100} value={form.weight} onChange={update('weight')} />
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Agregar criterio'}</button>
          </form>
        </div>

        <div className="card">
          <h3>Distribución actual por categoría</h3>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <div className="list-item-row" key={k}>
              <span>{v}</span>
              <strong>{totalsByCategory[k] ? `${totalsByCategory[k]}%` : 'Sin configurar (25% por defecto)'}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Criterios configurados</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Categoría</th><th>Nombre</th><th>Peso</th><th></th></tr></thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id}>
                  <td>{CATEGORY_LABELS[c.category]}</td>
                  <td>{c.name}</td>
                  <td>{c.weight}%</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {criteria.length === 0 && <p className="empty-state">No has configurado criterios propios todavía.</p>}
        </div>
      </div>
    </div>
  );
}
