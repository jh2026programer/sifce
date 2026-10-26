// SIFCE conectado a sus dos microservicios (compatibilidad y validador-cv):
// la API los llama por HTTP y, si se caen, usa su respaldo interno sin dejar
// de funcionar.
const http = require('http');
const compatibilidadApp = require('../../microservicios/compatibilidad/server');
const validadorCvApp = require('../../microservicios/validador-cv/server');

let servidores;

// Los microservicios se levantan de verdad, en puertos libres, y sus URL se
// fijan ANTES de cargar la API (que las lee al arrancar).
async function levantar(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

let microservicios;
let api;
let loginAll;
let companyIds;
let waitForAnalysis;
let resetDatabase;
let SAMPLE_CV;
let db;

beforeAll(async () => {
  servidores = [await levantar(compatibilidadApp), await levantar(validadorCvApp)];
  process.env.MS_COMPATIBILIDAD_URL = `http://127.0.0.1:${servidores[0].address().port}`;
  process.env.MS_VALIDADOR_CV_URL = `http://127.0.0.1:${servidores[1].address().port}`;

  microservicios = require('../services/microservicios');
  ({ api, loginAll, companyIds, waitForAnalysis } = require('./helpers/api'));
  ({ resetDatabase } = require('./helpers/db'));
  ({ SAMPLE_CV } = require('./helpers/pdf'));
  db = require('../../model/db');

  await resetDatabase();
});

afterAll(async () => {
  await Promise.all(servidores.map((s) => new Promise((resolve) => s.close(resolve))));
  await db.pool.end();
});

const PESOS = { formacion: 25, experiencia: 25, habilidades: 25, idiomas: 25 };

describe('Con los microservicios encendidos', () => {
  test('la compatibilidad la calcula el microservicio', async () => {
    const r = await microservicios.calcularCompatibilidad(
      { formacion: 100, experiencia: 80, habilidades: 60, idiomas: 40 },
      PESOS
    );
    expect(r.modo).toBe('remote');
    expect(r.compatibilidad).toBe(70);
    expect(r.nivel).toBe('media');
  });

  test('si el microservicio rechaza los datos, la API no inventa un resultado', async () => {
    await expect(
      microservicios.calcularCompatibilidad({ formacion: 100 }, PESOS)
    ).rejects.toThrow(/Datos de compatibilidad inválidos/);
  });

  test('el validador de CV extrae el texto y detecta habilidades', async () => {
    const r = await microservicios.validarCv(SAMPLE_CV);
    expect(r.modo).toBe('remote');
    expect(r.success).toBe(true);
    expect(r.text).toContain('Hoja de vida de prueba');
    expect(r.datos.habilidades).toEqual(expect.arrayContaining(['node.js', 'postgresql', 'docker']));
  });

  test('un archivo que no es PDF se informa como error, sin excepción', async () => {
    const r = await microservicios.validarCv(Buffer.from('no soy un pdf'));
    expect(r.modo).toBe('remote');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no es un PDF real/);
  });

  test('flujo completo por la API: subir CV, postularse y obtener compatibilidad', async () => {
    const t = await loginAll(['superadmin', 'recruiter', 'maria']);
    const ids = await companyIds(t.superadmin);

    const cv = await api(t.maria).upload('/resumes', 'resume', SAMPLE_CV, 'cv.pdf', 'application/pdf');
    expect(cv.status).toBe(201);
    expect(cv.body.data.status).toBe('extracted');
    expect(cv.body.data.detectedData.habilidades).toEqual(expect.arrayContaining(['selenium']));

    const vacante = await api(t.recruiter).post('/vacancies', {
      title: 'Desarrollador Node.js',
      requiredSkills: [{ name: 'Node.js', weight: 1 }],
      modality: 'remoto',
      status: 'active',
    });
    const postulacion = await api(t.maria, ids.technova).post('/applications', {
      vacancyId: vacante.body.data.id,
      resumeId: cv.body.data.id,
    });
    expect(postulacion.status).toBe(201);

    const analisis = await waitForAnalysis(t.recruiter, postulacion.body.data.id);
    expect(analisis.status).toBe('completed');
    expect(Number(analisis.overall_score)).toBeGreaterThan(0);
  });
});

describe('Con los microservicios apagados (respaldo)', () => {
  beforeAll(async () => {
    await Promise.all(servidores.map((s) => new Promise((resolve) => s.close(resolve))));
    servidores = [];
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('la compatibilidad se sigue calculando con el respaldo interno', async () => {
    const r = await microservicios.calcularCompatibilidad(
      { formacion: 100, experiencia: 80, habilidades: 60, idiomas: 40 },
      PESOS
    );
    expect(r.modo).toBe('fallback');
    expect(r.compatibilidad).toBe(70);
  });

  test('el CV se sigue validando con el respaldo interno', async () => {
    const r = await microservicios.validarCv(SAMPLE_CV);
    expect(r.modo).toBe('fallback');
    expect(r.success).toBe(true);
  });

  test('la métrica de Prometheus muestra cuántas veces se usó el respaldo', async () => {
    const metrics = require('../services/metrics');
    const texto = await metrics.register.metrics();
    expect(texto).toMatch(/sifce_microservice_requests_total\{service="compatibilidad",mode="fallback"[^}]*\} [1-9]/);
    expect(texto).toMatch(/sifce_microservice_requests_total\{service="validador-cv",mode="fallback"[^}]*\} [1-9]/);
  });
});
