import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as applicationsApi from '../../api/applications';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

// Estados desde los que ya no tiene sentido (o no se permite) retirarse.
const NON_WITHDRAWABLE = ['retirado', 'seleccionado'];

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState('');
  const [toWithdraw, setToWithdraw] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = () => applicationsApi.listMyApplications().then(setApplications).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // Refresca cada 5s mientras haya análisis en curso (RNF-R3: indicador de procesamiento)
    const interval = setInterval(() => {
      if (applications?.some((a) => ['pending', 'processing'].includes(a.ai_status))) load();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmWithdraw = async () => {
    setWithdrawing(true);
    setError('');
    try {
      await applicationsApi.withdrawApplication(toWithdraw.id);
      setToWithdraw(null);
      load();
    } catch (err) {
      setError(err.message);
      setToWithdraw(null);
    } finally {
      setWithdrawing(false);
    }
  };

  if (error) return <Alert type="error">{error}</Alert>;
  if (!applications) return <Loading />;

  return (
    <div>
      <h2>Mis postulaciones</h2>
      {applications.length === 0 ? (
        <div className="card"><p className="empty-state">Aún no te has postulado a ninguna vacante. <Link to="/candidate/vacancies">Explora vacantes disponibles</Link>.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Vacante</th><th>Empresa</th><th>Etapa</th><th>Compatibilidad</th><th></th></tr></thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>{a.vacancy_title}</td>
                    <td>{a.company_name}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      {a.ai_status === 'completed' ? `${Number(a.overall_score).toFixed(0)}%` : <StatusBadge status={a.ai_status} />}
                    </td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Link to={`/applications/${a.id}`} className="btn btn-outline btn-sm">Ver detalle</Link>
                      {!NON_WITHDRAWABLE.includes(a.status) && (
                        <button className="btn btn-danger btn-sm" onClick={() => setToWithdraw(a)}>Retirar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!toWithdraw}
        title="Retirar postulación"
        message={`¿Confirmas que deseas retirar tu postulación a "${toWithdraw?.vacancy_title}" en ${toWithdraw?.company_name}? Esta acción no se puede deshacer, pero podrás postularte de nuevo si la vacante sigue activa.`}
        confirmLabel="Retirar"
        danger
        onConfirm={confirmWithdraw}
        onCancel={() => setToWithdraw(null)}
      />
      {withdrawing && <Loading label="Retirando postulación..." />}
    </div>
  );
}
