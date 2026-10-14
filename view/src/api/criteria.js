import client from './client';

export const listCriteria = () => client.get('/criteria').then((r) => r.data.data);
export const createCriterion = (payload) => client.post('/criteria', payload).then((r) => r.data.data);
export const updateCriterion = (id, payload) => client.patch(`/criteria/${id}`, payload).then((r) => r.data.data);
export const deleteCriterion = (id) => client.delete(`/criteria/${id}`);
