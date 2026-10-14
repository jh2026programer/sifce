import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import RequireActiveCompany from './routes/RequireActiveCompany.jsx';
import AppLayout from './components/AppLayout.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterCandidatePage from './pages/RegisterCandidatePage.jsx';
import RegisterCompanyPage from './pages/RegisterCompanyPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MyAccountPage from './pages/MyAccountPage.jsx';

import CompaniesPage from './pages/superadmin/CompaniesPage.jsx';
import PlatformUsersPage from './pages/superadmin/PlatformUsersPage.jsx';

import CompanySettingsPage from './pages/admin/CompanySettingsPage.jsx';
import UsersPage from './pages/admin/UsersPage.jsx';
import CriteriaPage from './pages/admin/CriteriaPage.jsx';
import StagesPage from './pages/admin/StagesPage.jsx';
import ReportsPage from './pages/admin/ReportsPage.jsx';

import VacanciesListPage from './pages/vacancies/VacanciesListPage.jsx';
import VacancyFormPage from './pages/vacancies/VacancyFormPage.jsx';
import VacancyDetailPage from './pages/vacancies/VacancyDetailPage.jsx';

import ProfilePage from './pages/candidate/ProfilePage.jsx';
import CvPage from './pages/candidate/CvPage.jsx';
import CompanyEnvironmentsPage from './pages/candidate/CompanyEnvironmentsPage.jsx';
import BrowseVacanciesPage from './pages/candidate/BrowseVacanciesPage.jsx';
import PublicVacancyPage from './pages/candidate/PublicVacancyPage.jsx';
import MyApplicationsPage from './pages/candidate/MyApplicationsPage.jsx';

import ApplicationDetailPage from './pages/ApplicationDetailPage.jsx';

function withLayout(element) {
  return <AppLayout>{element}</AppLayout>;
}

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register/candidate" element={<RegisterCandidatePage />} />
      <Route path="/register/company" element={<RegisterCompanyPage />} />

      {/* Cualquier usuario autenticado */}
      <Route path="/dashboard" element={<ProtectedRoute>{withLayout(<DashboardPage />)}</ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute>{withLayout(<MyAccountPage />)}</ProtectedRoute>} />
      <Route path="/applications/:id" element={<ProtectedRoute>{withLayout(<ApplicationDetailPage />)}</ProtectedRoute>} />

      {/* Superadministrador (RF04 + gestión global de usuarios) */}
      <Route
        path="/superadmin/companies"
        element={<ProtectedRoute roles={['superadmin']}>{withLayout(<CompaniesPage />)}</ProtectedRoute>}
      />
      <Route
        path="/superadmin/users"
        element={<ProtectedRoute roles={['superadmin']}>{withLayout(<PlatformUsersPage />)}</ProtectedRoute>}
      />

      {/* Administrador de Empresa (RF14, RF15, RF18, RF19) */}
      <Route
        path="/admin/company"
        element={<ProtectedRoute roles={['company_admin']}>{withLayout(<CompanySettingsPage />)}</ProtectedRoute>}
      />
      <Route
        path="/admin/users"
        element={<ProtectedRoute roles={['company_admin']}>{withLayout(<UsersPage />)}</ProtectedRoute>}
      />
      <Route
        path="/admin/criteria"
        element={<ProtectedRoute roles={['company_admin']}>{withLayout(<CriteriaPage />)}</ProtectedRoute>}
      />
      <Route
        path="/admin/stages"
        element={<ProtectedRoute roles={['company_admin']}>{withLayout(<StagesPage />)}</ProtectedRoute>}
      />

      {/* Administrador de Empresa + Reclutador (RF05, RF08-13) */}
      <Route
        path="/vacancies"
        element={<ProtectedRoute roles={['company_admin', 'recruiter']}>{withLayout(<VacanciesListPage />)}</ProtectedRoute>}
      />
      <Route
        path="/reports"
        element={<ProtectedRoute roles={['company_admin', 'recruiter']}>{withLayout(<ReportsPage />)}</ProtectedRoute>}
      />
      <Route
        path="/vacancies/new"
        element={<ProtectedRoute roles={['company_admin', 'recruiter']}>{withLayout(<VacancyFormPage />)}</ProtectedRoute>}
      />
      <Route
        path="/vacancies/:id/edit"
        element={<ProtectedRoute roles={['company_admin', 'recruiter']}>{withLayout(<VacancyFormPage />)}</ProtectedRoute>}
      />
      <Route
        path="/vacancies/:id"
        element={<ProtectedRoute roles={['company_admin', 'recruiter']}>{withLayout(<VacancyDetailPage />)}</ProtectedRoute>}
      />

      {/* Candidato (RF06, RF07, RF08, RF16, RF17) */}
      <Route
        path="/candidate/profile"
        element={<ProtectedRoute roles={['candidate']}>{withLayout(<ProfilePage />)}</ProtectedRoute>}
      />
      <Route path="/candidate/cv" element={<ProtectedRoute roles={['candidate']}>{withLayout(<CvPage />)}</ProtectedRoute>} />
      <Route
        path="/candidate/companies"
        element={<ProtectedRoute roles={['candidate']}>{withLayout(<CompanyEnvironmentsPage />)}</ProtectedRoute>}
      />
      <Route
        path="/candidate/vacancies"
        element={
          <ProtectedRoute roles={['candidate']}>
            {withLayout(<RequireActiveCompany><BrowseVacanciesPage /></RequireActiveCompany>)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidate/vacancies/:id"
        element={
          <ProtectedRoute roles={['candidate']}>
            {withLayout(<RequireActiveCompany><PublicVacancyPage /></RequireActiveCompany>)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/candidate/applications"
        element={
          <ProtectedRoute roles={['candidate']}>
            {withLayout(<RequireActiveCompany><MyApplicationsPage /></RequireActiveCompany>)}
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
