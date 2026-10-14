import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  IconDashboard, IconBuilding, IconUsers, IconBriefcase, IconFile,
  IconChart, IconSliders, IconLayers, IconLink, IconCompass, IconArrowSwitch,
} from './Icons.jsx';

function Item({ to, icon, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
      {icon}
      {children}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, activeCompany } = useAuth();
  if (!user) return null;

  return (
    <nav className="sidebar">
      <Item to="/dashboard" icon={<IconDashboard size={17} />}>Panel principal</Item>

      {user.role === 'superadmin' && (
        <>
          <div className="sidebar-section-title">Plataforma</div>
          <Item to="/superadmin/companies" icon={<IconBuilding size={17} />}>Empresas</Item>
          <Item to="/superadmin/users" icon={<IconUsers size={17} />}>Usuarios</Item>
        </>
      )}

      {user.role === 'company_admin' && (
        <>
          <div className="sidebar-section-title">Mi empresa</div>
          <Item to="/admin/company" icon={<IconBuilding size={17} />}>Información de la empresa</Item>
          <Item to="/admin/users" icon={<IconUsers size={17} />}>Usuarios</Item>
          <Item to="/admin/criteria" icon={<IconSliders size={17} />}>Criterios de evaluación</Item>
          <Item to="/admin/stages" icon={<IconLayers size={17} />}>Etapas del proceso</Item>
        </>
      )}

      {(user.role === 'company_admin' || user.role === 'recruiter') && (
        <>
          <div className="sidebar-section-title">Selección de personal</div>
          <Item to="/vacancies" icon={<IconBriefcase size={17} />}>Vacantes</Item>
          <Item to="/reports" icon={<IconChart size={17} />}>Reportes</Item>
        </>
      )}

      {user.role === 'candidate' && (
        <>
          <div className="sidebar-section-title">Mi perfil</div>
          <Item to="/candidate/profile" icon={<IconUsers size={17} />}>Perfil profesional</Item>
          <Item to="/candidate/cv" icon={<IconFile size={17} />}>Mi hoja de vida</Item>
          <div className="sidebar-section-title">Mis empresas</div>
          <Item to="/candidate/companies" icon={activeCompany ? <IconArrowSwitch size={17} /> : <IconLink size={17} />}>
            {activeCompany ? 'Cambiar de empresa' : 'Vincular una empresa'}
          </Item>
          {activeCompany && (
            <>
              <div className="sidebar-section-title">{activeCompany.name}</div>
              <Item to="/candidate/vacancies" icon={<IconCompass size={17} />}>Explorar vacantes</Item>
              <Item to="/candidate/applications" icon={<IconBriefcase size={17} />}>Mis postulaciones</Item>
            </>
          )}
        </>
      )}
    </nav>
  );
}
