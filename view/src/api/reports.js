import client from './client';

export const getReportsSummary = () => client.get('/reports/summary').then((r) => r.data.data);
export const exportApplicationsData = () => client.get('/reports/export/applications').then((r) => r.data.data);
