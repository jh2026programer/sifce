import client from './client';

export const getMineriaResumen = () => client.get('/mineria/resumen').then((r) => r.data.data);
export const predecirSeleccion = (candidato) => client.post('/mineria/prediccion', candidato).then((r) => r.data.data);
