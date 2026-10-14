import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as vacanciesApi from '../../api/vacancies';
import { useAuth } from '../../context/AuthContext.jsx';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';

// RF16 (redefinido): vacantes disponibles DENTRO del entorno de empresa
// activo del candidato — no es un buscador multiempresa.
export default function BrowseVacanciesPage() {
  const { activeCompany } = useAuth();
  const [vacancies, setVacancies] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ title: '', modality: '' });

  const load = (params) => vacanciesApi.browseActiveVacancies(params).then(setVacancies).catch((e) => setError(e.message));
  useEffect(() => { load({}); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = {};
    if (filters.title) params.title = filters.title;
    if (filters.modality) params.modality = filters.modality;
    load(params);
  };

  return (
    <div>
      <h2>Vacantes en {activeCompany?.name}</h2>
      <Alert type="error">{error}</Alert>

      <form className="card" onSubmit={handleSearch}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="form-control" placeholder="Buscar por cargo" value={filters.title} onChange={(e) => setFilters({ ...filters, title: e.target.value })} />
          <select className="form-control" style={{ maxWidth: 200 }} value={filters.modality} onChange={(e) => setFilters({ ...filters, modality: e.target.value })}>
            <option value="">Cualquier modalidad</option>
            <option value="presencial">Presencial</option>
            <option value="remoto">Remoto</option>
            <option value="hibrido">Híbrido</option>
          </select>
          <button className="btn btn-primary">Buscar</button>
        </div>
      </form>

      {!vacancies ? <Loading /> : (
        <div className="card-grid">
          {vacancies.map((v) => (
            <div className="card" key={v.id}>
              <h3 style={{ marginBottom: 4 }}>{v.title}</h3>
              <p className="muted" style={{ marginBottom: 8 }}>{v.company_location || 'Ubicación no especificada'}</p>
              <p style={{ fontSize: '0.88rem' }}>{(v.description || '').slice(0, 140)}{v.description?.length > 140 ? '…' : ''}</p>
              <div className="tag-list" style={{ marginBottom: 10 }}>
                <span className="tag">{v.modality}</span>
                {v.min_experience_years > 0 && <span className="tag">{v.min_experience_years}+ años exp.</span>}
              </div>
              <Link to={`/candidate/vacancies/${v.id}`} className="btn btn-accent btn-sm">Ver detalle</Link>
            </div>
          ))}
          {vacancies.length === 0 && <p className="empty-state">No hay vacantes activas en este momento en esta empresa.</p>}
        </div>
      )}
    </div>
  );
}
