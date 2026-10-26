import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as vacanciesApi from '../../api/vacancies';
import * as resumesApi from '../../api/resumes';
import * as applicationsApi from '../../api/applications';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';

export default function PublicVacancyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState(null);
  const [resumes, setResumes] = useState(null);
  const [selectedResume, setSelectedResume] = useState('');
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    vacanciesApi.getVacancy(id).then(setVacancy).catch((e) => setError(e.message));
    resumesApi.listMyResumes().then((rs) => {
      // Solo sirven las hojas de vida que el validador pudo procesar.
      const usable = rs.filter((r) => r.status === 'extracted');
      setResumes(usable);
      if (usable[0]) setSelectedResume(usable[0].id);
    }).catch((e) => setError(e.message));
  }, [id]);

  const handleApply = async () => {
    setApplying(true);
    setError('');
    try {
      await applicationsApi.applyToVacancy({ vacancyId: id, resumeId: selectedResume || undefined });
      setApplied(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  if (error && !vacancy) return <Alert type="error">{error}</Alert>;
  if (!vacancy) return <Loading />;

  return (
    <div>
      <Link to="/candidate/vacancies" className="muted">&larr; Volver a vacantes</Link>
      <h2 style={{ marginTop: 10 }}>{vacancy.title}</h2>

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
              {(vacancy.required_skills || []).map((s, i) => <span className="tag" key={i}>{typeof s === 'string' ? s : s.name}</span>)}
            </div>
            <p style={{ marginTop: 12 }}><strong>Idiomas requeridos:</strong></p>
            <div className="tag-list">
              {(vacancy.required_languages || []).map((l, i) => <span className="tag" key={i}>{l.language} ({l.level})</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Postularme a esta vacante</h3>
        <Alert type="error">{error}</Alert>

        {applied ? (
          <>
            <Alert type="success">¡Postulación enviada! El análisis de compatibilidad se está procesando.</Alert>
            <button className="btn btn-outline" onClick={() => navigate('/candidate/applications')}>Ver mis postulaciones</button>
          </>
        ) : resumes && resumes.length === 0 ? (
          <Alert type="info">
            Necesitas una hoja de vida procesada correctamente (PDF válido con texto) para postularte.{' '}
            <Link to="/candidate/cv">Cargar hoja de vida</Link>.
          </Alert>
        ) : !resumes ? (
          <Loading />
        ) : (
          <>
            <div className="form-group" style={{ maxWidth: 420 }}>
              <label className="form-label">Hoja de vida a utilizar (solo las procesadas)</label>
              <select className="form-control" value={selectedResume} onChange={(e) => setSelectedResume(e.target.value)}>
                {resumes.map((r) => <option key={r.id} value={r.id}>{r.file_name}</option>)}
              </select>
            </div>
            <button className="btn btn-accent" disabled={applying} onClick={handleApply}>
              {applying ? 'Enviando...' : 'Postularme'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
