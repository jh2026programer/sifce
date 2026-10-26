// Flujo completo de selección: vacante (RF05) → hoja de vida (RF07) →
// postulación (RF08) → análisis de IA (RF09/RF11) → ranking (RF10) →
// comparación (RF12) → etapas (RF13) → consulta del candidato (RF17).
const { api, loginAll, companyIds } = require('./helpers/api');
const { resetDatabase } = require('./helpers/db');
const { SAMPLE_CV } = require('./helpers/pdf');
const { waitForAnalysis } = require('./helpers/api');
const db = require('../../model/db');

let t;
let ids;
let vacancy; // vacante creada en estas pruebas
let resumeId;
let applicationId;

beforeAll(async () => {
  await resetDatabase();
  t = await loginAll(['superadmin', 'recruiter', 'maria', 'carlos']);
  ids = await companyIds(t.superadmin);
});
afterAll(() => db.pool.end());

describe('RF05 - Gestión de vacantes', () => {
  test('el reclutador crea una vacante con requisitos', async () => {
    const res = await api(t.recruiter).post('/vacancies', {
      title: 'QA Tester',
      requiredEducation: 'Ingeniería de Sistemas',
      minExperienceYears: 1,
      requiredSkills: [{ name: 'Selenium', weight: 1 }, { name: 'Node.js', weight: 1 }],
      requiredLanguages: [{ language: 'Inglés', level: 'intermedio' }],
      modality: 'remoto',
      status: 'active',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.company_id).toBe(ids.technova);
    vacancy = res.body.data;
  });

  test('sin título → 400', async () => {
    expect((await api(t.recruiter).post('/vacancies', {})).status).toBe(400);
  });

  test('editar solo un campo conserva los demás', async () => {
    const res = await api(t.recruiter).patch(`/vacancies/${vacancy.id}`, { salary: '3.000.000' });
    expect(res.status).toBe(200);
    expect(res.body.data.salary).toBe('3.000.000');
    expect(res.body.data.title).toBe('QA Tester');
  });

  test('cambio de estado: valida los valores permitidos', async () => {
    expect((await api(t.recruiter).patch(`/vacancies/${vacancy.id}/status`, { status: 'zzz' })).status).toBe(400);
    expect((await api(t.recruiter).patch(`/vacancies/${vacancy.id}/status`, { status: 'closed' })).body.data.status).toBe('closed');
  });

  test('una vacante cerrada no aparece para el candidato ni acepta postulaciones', async () => {
    const browse = await api(t.maria, ids.technova).get('/vacancies/browse');
    expect(browse.body.data.some((v) => v.id === vacancy.id)).toBe(false);
    const apply = await api(t.maria, ids.technova).post('/applications', { vacancyId: vacancy.id });
    expect(apply.status).toBe(400);
    await api(t.recruiter).patch(`/vacancies/${vacancy.id}/status`, { status: 'active' });
  });

  test('el candidato encuentra la vacante activa filtrando por título y modalidad', async () => {
    const res = await api(t.maria, ids.technova).get('/vacancies/browse?title=qa&modality=remoto');
    expect(res.body.data.map((v) => v.id)).toContain(vacancy.id);
  });
});

describe('RF07 - Carga de hoja de vida', () => {
  test('acepta un PDF y extrae su texto', async () => {
    const res = await api(t.maria).upload('/resumes', 'resume', SAMPLE_CV, 'cv.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('extracted');
    resumeId = res.body.data.id;
  });

  test('rechaza archivos que no son PDF', async () => {
    const res = await api(t.maria).upload('/resumes', 'resume', Buffer.from('hola'), 'cv.txt', 'text/plain');
    expect(res.status).toBe(400);
  });

  test('solo el dueño descarga su hoja de vida', async () => {
    expect((await api(t.maria).get(`/resumes/${resumeId}/file`)).status).toBe(200);
    expect((await api(t.carlos).get(`/resumes/${resumeId}/file`)).status).toBe(404);
  });
});

describe('RF08 / RF09 / RF11 - Postulación y análisis de IA', () => {
  test('no se puede postular con una hoja de vida que el validador rechazó', async () => {
    // Un archivo de texto renombrado como .pdf: se carga, pero queda "extraction_failed".
    const falso = await api(t.maria).upload(
      '/resumes', 'resume', Buffer.from('texto plano disfrazado de pdf'), 'no_es_pdf.pdf', 'application/pdf'
    );
    expect(falso.status).toBe(201);
    expect(falso.body.data.status).toBe('extraction_failed');
    expect(falso.body.data.extractionError).toMatch(/no es un PDF real/);

    const res = await api(t.maria, ids.technova).post('/applications', { vacancyId: vacancy.id, resumeId: falso.body.data.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no se pudo procesar/);
  });

  test('la candidata se postula dentro de su entorno activo', async () => {
    const res = await api(t.maria, ids.technova).post('/applications', { vacancyId: vacancy.id, resumeId });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('postulado');
    applicationId = res.body.data.id;
  });

  test('no puede postularse dos veces a la misma vacante → 409', async () => {
    const res = await api(t.maria, ids.technova).post('/applications', { vacancyId: vacancy.id });
    expect(res.status).toBe(409);
  });

  test('el análisis de IA termina con puntajes por dimensión y explicación', async () => {
    const analysis = await waitForAnalysis(t.recruiter, applicationId);
    expect(analysis.status).toBe('completed');
    expect(analysis.provider).toBe('mock');
    for (const key of ['overall_score', 'education_score', 'experience_score', 'skills_score', 'languages_score']) {
      expect(Number(analysis[key])).toBeGreaterThanOrEqual(0);
      expect(Number(analysis[key])).toBeLessThanOrEqual(100);
    }
    expect(analysis.explanation).toEqual(expect.any(String));
    expect(Array.isArray(analysis.strengths)).toBe(true);
  });

  test('la candidata ve su postulación y su compatibilidad (RF17)', async () => {
    const res = await api(t.maria, ids.technova).get('/applications/mine');
    const mine = res.body.data.find((a) => a.id === applicationId);
    expect(mine.ai_status).toBe('completed');
  });
});

describe('RF10 / RF12 - Ranking y comparación', () => {
  let backend;

  beforeAll(async () => {
    const vacancies = await api(t.recruiter).get('/vacancies');
    backend = vacancies.body.data.find((v) => /Backend/.test(v.title));
  });

  test('el ranking está ordenado de mayor a menor compatibilidad', async () => {
    const res = await api(t.recruiter).get(`/applications/vacancy/${backend.id}/ranking`);
    const scores = res.body.data.map((r) => Number(r.overall_score));
    expect(scores.length).toBeGreaterThanOrEqual(2);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  test('compara dos candidatos de la misma vacante', async () => {
    const apps = await api(t.recruiter).get(`/applications/vacancy/${backend.id}`);
    const res = await api(t.recruiter).post('/applications/compare', { applicationIds: apps.body.data.map((a) => a.id) });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(apps.body.data.length);
  });

  test('comparar exige al menos dos postulaciones', async () => {
    expect((await api(t.recruiter).post('/applications/compare', { applicationIds: [applicationId] })).status).toBe(400);
  });

  test('no se pueden comparar postulaciones de vacantes distintas', async () => {
    const apps = await api(t.recruiter).get(`/applications/vacancy/${backend.id}`);
    const res = await api(t.recruiter).post('/applications/compare', { applicationIds: [apps.body.data[0].id, applicationId] });
    expect(res.status).toBe(400);
  });
});

describe('RF13 - Proceso de selección y retiro', () => {
  test('cambiar de etapa queda registrado en el historial', async () => {
    const res = await api(t.recruiter).patch(`/applications/${applicationId}/stage`, { status: 'preseleccionado' });
    expect(res.status).toBe(200);
    const detail = await api(t.recruiter).get(`/applications/${applicationId}`);
    const last = detail.body.data.stageHistory.at(-1);
    expect(last).toMatchObject({ from_status: 'postulado', to_status: 'preseleccionado' });
  });

  test('la empresa no puede asignar el estado "retirado" (lo decide el candidato)', async () => {
    expect((await api(t.recruiter).patch(`/applications/${applicationId}/stage`, { status: 'retirado' })).status).toBe(400);
  });

  test('la candidata retira su postulación y luego puede volver a postularse', async () => {
    const withdraw = await api(t.maria).patch(`/applications/${applicationId}/withdraw`);
    expect(withdraw.body.data.status).toBe('retirado');
    expect((await api(t.maria).patch(`/applications/${applicationId}/withdraw`)).status).toBe(409);

    const again = await api(t.maria, ids.technova).post('/applications', { vacancyId: vacancy.id });
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(applicationId); // se reactiva el mismo registro
    await waitForAnalysis(t.recruiter, applicationId);
  });

  test('si ya fue seleccionada no puede retirarse', async () => {
    await api(t.recruiter).patch(`/applications/${applicationId}/stage`, { status: 'seleccionado' });
    expect((await api(t.maria).patch(`/applications/${applicationId}/withdraw`)).status).toBe(400);
  });

  test('reintentar el análisis de IA', async () => {
    const res = await api(t.recruiter).post(`/applications/${applicationId}/retry-analysis`);
    expect(res.status).toBe(200);
    await waitForAnalysis(t.recruiter, applicationId);
  });
});
