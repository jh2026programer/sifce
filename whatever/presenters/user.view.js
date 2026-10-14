// PRESENTADOR (whatever/presenters) — cómo se presenta un usuario en cada respuesta. Ningún presentador
// incluye password_hash ni datos internos del bloqueo salvo donde se necesitan.

function pick(row, fields) {
  if (!row) return row;
  return fields.reduce((out, f) => {
    out[f] = row[f];
    return out;
  }, {});
}

// Sesión iniciada (login, registro, verificación OTP).
function session(user, token) {
  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
    },
  };
}

// GET /auth/me
const me = (user) => pick(user, ['id', 'company_id', 'role', 'full_name', 'email', 'is_active', 'created_at']);

// PATCH /users/me y administrador creado junto con una empresa.
const account = (user) => pick(user, ['id', 'full_name', 'email', 'role', 'company_id']);

// Usuarios internos de una empresa (RF18).
const companyUser = (user) => pick(user, ['id', 'full_name', 'email', 'role', 'is_active', 'created_at']);
const companyUserUpdated = (user) => pick(user, ['id', 'full_name', 'email', 'role', 'is_active']);

// Gestión global del superadministrador.
function platformUser(user) {
  return {
    ...pick(user, ['id', 'full_name', 'email', 'role', 'is_active', 'company_id', 'locked_until', 'created_at']),
    is_locked: Boolean(user.locked_until && new Date(user.locked_until) > new Date()),
  };
}

module.exports = { session, me, account, companyUser, companyUserUpdated, platformUser };
