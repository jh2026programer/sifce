import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as vacanciesApi from '../../api/vacancies';
import * as applicationsApi from '../../api/applications';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import CompatibilityBar from '../../components/CompatibilityBar.jsx';
import { STAGE_OPTIONS } from '../../constants/statuses.js';


function InfoTab({ vacancy }) {
  return (
    <div className="card">
      <p>{vacancy.description || 'Sin descripción.'}</p>
      <div className="grid-2">
        <div>
          <p><strong>Formación requerida:</strong> {vacancy.required_education || 'No especificada'}</p>
          <p><strong>Experiencia mínima:</strong> {vacancy.min_experience_years} año(s)</p>
          <p><strong>Modalidad:</strong> {vacancy.modality}</p>
          <p><strong>Salario:</strong> {vacancy.salary || 'No especificado'}</p>
        </div>
        <div>
          <p><strong>Habilidades requeridas:</strong></p>
          <div className="tag-list">
            {(vacancy.required_skills || []).map((s, i) => (
              <span className="tag" key={i}>{typeof s === 'string' ? s : s.name}</span>
            ))}
            {(vacancy.required_skills || []).length === 0 && <span className="muted">Ninguna especificada</span>}
          </div>
          <p style={{ marginTop: 12 }}><strong>Idiomas requeridos:</strong></p>
          <div className="tag-list">
            {(vacancy.required_languages || []).map((l, i) => <span className="tag" key={i}>{l.language} ({l.level})</span>)}
            {(vacancy.required_languages || []).length === 0 && <span className="muted">Ninguno especificado</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApplicationsTab({ vacancyId, selected, setSelected }) {
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState('');

  const load = () => applicationsApi.listApplicationsForVacancy(vacancyId).then(setApplications).catch((e) => setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [vacancyId]);

  const changeStage = async (appId, status) => {
    try {
      await applicationsApi.updateApplicationStage(appId, status);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSelect = (appId) => {
    setSelected((prev) => (prev.includes(appId) ? prev.filter((x) => x !== appId) : [...prev, appId]));
  };

  if (error) return <Alert type="error">{error}</Alert>;
  if (!applications) return <Loading />;

  return (
    <div className="card">
      {applications.length === 0 ? (
        <p className="empty-state">Todavía no hay postulaciones para esta vacante.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th></th><th>Candidato</th><th>Compatibilidad</th><th>Análisis IA</th><th>Etapa</th><th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleSelect(a.id)} /></td>
                  <td>{a.candidate_name}<div className="muted">{a.candidate_email}</div></td>
                  <td style={{ minWidth: 140 }}>
                    {a.ai_status === 'completed' ? <CompatibilityBar score={a.overall_score} /> : <StatusBadge status={a.ai_status} />}
                  </td>
                  <td><StatusBadge status={a.ai_status} /></td>
                  <td>
                    {a.status === 'retirado' ? (
                      <StatusBadge status={a.status} />
                    ) : (
                      <select className="form-control" value={a.status} onChange={(e) => changeStage(a.id, e.target.value)}>
                        {STAGE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                      </select>
                    )}
                  </td>
                  <td><Link to={`/applications/${a.id}`} className="btn btn-outline btn-sm">Ver detalle</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RankingTab({ vacancyId }) {
  const [ranking, setRanking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    applicationsApi.getRankingForVacancy(vacancyId).then(setRanking).catch((e) => setError(e.message));
  }, [vacancyId]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!ranking) return <Loading />;

  return (
    <div className="card">
      <h3>Ranking por compatibilidad (RF10)</h3>
      {ranking.length === 0 ? (
        <p className="empty-state">Aún no hay análisis de IA completados para esta vacante.</p>
      ) : (
        <div>
          {ranking.map((r, i) => (
            <div className="list-item-row" key={r.application_id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong>#{i + 1}</strong>
                <Link to={`/applications/${r.application_id}`}>{r.candidate_name}</Link>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ width: 200 }}><CompatibilityBar score={r.overall_score} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonTab({ selected }) {
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const runComparison = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await applicationsApi.compareApplications(selected);
      setComparison(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Comparación de candidatos (RF12)</h3>
      <p className="muted">Selecciona 2 o más candidatos en la pestaña "Postulaciones" y vuelve aquí para compararlos.</p>
      <button className="btn btn-primary" disabled={selected.length < 2 || loading} onClick={runComparison}>
        {loading ? 'Comparando...' : `Comparar ${selected.length} seleccionados`}
      </button>
      <Alert type="error">{error}</Alert>

      {comparison && (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidato</th><th>Global</th><th>Formación</th><th>Experiencia</th><th>Habilidades</th><th>Idiomas</th><th>Fortalezas / Brechas</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((c) => (
                <tr key={c.application_id}>
                  <td>{c.candidate_name}</td>
                  <td><strong>{c.overall_score ?? '—'}%</strong></td>
                  <td>{c.education_score ?? '—'}%</td>
                  <td>{c.experience_score ?? '—'}%</td>
                  <td>{c.skills_score ?? '—'}%</td>
                  <td>{c.languages_score ?? '—'}%</td>
                  <td>
                    {(c.strengths || []).slice(0, 3).map((s, i) => <div className="strength-item" key={i}>✓ {s}</div>)}
                    {(c.gaps || []).slice(0, 3).map((g, i) => <div className="gap-item" key={i}>✕ {g}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function VacancyDetailPage() {
  const { id } = useParams();
  const [vacancy, setVacancy] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('info');
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    vacanciesApi.getVacancy(id).then(setVacancy).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!vacancy) return <Loading />;

  const tabs = [
    ['info', 'Información'], ['applications', 'Postulaciones'], ['ranking', 'Ranking'], ['comparison', 'Comparación'],
  ];

  return (
    <div>
      <div className="section-title-row">
        <div>
          <h2 style={{ marginBottom: 4 }}>{vacancy.title}</h2>
          <StatusBadge status={vacancy.status} />
        </div>
        <Link to={`/vacancies/${id}/edit`} className="btn btn-outline">Editar vacante</Link>
      </div>

      <div className="tabs-row" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`tab-btn${tab === key ? ' active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && <InfoTab vacancy={vacancy} />}
      {tab === 'applications' && <ApplicationsTab vacancyId={id} selected={selected} setSelected={setSelected} />}
      {tab === 'ranking' && <RankingTab vacancyId={id} />}
      {tab === 'comparison' && <ComparisonTab selected={selected} />}
    </div>
  );
}
