import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import * as applicationsApi from '../api/applications';
import Loading from '../components/Loading.jsx';
import Alert from '../components/Alert.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import CompatibilityBar from '../components/CompatibilityBar.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const NON_WITHDRAWABLE = ['retirado', 'seleccionado'];

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = () => applicationsApi.getApplicationDetail(id).then(setApplication).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (application?.aiAnalysis && ['pending', 'processing'].includes(application.aiAnalysis.status)) load();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await applicationsApi.retryAnalysis(id);
      setTimeout(load, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setConfirmWithdraw(false);
    try {
      await applicationsApi.withdrawApplication(id);
      navigate('/candidate/applications', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  if (error) return <Alert type="error">{error}</Alert>;
  if (!application) return <Loading />;

  const ai = application.aiAnalysis;
  const backLink = user.role === 'candidate' ? '/candidate/applications' : `/vacancies/${application.vacancy_id}`;
  const canWithdraw = user.role === 'candidate' && !NON_WITHDRAWABLE.includes(application.status);

  return (
    <div>
      <Link to={backLink} className="muted">&larr; Volver</Link>
      <div className="section-title-row" style={{ marginTop: 10 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{application.vacancy_title}</h2>
          {user.role !== 'candidate' && <p className="muted">Candidato: {application.candidate_name}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge status={application.status} />
          {canWithdraw && (
            <button className="btn btn-danger btn-sm" disabled={withdrawing} onClick={() => setConfirmWithdraw(true)}>
              {withdrawing ? 'Retirando...' : 'Retirar postulación'}
            </button>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Análisis de compatibilidad (RF09 / RF11)</h3>
          {!ai || ai.status === 'pending' || ai.status === 'processing' ? (
            <div className="loading-inline"><span className="spinner" /> El análisis de IA está en proceso...</div>
          ) : ai.status === 'failed' ? (
            <>
              <Alert type="error">El análisis no pudo completarse: {ai.error_message}</Alert>
              {user.role !== 'candidate' && (
                <button className="btn btn-outline btn-sm" disabled={retrying} onClick={handleRetry}>
                  {retrying ? 'Reintentando...' : 'Reintentar análisis'}
                </button>
              )}
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="compat-score-label" style={{ fontSize: '2rem' }}>{Number(ai.overall_score).toFixed(0)}%</div>
                <div className="muted">Compatibilidad global</div>
                {ai.provider && <div className="muted" style={{ fontSize: '0.75rem' }}>Calculado con: {ai.provider}</div>}
              </div>
              <CompatibilityBar label="Formación" score={ai.education_score} />
              <CompatibilityBar label="Experiencia" score={ai.experience_score} />
              <CompatibilityBar label="Habilidades" score={ai.skills_score} />
              <CompatibilityBar label="Idiomas" score={ai.languages_score} />
              <p className="muted" style={{ marginTop: 14, fontSize: '0.82rem' }}>{ai.explanation}</p>
              {user.role !== 'candidate' && (
                <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} disabled={retrying} onClick={handleRetry}>
                  {retrying ? 'Recalculando...' : 'Volver a analizar con el proveedor de IA actual'}
                </button>
              )}
            </>
          )}
        </div>

        <div className="card">
          <h3>Fortalezas y brechas</h3>
          {ai?.status === 'completed' ? (
            <>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--color-success)' }}>Fortalezas</h4>
              {(ai.strengths || []).length === 0 && <p className="muted">No se identificaron fortalezas destacadas.</p>}
              {(ai.strengths || []).map((s, i) => <div className="strength-item" key={i}>✓ {s}</div>)}

              <h4 style={{ fontSize: '0.85rem', color: 'var(--color-danger)', marginTop: 16 }}>Brechas</h4>
              {(ai.gaps || []).length === 0 && <p className="muted">No se identificaron brechas.</p>}
              {(ai.gaps || []).map((g, i) => <div className="gap-item" key={i}>✕ {g}</div>)}
            </>
          ) : (
            <p className="muted">Disponible una vez se complete el análisis.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Historial del proceso de selección (RF13)</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>De</th><th>A</th></tr></thead>
            <tbody>
              {application.stageHistory.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.changed_at).toLocaleString('es-CO')}</td>
                  <td><StatusBadge status={h.from_status} /></td>
                  <td><StatusBadge status={h.to_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={confirmWithdraw}
        title="Retirar postulación"
        message={`¿Confirmas que deseas retirar tu postulación a "${application.vacancy_title}"? Esta acción no se puede deshacer, pero podrás postularte de nuevo si la vacante sigue activa.`}
        confirmLabel="Retirar"
        danger
        onConfirm={handleWithdraw}
        onCancel={() => setConfirmWithdraw(false)}
      />
    </div>
  );
}
