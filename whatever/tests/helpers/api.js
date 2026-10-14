// Atajos para hablar con la API desde las pruebas (vía Supertest, sin abrir
// ningún puerto).
const request = require('supertest');
const app = require('../../app');

const BASE = '/api/v1';
const DEMO_PASSWORD = 'Demo1234!';

// Usuarios creados por model/scripts/seed.js
const USERS = {
  superadmin: 'superadmin@sifce.demo',
  adminTechnova: 'admin@technova.demo',
  recruiter: 'reclutador@technova.demo',
  adminAndino: 'admin@andino.demo',
  maria: 'maria.gomez@correo.demo', // vinculada a TechNova y a Andino
  carlos: 'carlos.ruiz@correo.demo', // solo TechNova
  laura: 'laura.torres@correo.demo', // solo TechNova
};

const CODES = { technova: 'TECHNOVA24', andino: 'ANDINO24' };

async function login(email, password = DEMO_PASSWORD) {
  const res = await request(app).post(`${BASE}/auth/login`).send({ email, password });
  if (res.status !== 200) throw new Error(`Login falló para ${email}: ${res.status} ${res.body.message}`);
  return res.body.data.token;
}

// Cliente autenticado: api(token).get('/vacancies'), con encabezado opcional
// de entorno de empresa activo para candidatos.
function api(token, activeCompanyId) {
  const withHeaders = (req) => {
    if (token) req.set('Authorization', `Bearer ${token}`);
    if (activeCompanyId) req.set('X-Active-Company', activeCompanyId);
    return req;
  };
  return {
    get: (url) => withHeaders(request(app).get(BASE + url)),
    post: (url, body) => withHeaders(request(app).post(BASE + url)).send(body),
    patch: (url, body) => withHeaders(request(app).patch(BASE + url)).send(body),
    delete: (url) => withHeaders(request(app).delete(BASE + url)),
    upload: (url, field, buffer, filename, contentType) =>
      withHeaders(request(app).post(BASE + url)).attach(field, buffer, { filename, contentType }),
  };
}

// Inicia sesión con varios usuarios demo a la vez: { superadmin: token, ... }
async function loginAll(keys) {
  const tokens = {};
  for (const key of keys) tokens[key] = await login(USERS[key]);
  return tokens;
}

// Ids de las dos empresas demo, leídos como superadministrador.
async function companyIds(superadminToken) {
  const res = await api(superadminToken).get('/companies');
  const byCode = (code) => res.body.data.find((c) => c.access_code === code).id;
  return { technova: byCode(CODES.technova), andino: byCode(CODES.andino) };
}

// El análisis de IA corre en segundo plano tras postularse: espera a que termine.
async function waitForAnalysis(token, applicationId, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await api(token).get(`/applications/${applicationId}`);
    const status = res.body.data?.aiAnalysis?.status;
    if (status === 'completed' || status === 'failed') return res.body.data.aiAnalysis;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`El análisis de la postulación ${applicationId} no terminó en ${timeoutMs} ms`);
}

module.exports = { api, login, loginAll, companyIds, waitForAnalysis, USERS, CODES, DEMO_PASSWORD, request, app, BASE };
