// Superadministrador: empresas de la plataforma (RF04) y gestión global de
// todos los usuarios (buscar, editar, activar/desactivar, contraseña, desbloqueo).
const { api, loginAll, companyIds, USERS, DEMO_PASSWORD } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const db = require('../../model/db');

let t;
let ids;

beforeAll(async () => {
  await resetDatabase();
  t = await loginAll(['superadmin', 'adminTechnova', 'recruiter']);
  ids = await companyIds(t.superadmin);
});
afterAll(() => db.pool.end());

describe('RF04 - Empresas de la plataforma', () => {
  test('solo el superadministrador lista las empresas', async () => {
    expect((await api(t.superadmin).get('/companies')).body.data.length).toBeGreaterThanOrEqual(2);
    expect((await api(t.adminTechnova).get('/companies')).status).toBe(403);
  });

  test('crear una empresa exige las credenciales de su administrador', async () => {
    expect((await api(t.superadmin).post('/companies', { name: 'Sin admin' })).status).toBe(400);
  });

  test('la empresa creada es operable: su administrador inicia sesión de inmediato', async () => {
    const res = await api(t.superadmin).post('/companies', {
      name: 'Nueva S.A.S.', sector: 'TI', adminFullName: 'Ana Nueva', adminEmail: 'ana@nueva.demo', adminPassword: 'Nueva1234!',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.admin).not.toHaveProperty('password_hash');
    const loginRes = await api().post('/auth/login', { email: 'ana@nueva.demo', password: 'Nueva1234!' });
    expect(loginRes.status).toBe(200);
  });

  test('desactivar una empresa corta el acceso de sus usuarios, incluso con sesión abierta', async () => {
    expect((await api(t.superadmin).patch(`/companies/${ids.technova}/status`, { status: 'inactive' })).status).toBe(200);
    expect((await api(t.recruiter).get('/vacancies')).status).toBe(403);
    expect((await api().post('/auth/login', { email: USERS.recruiter, password: DEMO_PASSWORD })).status).toBe(403);

    await api(t.superadmin).patch(`/companies/${ids.technova}/status`, { status: 'active' });
    expect((await api(t.recruiter).get('/vacancies')).status).toBe(200);
  });
});

describe('Gestión global de usuarios', () => {
  let laura;

  beforeAll(async () => {
    const all = await api(t.superadmin).get('/users/all');
    laura = all.body.data.find((u) => u.email === USERS.laura);
  });

  test('lista todas las cuentas y filtra por rol, empresa, búsqueda y estado', async () => {
    const all = await api(t.superadmin).get('/users/all');
    expect(all.body.data.length).toBeGreaterThanOrEqual(7);

    const candidates = await api(t.superadmin).get('/users/all?role=candidate');
    expect(candidates.body.data.every((u) => u.role === 'candidate')).toBe(true);

    const fromTechnova = await api(t.superadmin).get(`/users/all?companyId=${ids.technova}`);
    expect(fromTechnova.body.data.every((u) => u.company_id === ids.technova)).toBe(true);

    const search = await api(t.superadmin).get('/users/all?q=laura');
    expect(search.body.data.map((u) => u.email)).toEqual([USERS.laura]);
  });

  test('solo el superadministrador accede', async () => {
    expect((await api(t.adminTechnova).get('/users/all')).status).toBe(403);
  });

  test('desbloquea una cuenta bloqueada por intentos fallidos', async () => {
    for (let i = 0; i < 5; i++) await api().post('/auth/login', { email: USERS.laura, password: 'mala' });
    const locked = await api(t.superadmin).get('/users/all?status=locked');
    expect(locked.body.data.map((u) => u.email)).toContain(USERS.laura);

    expect((await api(t.superadmin).patch(`/users/all/${laura.id}/unlock`)).body.data.is_locked).toBe(false);
    expect((await api().post('/auth/login', { email: USERS.laura, password: DEMO_PASSWORD })).status).toBe(200);
  });

  test('desactivar a un usuario corta su sesión; activarlo la devuelve', async () => {
    const lauraToken = (await api().post('/auth/login', { email: USERS.laura, password: DEMO_PASSWORD })).body.data.token;
    await api(t.superadmin).patch(`/users/all/${laura.id}`, { isActive: false });
    expect((await api(lauraToken).get('/auth/me')).status).toBe(403);
    await api(t.superadmin).patch(`/users/all/${laura.id}`, { isActive: true });
    expect((await api(lauraToken).get('/auth/me')).status).toBe(200);
  });

  test('nunca se puede desactivar a un superadministrador', async () => {
    const all = await api(t.superadmin).get('/users/all?role=superadmin');
    const res = await api(t.superadmin).patch(`/users/all/${all.body.data[0].id}`, { isActive: false });
    expect(res.status).toBe(400);
  });

  test('restablecer contraseña: valida la longitud y la nueva funciona', async () => {
    expect((await api(t.superadmin).patch(`/users/all/${laura.id}/password`, { password: '123' })).status).toBe(400);
    expect((await api(t.superadmin).patch(`/users/all/${laura.id}/password`, { password: 'Nueva5678!' })).status).toBe(200);
    expect((await api().post('/auth/login', { email: USERS.laura, password: 'Nueva5678!' })).status).toBe(200);
  });

  test('editar el nombre', async () => {
    const res = await api(t.superadmin).patch(`/users/all/${laura.id}`, { fullName: 'Laura T.' });
    expect(res.body.data.full_name).toBe('Laura T.');
  });

  test('ids inexistentes o mal formados → 404 / 400 (nunca un error 500)', async () => {
    expect((await api(t.superadmin).patch('/users/all/00000000-0000-0000-0000-000000000000', { fullName: 'x' })).status).toBe(404);
    expect((await api(t.superadmin).patch('/users/all/abc', { fullName: 'x' })).status).toBe(400);
  });
});
