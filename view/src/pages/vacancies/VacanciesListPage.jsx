import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as vacanciesApi from '../../api/vacancies';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function VacanciesListPage() {
  const [vacancies, setVacancies] = useState(null);
  const [error, setError] = useState('');

  const load = () => vacanciesApi.listMyCompanyVacancies().then(setVacancies).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    try {
      await vacanciesApi.setVacancyStatus(id, status);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!vacancies) return <Loading />;

  return (
    <div>
      <div className="section-title-row">
        <h2>Vacantes</h2>
        <Link to="/vacancies/new" className="btn btn-primary">+ Nueva vacante</Link>
      </div>
      <Alert type="error">{error}</Alert>

      <div className="card">
        {vacancies.length === 0 ? (
          <p className="empty-state">No has creado vacantes todavía. <Link to="/vacancies/new">Crea la primera</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Título</th><th>Modalidad</th><th>Estado</th><th>Postulaciones</th><th>Acciones</th></tr></thead>
              <tbody>
                {vacancies.map((v) => (
                  <tr key={v.id}>
                    <td><Link to={`/vacancies/${v.id}`}>{v.title}</Link></td>
                    <td>{v.modality}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>{v.application_count}</td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Link to={`/vacancies/${v.id}/edit`} className="btn btn-outline btn-sm">Editar</Link>
                      {v.status !== 'active' && (
                        <button className="btn btn-accent btn-sm" onClick={() => changeStatus(v.id, 'active')}>Activar</button>
                      )}
                      {v.status !== 'closed' && (
                        <button className="btn btn-danger btn-sm" onClick={() => changeStatus(v.id, 'closed')}>Cerrar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
