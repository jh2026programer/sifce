// Modelo privado por empresa (RNF-S4): ninguna empresa ve datos de otra, y un
// candidato solo opera dentro del entorno de empresa al que se vinculó.
const { api, loginAll, companyIds, CODES } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const db = require('../../model/db');

let t; // tokens
let ids; // { technova, andino }
let technova; // datos de TechNova vistos por su reclutador

beforeAll(async () => {
  await resetDatabase();
  t = await loginAll(['superadmin', 'adminTechnova', 'recruiter', 'adminAndino', 'maria', 'carlos']);
  ids = await companyIds(t.superadmin);

  const vacancies = await api(t.recruiter).get('/vacancies');
  const backend = vacancies.body.data.find((v) => /Backend/.test(v.title));
  const apps = await api(t.recruiter).get(`/applications/vacancy/${backend.id}`);
  const criteria = await api(t.adminTechnova).get('/criteria');
  const stages = await api(t.adminTechnova).get('/stages');
  const users = await api(t.adminTechnova).get('/users');
  technova = {
    vacancy: backend,
    applications: apps.body.data,
    criterion: criteria.body.data[0],
    stage: stages.body.data[0],
    user: users.body.data.find((u) => u.role === 'recruiter'),
  };
});
afterAll(() => db.pool.end());

describe('Una empresa no puede ver ni tocar datos de otra (responde 404, sin revelar que existen)', () => {
  test('vacante de TechNova vista por el admin de Andino', async () => {
    expect((await api(t.adminAndino).get(`/vacancies/${technova.vacancy.id}`)).status).toBe(404);
  });

  test('editar una vacante de TechNova desde Andino', async () => {
    expect((await api(t.adminAndino).patch(`/vacancies/${technova.vacancy.id}`, { title: 'Hackeada' })).status).toBe(404);
  });

  test('postulaciones y ranking de una vacante de TechNova', async () => {
    expect((await api(t.adminAndino).get(`/applications/vacancy/${technova.vacancy.id}`)).status).toBe(404);
    expect((await api(t.adminAndino).get(`/applications/vacancy/${technova.vacancy.id}/ranking`)).status).toBe(404);
  });

  test('detalle y cambio de etapa de una postulación de TechNova', async () => {
    const appId = technova.applications[0].id;
    expect((await api(t.adminAndino).get(`/applications/${appId}`)).status).toBe(404);
    expect((await api(t.adminAndino).patch(`/applications/${appId}/stage`, { status: 'rechazado' })).status).toBe(404);
  });

  test('comparar postulaciones de TechNova desde Andino → 403', async () => {
    const ids2 = technova.applications.map((a) => a.id);
    expect((await api(t.adminAndino).post('/applications/compare', { applicationIds: ids2 })).status).toBe(403);
  });

  test('perfil y hoja de vida de un candidato que solo se postuló a TechNova', async () => {
    const app = technova.applications[0];
    expect((await api(t.adminAndino).get(`/candidates/${app.candidate_id}`)).status).toBe(404);
    expect((await api(t.adminAndino).get(`/resumes/${app.resume_id}/file`)).status).toBe(404);
  });

  test('criterios, etapas y usuarios de TechNova', async () => {
    expect((await api(t.adminAndino).patch(`/criteria/${technova.criterion.id}`, { weight: 1 })).status).toBe(404);
    expect((await api(t.adminAndino).patch(`/stages/${technova.stage.id}`, { name: 'X' })).status).toBe(404);
    expect((await api(t.adminAndino).patch(`/users/${technova.user.id}`, { isActive: false })).status).toBe(404);
  });

  test('cada empresa solo lista sus propias vacantes', async () => {
    const andino = await api(t.adminAndino).get('/vacancies');
    expect(andino.body.data.every((v) => v.company_id === ids.andino)).toBe(true);
    expect(andino.body.data.some((v) => v.id === technova.vacancy.id)).toBe(false);
  });

  test('el personal de TechNova sí puede ver sus propios datos', async () => {
    expect((await api(t.recruiter).get(`/vacancies/${technova.vacancy.id}`)).status).toBe(200);
    expect((await api(t.recruiter).get(`/resumes/${technova.applications[0].resume_id}/file`)).status).toBe(200);
  });
});

describe('Entornos privados del candidato (encabezado X-Active-Company)', () => {
  test('sin elegir empresa, el candidato no ve ninguna vacante → 400', async () => {
    expect((await api(t.maria).get('/vacancies/browse')).status).toBe(400);
  });

  test('una empresa a la que el candidato NO está vinculado es rechazada → 400', async () => {
    // Carlos solo está vinculado a TechNova.
    expect((await api(t.carlos, ids.andino).get('/vacancies/browse')).status).toBe(400);
  });

  test('dentro de cada entorno solo aparecen las vacantes de esa empresa', async () => {
    const inTechnova = await api(t.maria, ids.technova).get('/vacancies/browse');
    const inAndino = await api(t.maria, ids.andino).get('/vacancies/browse');
    expect(inTechnova.status).toBe(200);
    expect(inTechnova.body.data.length).toBeGreaterThan(0);
    expect(inTechnova.body.data.every((v) => v.company_id === ids.technova)).toBe(true);
    expect(inAndino.body.data.every((v) => v.company_id === ids.andino)).toBe(true);
  });

  test('la misma candidata no ve sus postulaciones de TechNova al operar en Andino', async () => {
    const inTechnova = await api(t.maria, ids.technova).get('/applications/mine');
    const inAndino = await api(t.maria, ids.andino).get('/applications/mine');
    expect(inTechnova.body.data.length).toBeGreaterThan(0);
    expect(inAndino.body.data).toEqual([]);
  });

  test('no puede ver ni postularse a una vacante de otra empresa desde su entorno activo', async () => {
    expect((await api(t.maria, ids.andino).get(`/vacancies/${technova.vacancy.id}`)).status).toBe(404);
    const apply = await api(t.maria, ids.andino).post('/applications', { vacancyId: technova.vacancy.id });
    expect(apply.status).toBe(404);
  });

  test('un candidato no puede ver la postulación de otro candidato', async () => {
    const mariaApp = technova.applications.find((a) => /María/.test(a.candidate_name));
    expect((await api(t.carlos).get(`/applications/${mariaApp.id}`)).status).toBe(404);
  });
});

describe('Código de acceso de empresa', () => {
  test('regenerar el código invalida el anterior para vínculos nuevos, sin quitar acceso a los ya vinculados', async () => {
    const regen = await api(t.adminTechnova).patch('/companies/mine/access-code');
    expect(regen.status).toBe(200);
    expect(regen.body.data.access_code).not.toBe(CODES.technova);

    const reg = await api().post('/auth/register/candidate', {
      fullName: 'Tarde', email: 'tarde@correo.demo', password: 'Tarde12345', companyCode: CODES.technova,
    });
    expect(reg.status).toBe(404);

    // Carlos ya estaba vinculado: sigue entrando a TechNova.
    expect((await api(t.carlos, ids.technova).get('/vacancies/browse')).status).toBe(200);
  });

  test('vincularse dos veces a la misma empresa → 409', async () => {
    const res = await api(t.maria).post('/candidates/me/companies', { code: CODES.andino });
    expect(res.status).toBe(409);
  });
});
