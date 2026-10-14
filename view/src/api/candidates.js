import client from './client';

export const getMyCandidateProfile = () => client.get('/candidates/me').then((r) => r.data.data);
export const updateMyCandidateProfile = (payload) => client.patch('/candidates/me', payload).then((r) => r.data.data);

export const addEducation = (payload) => client.post('/candidates/me/education', payload).then((r) => r.data.data);
export const removeEducation = (id) => client.delete(`/candidates/me/education/${id}`);

export const addExperience = (payload) => client.post('/candidates/me/experience', payload).then((r) => r.data.data);
export const removeExperience = (id) => client.delete(`/candidates/me/experience/${id}`);

export const addSkill = (payload) => client.post('/candidates/me/skills', payload).then((r) => r.data.data);
export const removeSkill = (id) => client.delete(`/candidates/me/skills/${id}`);

export const addLanguage = (payload) => client.post('/candidates/me/languages', payload).then((r) => r.data.data);
export const removeLanguage = (id) => client.delete(`/candidates/me/languages/${id}`);

export const addCertification = (payload) => client.post('/candidates/me/certifications', payload).then((r) => r.data.data);
export const removeCertification = (id) => client.delete(`/candidates/me/certifications/${id}`);

export const getCandidateForCompany = (id) => client.get(`/candidates/${id}`).then((r) => r.data.data);

// Vinculación privada por código (entornos por empresa)
export const listMyLinkedCompanies = () => client.get('/candidates/me/companies').then((r) => r.data.data);
export const linkCompanyByCode = (code) => client.post('/candidates/me/companies', { code }).then((r) => r.data.data);
