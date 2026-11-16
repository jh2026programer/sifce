// Minería de datos: resultados del análisis y predicción de selección.
const { api, loginAll } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const db = require('../../model/db');

let t;

beforeAll(async () => {
  await resetDatabase();
  t = await loginAll(['superadmin', 'recruiter', 'adminTechnova', 'maria']);
});
afterAll(() => db.pool.end());

const CANDIDATO = {
  sector: 'Tecnología',
  modalidad: 'Remoto',
  edad: 30,
  nivel_educativo: 'Profesional',
  anios_experiencia: 6,
  experiencia_requerida: 3,
  habilidades_requeridas: 6,
  habilidades_cumplidas: 6,
  nivel_ingles: 'Avanzado',
  certificaciones: 4,
  salario_ofrecido: 6500000,
  salario_aspirado: 6800000,
  compatibilidad: 92,
};

describe('Resultados de la minería', () => {
  test('el reclutador ve el resumen: depuración, análisis, modelo y perfiles', async () => {
    const res = await api(t.recruiter).get('/mineria/resumen');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.depuracion.pasos.map((p) => p.filas)).toEqual([100000, 95000, 78447, 78447]);
    expect(d.resumen.postulaciones_analizadas).toBe(78447);
    expect(d.modelo.metricas.auc).toBeGreaterThan(0.8);
    expect(d.modelo.metricas.exactitud).toBeGreaterThan(d.modelo.metricas.exactitud_sin_modelo);
    expect(d.perfiles).toHaveLength(4);
    expect(d.analisis.por_compatibilidad.map((g) => g.grupo)).toEqual(['Baja', 'Media', 'Alta']);
  });

  test('el superadministrador y el administrador de empresa también lo ven', async () => {
    expect((await api(t.superadmin).get('/mineria/resumen')).status).toBe(200);
    expect((await api(t.adminTechnova).get('/mineria/resumen')).status).toBe(200);
  });

  test('un candidato no tiene acceso', async () => {
    expect((await api(t.maria).get('/mineria/resumen')).status).toBe(403);
    expect((await api(t.maria).post('/mineria/prediccion', CANDIDATO)).status).toBe(403);
  });
});

describe('Predicción de selección', () => {
  test('un candidato muy compatible tiene alta probabilidad y explica por qué', async () => {
    const res = await api(t.recruiter).post('/mineria/prediccion', CANDIDATO);
    expect(res.status).toBe(200);
    expect(res.body.data.seleccionado).toBe('Sí');
    expect(res.body.data.probabilidad).toBeGreaterThan(50);
    expect(res.body.data.suben[0].factor).toBe('Compatibilidad con la vacante');
  });

  test('un candidato poco compatible tiene baja probabilidad', async () => {
    const res = await api(t.recruiter).post('/mineria/prediccion', {
      ...CANDIDATO, compatibilidad: 35, habilidades_cumplidas: 1, nivel_ingles: 'Básico', certificaciones: 0,
    });
    expect(res.body.data.seleccionado).toBe('No');
    expect(res.body.data.probabilidad).toBeLessThan(10);
  });

  test('pedir más del 30 % sobre el salario ofrecido baja la probabilidad', async () => {
    const normal = await api(t.recruiter).post('/mineria/prediccion', CANDIDATO);
    const caro = await api(t.recruiter).post('/mineria/prediccion', { ...CANDIDATO, salario_aspirado: 9500000 });
    expect(caro.body.data.probabilidad).toBeLessThan(normal.body.data.probabilidad);
    expect(caro.body.data.bajan.map((f) => f.factor)).toContain('Pide más del 30 % sobre lo ofrecido');
  });

  test('datos inválidos responden 400 con el detalle', async () => {
    const res = await api(t.recruiter).post('/mineria/prediccion', { ...CANDIDATO, sector: 'Minería', edad: 12 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([
      expect.stringMatching(/sector/),
      expect.stringMatching(/edad/),
    ]));
  });

  test('las habilidades cumplidas no pueden superar las requeridas', async () => {
    const res = await api(t.recruiter).post('/mineria/prediccion', { ...CANDIDATO, habilidades_cumplidas: 9 });
    expect(res.status).toBe(400);
  });
});
