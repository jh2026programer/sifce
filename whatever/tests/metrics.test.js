// Etapa 7 · OPERATE: la API expone métricas para Prometheus en /metrics.
const { api, request, app, USERS, DEMO_PASSWORD } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const db = require('../../model/db');

beforeAll(resetDatabase);
afterAll(() => db.pool.end());

// Lee el valor de una serie del texto de Prometheus, ej. sifce_logins_total{result="success"}.
function valueOf(text, series) {
  const line = text.split('\n').find((l) => l.startsWith(series));
  return line ? Number(line.split(' ').pop()) : 0;
}
const scrape = async () => (await request(app).get('/metrics')).text;

describe('GET /metrics', () => {
  test('responde en formato Prometheus con las métricas de SIFCE', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    for (const name of [
      'sifce_http_request_duration_seconds',
      'sifce_logins_total',
      'sifce_account_lockouts_total',
      'sifce_ai_analyses_total',
      'sifce_database_up',
      'sifce_ai_provider_info',
      'sifce_process_cpu_seconds_total',
    ]) {
      expect(res.text).toContain(name);
    }
  });

  test('reporta la base de datos como disponible', async () => {
    expect(valueOf(await scrape(), 'sifce_database_up')).toBe(1);
  });

  test('cuenta logins exitosos y fallidos', async () => {
    const before = await scrape();
    await api().post('/auth/login', { email: USERS.maria, password: DEMO_PASSWORD });
    await api().post('/auth/login', { email: USERS.maria, password: 'mala' });
    const after = await scrape();
    expect(valueOf(after, 'sifce_logins_total{result="success"')).toBe(valueOf(before, 'sifce_logins_total{result="success"') + 1);
    expect(valueOf(after, 'sifce_logins_total{result="invalid"')).toBe(valueOf(before, 'sifce_logins_total{result="invalid"') + 1);
  });

  test('mide las peticiones HTTP por ruta patrón (no por id)', async () => {
    await api().get('/health');
    const text = await scrape();
    expect(text).toMatch(/sifce_http_request_duration_seconds_count\{[^}]*route="\/api\/v1\/health"/);
  });
});
