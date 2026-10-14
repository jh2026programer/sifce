import client from './client';

export const listStages = () => client.get('/stages').then((r) => r.data.data);
export const createStage = (payload) => client.post('/stages', payload).then((r) => r.data.data);
export const updateStage = (id, payload) => client.patch(`/stages/${id}`, payload).then((r) => r.data.data);
