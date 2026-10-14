// Administrador de Empresa: información propia (RF19), usuarios (RF18),
// criterios de evaluación (RF14), etapas (RF15) y reportes.
const { api, loginAll } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const db = require('../../model/db');

let t;

beforeAll(async () => {
  await resetDatabase();
  t = await loginAll(['adminTechnova', 'recruiter', 'maria']);
});
afterAll(() => db.pool.end());

describe('RF19 - Información de la empresa propia', () => {
  test('admin y reclutador la consultan; solo el admin la edita', async () => {
    expect((await api(t.recruiter).get('/companies/mine')).status).toBe(200);
    const edit = await api(t.adminTechnova).patch('/companies/mine', { description: 'Nueva descripción' });
    expect(edit.body.data.description).toBe('Nueva descripción');
    expect((await api(t.recruiter).patch('/companies/mine', { description: 'x' })).status).toBe(403);
  });
});

describe('RF18 - Usuarios de la empresa', () => {
  let newUserId;

  test('el admin crea un reclutador en su empresa', async () => {
    const res = await api(t.adminTechnova).post('/users', {
      fullName: 'Reclutador Dos', email: 'rec2@technova.demo', password: 'Rec21234!', role: 'recruiter',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('password_hash');
    newUserId = res.body.data.id;
  });

  test('no puede crear superadministradores ni candidatos desde aquí', async () => {
    const res = await api(t.adminTechnova).post('/users', {
      fullName: 'X', email: 'x@technova.demo', password: 'X12345678', role: 'superadmin',
    });
    expect(res.status).toBe(400);
  });

  test('desactivar un usuario le corta el acceso de inmediato', async () => {
    const recruiter2 = (await api().post('/auth/login', { email: 'rec2@technova.demo', password: 'Rec21234!' })).body.data.token;
    expect((await api(t.adminTechnova).patch(`/users/${newUserId}`, { isActive: false })).status).toBe(200);
    expect((await api(recruiter2).get('/vacancies')).status).toBe(403);
  });

  test('el reclutador no administra usuarios', async () => {
    expect((await api(t.recruiter).get('/users')).status).toBe(403);
  });
});

describe('RF14 - Criterios de evaluación', () => {
  test('crear, editar y borrar un criterio', async () => {
    const created = await api(t.adminTechnova).post('/criteria', { category: 'idiomas', name: 'Francés', weight: 5 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await api(t.adminTechnova).patch(`/criteria/${id}`, { weight: 7 })).body.data.weight).toBe('7.00');
    expect((await api(t.adminTechnova).delete(`/criteria/${id}`)).status).toBe(200);
  });

  test('la categoría debe ser una de las cuatro dimensiones de la IA', async () => {
    const res = await api(t.adminTechnova).post('/criteria', { category: 'astrologia', name: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('RF15 - Etapas del proceso', () => {
  test('la empresa tiene sus 6 etapas en orden y puede renombrarlas', async () => {
    const stages = await api(t.adminTechnova).get('/stages');
    expect(stages.body.data.map((s) => s.status_code)).toEqual(
      ['postulado', 'en_revision', 'preseleccionado', 'entrevista', 'seleccionado', 'rechazado']
    );
    const renamed = await api(t.adminTechnova).patch(`/stages/${stages.body.data[0].id}`, { name: 'Recibido' });
    expect(renamed.body.data.name).toBe('Recibido');
  });

  test('solo el admin configura etapas', async () => {
    expect((await api(t.recruiter).get('/stages')).status).toBe(403);
  });
});

describe('Reportes', () => {
  test('el resumen trae KPIs, embudo completo y series para las gráficas', async () => {
    const res = await api(t.adminTechnova).get('/reports/summary');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.vacancies.total).toBeGreaterThan(0);
    expect(Object.keys(d.applications.funnel)).toEqual(
      ['postulado', 'en_revision', 'preseleccionado', 'entrevista', 'seleccionado', 'rechazado']
    );
    expect(d.averageCompatibility).toEqual(expect.any(Number));
    expect(Array.isArray(d.topVacancies)).toBe(true);
  });

  test('la exportación trae una fila por postulación con las columnas del CSV', async () => {
    const res = await api(t.recruiter).get('/reports/export/applications');
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(Object.keys(res.body.data[0])).toEqual(
      ['vacante', 'candidato', 'correo', 'etapa', 'compatibilidad', 'fecha_postulacion']
    );
  });

  test('un candidato no accede a reportes', async () => {
    expect((await api(t.maria).get('/reports/summary')).status).toBe(403);
  });
});
