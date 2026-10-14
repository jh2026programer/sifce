import client from './client';

export const listCompanyUsers = () => client.get('/users').then((r) => r.data.data);
export const createCompanyUser = (payload) => client.post('/users', payload).then((r) => r.data.data);
export const updateCompanyUser = (id, payload) => client.patch(`/users/${id}`, payload).then((r) => r.data.data);

// Gestión global de usuarios (solo Superadministrador).
export const listAllUsers = (filters = {}) => {
  // Solo se envían los filtros con valor, para no mandar "?role=" vacío.
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return client.get('/users/all', { params }).then((r) => r.data.data);
};
export const updatePlatformUser = (id, payload) => client.patch(`/users/all/${id}`, payload).then((r) => r.data.data);
export const resetPlatformUserPassword = (id, password) =>
  client.patch(`/users/all/${id}/password`, { password }).then((r) => r.data.data);
export const unlockPlatformUser = (id) => client.patch(`/users/all/${id}/unlock`).then((r) => r.data.data);
