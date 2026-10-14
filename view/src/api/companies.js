import client from './client';

export const listCompanies = () => client.get('/companies').then((r) => r.data.data);
export const createCompany = (payload) => client.post('/companies', payload).then((r) => r.data.data);
export const updateCompanyById = (id, payload) => client.patch(`/companies/${id}`, payload).then((r) => r.data.data);
export const setCompanyStatus = (id, status) =>
  client.patch(`/companies/${id}/status`, { status }).then((r) => r.data.data);

export const getMyCompany = () => client.get('/companies/mine').then((r) => r.data.data);
export const updateMyCompany = (payload) => client.patch('/companies/mine', payload).then((r) => r.data.data);
export const regenerateAccessCode = () => client.patch('/companies/mine/access-code').then((r) => r.data.data);
