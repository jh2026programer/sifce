import client from './client';

export const listMyCompanyVacancies = () => client.get('/vacancies').then((r) => r.data.data);
export const getVacancy = (id) => client.get(`/vacancies/${id}`).then((r) => r.data.data);
export const createVacancy = (payload) => client.post('/vacancies', payload).then((r) => r.data.data);
export const updateVacancy = (id, payload) => client.patch(`/vacancies/${id}`, payload).then((r) => r.data.data);
export const setVacancyStatus = (id, status) =>
  client.patch(`/vacancies/${id}/status`, { status }).then((r) => r.data.data);

export const browseActiveVacancies = (params) =>
  client.get('/vacancies/browse', { params }).then((r) => r.data.data);
