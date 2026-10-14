import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

const client = axios.create({ baseURL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('sifce_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Modelo privado por empresa: el candidato indica en qué entorno vinculado
  // quiere operar. El backend revalida el vínculo en cada request; este
  // encabezado nunca es, por sí solo, una fuente de autorización.
  const activeCompanyId = localStorage.getItem('sifce_active_company_id');
  if (activeCompanyId) config.headers['X-Active-Company'] = activeCompanyId;

  return config;
});

// Normaliza el mensaje de error para que los componentes solo tengan que
// leer err.message (RNF-F1: mensajes claros, nunca stack traces).
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      (err.request && !err.response ? 'No fue posible conectar con el servidor. Verifica tu conexión.' : 'Ocurrió un error inesperado.');
    const details = err.response?.data?.details;
    return Promise.reject({ ...err, message, details });
  }
);

export default client;
