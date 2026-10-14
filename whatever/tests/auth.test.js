// RF01 (login), RF02 (registro), RF03 (cuenta propia) y protección contra
// fuerza bruta (bloqueo tras intentos fallidos).
const { api, login, USERS, CODES, DEMO_PASSWORD } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const db = require('../../model/db');

beforeAll(resetDatabase);
afterAll(() => db.pool.end());

const anon = api();

describe('Estado de la API', () => {
  test('GET /health responde que la API está operativa', async () => {
    const res = await anon.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('una ruta inexistente responde 404 con el formato de error común', async () => {
    const res = await anon.get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Recurso no encontrado.' });
  });

  test('la configuración pública indica si el CAPTCHA está activo', async () => {
    const res = await anon.get('/auth/public-config');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ captchaEnabled: false, captchaSiteKey: null });
  });
});

describe('RF01 - Inicio de sesión', () => {
  test.each(Object.entries(USERS))('el usuario demo "%s" puede iniciar sesión', async (_, email) => {
    const res = await anon.post('/auth/login', { email, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user).not.toHaveProperty('password_hash');
  });

  test('el correo no distingue mayúsculas ni espacios', async () => {
    const res = await anon.post('/auth/login', { email: '  ADMIN@TechNova.demo ', password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
  });

  test('contraseña incorrecta → 401 con mensaje genérico', async () => {
    const res = await anon.post('/auth/login', { email: USERS.carlos, password: 'incorrecta' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });

  test('correo inexistente → mismo 401 genérico (no revela si el correo existe)', async () => {
    const res = await anon.post('/auth/login', { email: 'nadie@x.demo', password: 'loquesea1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales inválidas.');
  });

  test('sin correo o contraseña → 400', async () => {
    const res = await anon.post('/auth/login', {});
    expect(res.status).toBe(400);
  });

  test('una ruta protegida sin token → 401', async () => {
    expect((await anon.get('/auth/me')).status).toBe(401);
  });

  test('un token inválido → 401', async () => {
    expect((await api('token-falso').get('/auth/me')).status).toBe(401);
  });

  test('GET /auth/me devuelve el usuario de la sesión sin datos sensibles', async () => {
    const token = await login(USERS.adminTechnova);
    const res = await api(token).get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(USERS.adminTechnova);
    expect(res.body.data.role).toBe('company_admin');
    expect(res.body.data).not.toHaveProperty('password_hash');
  });
});

describe('Bloqueo por intentos fallidos (fuerza bruta)', () => {
  test('tras 5 contraseñas incorrectas la cuenta se bloquea, incluso con la contraseña correcta', async () => {
    const email = 'bloqueo@correo.demo';
    await anon.post('/auth/register/candidate', { fullName: 'Prueba Bloqueo', email, password: 'Correcta123' });

    for (let i = 1; i <= 4; i++) {
      expect((await anon.post('/auth/login', { email, password: 'mala' })).status).toBe(401);
    }
    const fifth = await anon.post('/auth/login', { email, password: 'mala' });
    expect(fifth.status).toBe(429);
    expect(fifth.body.message).toMatch(/bloqueada/);

    const withCorrect = await anon.post('/auth/login', { email, password: 'Correcta123' });
    expect(withCorrect.status).toBe(429);
  });
});

describe('RF02 - Registro', () => {
  test('registro de candidato con código de empresa: queda vinculado a ese entorno', async () => {
    const res = await anon.post('/auth/register/candidate', {
      fullName: 'Pedro Nuevo', email: 'pedro@correo.demo', password: 'Pedro1234!', companyCode: CODES.andino.toLowerCase(),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.linkedCompany.name).toMatch(/Andino/);

    const companies = await api(res.body.data.token).get('/candidates/me/companies');
    expect(companies.body.data.map((c) => c.name)).toEqual([expect.stringMatching(/Andino/)]);
  });

  test('contraseña de menos de 8 caracteres → 400', async () => {
    const res = await anon.post('/auth/register/candidate', { fullName: 'X', email: 'x@correo.demo', password: '123' });
    expect(res.status).toBe(400);
  });

  test('correo ya registrado → 409', async () => {
    const res = await anon.post('/auth/register/candidate', { fullName: 'Otra', email: USERS.maria, password: 'Otra12345' });
    expect(res.status).toBe(409);
  });

  test('código de empresa inválido → 404 y NO queda una cuenta a medias', async () => {
    const email = 'huerfano@correo.demo';
    const res = await anon.post('/auth/register/candidate', { fullName: 'Q', email, password: 'Valida123', companyCode: 'NOEXISTE' });
    expect(res.status).toBe(404);
    expect((await anon.post('/auth/login', { email, password: 'Valida123' })).status).toBe(401);
  });

  test('registro de empresa: crea empresa + administrador con sesión iniciada', async () => {
    const res = await anon.post('/auth/register/company', {
      companyName: 'Empresa Registro', adminFullName: 'Admin Registro', email: 'admin@registro.demo', password: 'Registro123',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('company_admin');
    expect(res.body.data.company.access_code).toMatch(/^[A-Z2-9]{8}$/);

    // Nace con las 6 etapas base del proceso de selección (RF15).
    const stages = await api(res.body.data.token).get('/stages');
    expect(stages.body.data).toHaveLength(6);
  });
});

describe('RF03 - Gestión de la propia cuenta', () => {
  test('el usuario puede cambiar su nombre', async () => {
    const token = await login(USERS.carlos);
    const res = await api(token).patch('/users/me', { fullName: 'Carlos Ruiz' });
    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Carlos Ruiz');
  });

  test('sin datos para actualizar → 400', async () => {
    const token = await login(USERS.carlos);
    expect((await api(token).patch('/users/me', {})).status).toBe(400);
  });
});
