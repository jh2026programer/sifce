import { useEffect, useState } from 'react';
import * as stagesApi from '../../api/stages';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';

export default function StagesPage() {
  const [stages, setStages] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState({}); // id -> {name, description}

  const load = () => stagesApi.listStages().then(setStages).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const startEdit = (stage) => setEditing({ ...editing, [stage.id]: { name: stage.name, description: stage.description || '' } });
  const changeEdit = (id, field, value) => setEditing({ ...editing, [id]: { ...editing[id], [field]: value } });

  const saveEdit = async (id) => {
    try {
      await stagesApi.updateStage(id, editing[id]);
      const next = { ...editing };
      delete next[id];
      setEditing(next);
      setMessage('Etapa actualizada.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!stages) return <Loading />;

  return (
    <div>
      <h2>Etapas del proceso de selección</h2>
      <p className="muted">
        Las seis etapas base del proceso (Postulado, En revisión, Preseleccionado, Entrevista, Seleccionado,
        Rechazado) son fijas en su función, pero puedes personalizar el nombre visible, la descripción y el orden
        de presentación de cada una.
      </p>
      <Alert type="success">{message}</Alert>
      <Alert type="error">{error}</Alert>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Orden</th><th>Código</th><th>Nombre visible</th><th>Descripción</th><th></th></tr></thead>
            <tbody>
              {stages.map((s) => {
                const isEditing = !!editing[s.id];
                return (
                  <tr key={s.id}>
                    <td>{s.sort_order}</td>
                    <td><code>{s.status_code}</code></td>
                    <td>
                      {isEditing ? (
                        <input className="form-control" value={editing[s.id].name} onChange={(e) => changeEdit(s.id, 'name', e.target.value)} />
                      ) : s.name}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="form-control" value={editing[s.id].description} onChange={(e) => changeEdit(s.id, 'description', e.target.value)} />
                      ) : (s.description || '—')}
                    </td>
                    <td>
                      {isEditing ? (
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(s.id)}>Guardar</button>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => startEdit(s)}>Editar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
