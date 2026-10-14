import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import * as reportsApi from '../../api/reports';
import { downloadCsv } from '../../utils/csv';
import Loading from '../../components/Loading.jsx';
import Alert from '../../components/Alert.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { IconBriefcase, IconUsers, IconTarget, IconTrendingUp, IconDownload } from '../../components/Icons.jsx';
import { STAGE_LABELS } from '../../constants/statuses.js';
import { CHART_COLORS, axisTick } from '../../styles/chartTheme.js';


function StatCard({ icon, color, value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    reportsApi.getReportsSummary().then(setSummary).catch((e) => setError(e.message));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await reportsApi.exportApplicationsData();
      downloadCsv(`sifce-postulaciones-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (error) return <Alert type="error">{error}</Alert>;
  if (!summary) return <Loading />;

  const funnelData = Object.entries(summary.applications.funnel).map(([key, count]) => ({
    name: STAGE_LABELS[key], count,
  }));

  const dailyData = summary.dailyApplications.map((d) => ({
    day: new Date(d.day).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
    count: d.count,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Reportes</h2>
          <p className="muted" style={{ marginBottom: 0 }}>Panorama del proceso de selección de tu empresa.</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          <IconDownload size={16} />
          {exporting ? 'Generando...' : 'Exportar postulaciones (CSV)'}
        </button>
      </div>

      <div className="stat-row" style={{ marginBottom: 22 }}>
        <StatCard icon={<IconBriefcase size={20} />} color="blue" value={summary.vacancies.byStatus.active} label="Vacantes activas" />
        <StatCard icon={<IconUsers size={20} />} color="teal" value={summary.applications.total} label="Postulaciones totales" />
        <StatCard
          icon={<IconTarget size={20} />} color="violet"
          value={summary.averageCompatibility !== null ? `${summary.averageCompatibility}%` : '—'}
          label="Compatibilidad promedio"
        />
        <StatCard icon={<IconTrendingUp size={20} />} color="amber" value={summary.dailyApplications.reduce((s, d) => s + d.count, 0)} label="Postulaciones (14 días)" />
      </div>

      <div className="grid-2">
        <div className="chart-card">
          <h3>Postulaciones por etapa</h3>
          <p className="muted">Distribución actual del embudo de selección.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="name" tick={axisTick(11)} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={axisTick(11)} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Postulaciones recibidas (últimos 14 días)</h3>
          <p className="muted">Tendencia diaria de nuevas postulaciones.</p>
          {dailyData.length === 0 ? (
            <p className="empty-state">Sin postulaciones en los últimos 14 días.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="day" tick={axisTick(11)} />
                <YAxis allowDecimals={false} tick={axisTick(11)} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Vacantes con más postulaciones</h3>
        {summary.topVacancies.length === 0 ? (
          <p className="empty-state">Aún no hay vacantes con postulaciones.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Vacante</th><th>Estado</th><th>Postulaciones</th><th>Compatibilidad promedio</th><th></th></tr></thead>
              <tbody>
                {summary.topVacancies.map((v) => (
                  <tr key={v.id}>
                    <td>{v.title}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>{v.application_count}</td>
                    <td>{v.avg_score ? `${v.avg_score}%` : '—'}</td>
                    <td><Link to={`/vacancies/${v.id}`} className="btn btn-outline btn-sm">Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Postulaciones recientes</h3>
        {summary.recentApplications.length === 0 ? (
          <p className="empty-state">Todavía no hay postulaciones registradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Candidato</th><th>Vacante</th><th>Etapa</th><th>Compatibilidad</th><th>Fecha</th></tr></thead>
              <tbody>
                {summary.recentApplications.map((a) => (
                  <tr key={a.id}>
                    <td>{a.candidate_name}</td>
                    <td>{a.vacancy_title}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>{a.ai_status === 'completed' ? `${Number(a.overall_score).toFixed(0)}%` : <StatusBadge status={a.ai_status} />}</td>
                    <td>{new Date(a.applied_at).toLocaleDateString('es-CO')}</td>
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
