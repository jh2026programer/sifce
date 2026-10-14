import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import Loading from '../components/Loading.jsx';
import Alert from '../components/Alert.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { IconBriefcase, IconUsers, IconTarget, IconBuilding, IconTrendingUp } from '../components/Icons.jsx';
import * as applicationsApi from '../api/applications';
import * as companiesApi from '../api/companies';
import * as reportsApi from '../api/reports';
import { STAGE_LABELS } from '../constants/statuses.js';
import { CHART_COLORS, axisTick } from '../styles/chartTheme.js';


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

function CompanyDashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi.getReportsSummary().then(setSummary).catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!summary) return <Loading />;

  const funnelData = Object.entries(summary.applications.funnel).map(([key, count]) => ({
    name: STAGE_LABELS[key], count,
  }));

  return (
    <>
      <div className="stat-row" style={{ marginBottom: 22 }}>
        <StatCard icon={<IconBriefcase size={20} />} color="blue" value={summary.vacancies.byStatus.active} label="Vacantes activas" />
        <StatCard icon={<IconUsers size={20} />} color="teal" value={summary.applications.total} label="Postulaciones totales" />
        <StatCard
          icon={<IconTarget size={20} />} color="violet"
          value={summary.averageCompatibility !== null ? `${summary.averageCompatibility}%` : '—'}
          label="Compatibilidad promedio"
        />
        <StatCard icon={<IconTrendingUp size={20} />} color="amber" value={summary.vacancies.byStatus.draft} label="Vacantes en borrador" />
      </div>

      <div className="grid-2">
        <div className="chart-card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Embudo de selección</h3>
            <Link to="/reports" className="btn btn-outline btn-sm">Ver reportes completos</Link>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="name" tick={axisTick(10)} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis allowDecimals={false} tick={axisTick(11)} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0 }}>Postulaciones recientes</h3>
            <Link to="/vacancies" className="btn btn-outline btn-sm">Ver vacantes</Link>
          </div>
          {summary.recentApplications.length === 0 ? (
            <p className="empty-state">Aún no se han recibido postulaciones.</p>
          ) : (
            summary.recentApplications.slice(0, 6).map((a) => (
              <div className="list-item-row" key={a.id}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.candidate_name}</div>
                  <div className="muted">{a.vacancy_title}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Vacantes con más postulaciones</h3>
          <Link to="/vacancies/new" className="btn btn-primary btn-sm">+ Nueva vacante</Link>
        </div>
        {summary.topVacancies.length === 0 ? (
          <p className="empty-state">Aún no has creado vacantes. <Link to="/vacancies/new">Crea la primera</Link>.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Título</th><th>Estado</th><th>Postulaciones</th><th>Compatibilidad</th><th></th></tr></thead>
              <tbody>
                {summary.topVacancies.map((v) => (
                  <tr key={v.id}>
                    <td>{v.title}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>{v.application_count}</td>
                    <td>{v.avg_score ? `${v.avg_score}%` : '—'}</td>
                    <td><Link to={`/vacancies/${v.id}`}>Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function CandidateDashboard() {
  const { activeCompany } = useAuth();
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    applicationsApi.listMyApplications().then(setApplications).catch((e) => setError(e.message));
  }, [activeCompany]);

  if (!activeCompany) {
    return (
      <div className="card">
        <h3>Selecciona un entorno de empresa</h3>
        <p className="muted">
          Cada empresa es un espacio privado e independiente. Vincúlate con el código que te compartió una empresa,
          o entra a una de las que ya tienes vinculadas, para ver sus vacantes y tus postulaciones.
        </p>
        <Link to="/candidate/companies" className="btn btn-accent">Ir a mis empresas</Link>
      </div>
    );
  }

  if (error) return <Alert type="error">{error}</Alert>;
  if (!applications) return <Loading />;

  return (
    <>
      <div className="stat-row" style={{ marginBottom: 22 }}>
        <StatCard icon={<IconBuilding size={20} />} color="blue" value={activeCompany.name} label="Entorno activo" />
        <StatCard icon={<IconBriefcase size={20} />} color="teal" value={applications.length} label="Postulaciones" />
        <StatCard icon={<IconTarget size={20} />} color="violet" value={applications.filter((a) => a.status === 'seleccionado').length} label="Selecciones" />
        <StatCard icon={<IconTrendingUp size={20} />} color="amber" value={applications.filter((a) => a.status === 'entrevista').length} label="En entrevista" />
      </div>
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Vacantes disponibles en {activeCompany.name}</h3>
          <Link to="/candidate/vacancies" className="btn btn-accent btn-sm">Explorar vacantes</Link>
        </div>
        <p className="muted">Completa tu perfil y carga tu hoja de vida para postularte con un solo clic.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/candidate/profile" className="btn btn-outline btn-sm">Completar perfil</Link>
          <Link to="/candidate/cv" className="btn btn-outline btn-sm">Cargar hoja de vida</Link>
        </div>
      </div>
    </>
  );
}

function SuperadminDashboard() {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    companiesApi.listCompanies().then(setCompanies).catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!companies) return <Loading />;

  const active = companies.filter((c) => c.status === 'active').length;

  return (
    <>
      <div className="stat-row" style={{ marginBottom: 22 }}>
        <StatCard icon={<IconBuilding size={20} />} color="blue" value={companies.length} label="Empresas registradas" />
        <StatCard icon={<IconTrendingUp size={20} />} color="teal" value={active} label="Empresas activas" />
        <StatCard icon={<IconTarget size={20} />} color="rose" value={companies.length - active} label="Empresas inactivas" />
      </div>
      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Gestión de la plataforma</h3>
          <Link to="/superadmin/companies" className="btn btn-outline btn-sm">Ver empresas</Link>
        </div>
        <p className="muted">Administra el alta, edición, activación y desactivación de empresas dentro de SIFCE.</p>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ marginBottom: 2 }}>Hola, {user.fullName.split(' ')[0]}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>Este es tu panel principal en SIFCE.</p>
        </div>
      </div>

      {user.role === 'superadmin' && <SuperadminDashboard />}
      {(user.role === 'company_admin' || user.role === 'recruiter') && <CompanyDashboard />}
      {user.role === 'candidate' && <CandidateDashboard />}
    </div>
  );
}
