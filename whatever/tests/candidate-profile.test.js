// RF06 - Información del candidato: perfil y sus secciones, y vinculación a
// empresas mediante código.
const { api, loginAll, CODES } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const db = require('../../model/db');

let t;

beforeAll(async () => {
  await resetDatabase();
  t = await loginAll(['maria', 'carlos', 'recruiter']);
});
afterAll(() => db.pool.end());

describe('RF06 - Perfil del candidato', () => {
  test('consulta su perfil completo con todas las secciones', async () => {
    const res = await api(t.maria).get('/candidates/me');
    expect(res.status).toBe(200);
    for (const key of ['education', 'experience', 'skills', 'languages', 'certifications', 'resumes']) {
      expect(Array.isArray(res.body.data[key])).toBe(true);
    }
  });

  test('actualiza datos del perfil sin borrar los que no envía', async () => {
    const before = (await api(t.maria).get('/candidates/me')).body.data;
    const res = await api(t.maria).patch('/candidates/me', { headline: 'Desarrolladora Backend' });
    expect(res.body.data.headline).toBe('Desarrolladora Backend');
    expect(res.body.data.location).toBe(before.location);
  });

  test.each([
    ['education', { institution: 'UTS', degree: 'Tecnología en Sistemas' }],
    ['experience', { companyName: 'Acme', position: 'Dev' }],
    ['skills', { name: 'Docker' }],
    ['languages', { language: 'Francés' }],
    ['certifications', { name: 'AWS Cloud Practitioner' }],
  ])('agrega y elimina un elemento de "%s"', async (section, body) => {
    const added = await api(t.maria).post(`/candidates/me/${section}`, body);
    expect(added.status).toBe(201);
    expect((await api(t.maria).delete(`/candidates/me/${section}/${added.body.data.id}`)).status).toBe(200);
  });

  test('aplica valores por defecto (habilidad técnica, idioma básico)', async () => {
    const skill = await api(t.maria).post('/candidates/me/skills', { name: 'Git' });
    expect(skill.body.data.type).toBe('tecnica');
    const lang = await api(t.maria).post('/candidates/me/languages', { language: 'Alemán' });
    expect(lang.body.data.level).toBe('basico');
  });

  test('no puede borrar elementos de otro candidato', async () => {
    const added = await api(t.maria).post('/candidates/me/skills', { name: 'Kotlin' });
    expect((await api(t.carlos).delete(`/candidates/me/skills/${added.body.data.id}`)).status).toBe(404);
  });

  test('el personal de empresa no usa las rutas de candidato', async () => {
    expect((await api(t.recruiter).get('/candidates/me')).status).toBe(403);
  });
});

describe('Vinculación a empresas por código', () => {
  test('lista solo las empresas a las que está vinculado', async () => {
    const res = await api(t.carlos).get('/candidates/me/companies');
    expect(res.body.data.map((c) => c.name)).toEqual([expect.stringMatching(/TechNova/)]);
  });

  test('se vincula a una empresa nueva con su código (sin importar mayúsculas)', async () => {
    const res = await api(t.carlos).post('/candidates/me/companies', { code: ` ${CODES.andino.toLowerCase()} ` });
    expect(res.status).toBe(201);
    const after = await api(t.carlos).get('/candidates/me/companies');
    expect(after.body.data).toHaveLength(2);
  });

  test('código vacío → 400; código inexistente → 404', async () => {
    expect((await api(t.carlos).post('/candidates/me/companies', {})).status).toBe(400);
    expect((await api(t.carlos).post('/candidates/me/companies', { code: 'NOEXISTE' })).status).toBe(404);
  });
});
