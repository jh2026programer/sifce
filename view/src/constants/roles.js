// Constantes del dominio (frontend) — roles de usuario del dominio SIFCE. Deben coincidir con
// el enum user_role de model/schema.sql.

export const ROLES = {
  SUPERADMIN: 'superadmin',
  COMPANY_ADMIN: 'company_admin',
  RECRUITER: 'recruiter',
  CANDIDATE: 'candidate',
};

export const ROLE_LABELS = {
  superadmin: 'Superadministrador',
  company_admin: 'Administrador de Empresa',
  recruiter: 'Reclutador',
  candidate: 'Candidato',
};

export const roleLabel = (role) => ROLE_LABELS[role] || role;
