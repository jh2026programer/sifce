import client from './client';

export const applyToVacancy = (payload) => client.post('/applications', payload).then((r) => r.data.data);
export const listMyApplications = () => client.get('/applications/mine').then((r) => r.data.data);

export const listApplicationsForVacancy = (vacancyId) =>
  client.get(`/applications/vacancy/${vacancyId}`).then((r) => r.data.data);

export const getRankingForVacancy = (vacancyId) =>
  client.get(`/applications/vacancy/${vacancyId}/ranking`).then((r) => r.data.data);

export const getApplicationDetail = (id) => client.get(`/applications/${id}`).then((r) => r.data.data);

export const updateApplicationStage = (id, status) =>
  client.patch(`/applications/${id}/stage`, { status }).then((r) => r.data.data);

export const compareApplications = (applicationIds) =>
  client.post('/applications/compare', { applicationIds }).then((r) => r.data.data);

export const retryAnalysis = (id) => client.post(`/applications/${id}/retry-analysis`).then((r) => r.data);

export const withdrawApplication = (id) => client.patch(`/applications/${id}/withdraw`).then((r) => r.data.data);
