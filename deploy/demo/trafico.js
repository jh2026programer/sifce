// Usuarios simulados para la demostración de OPERATE: un reclutador y una
// candidata usando SIFCE sin parar, para que Grafana muestre tráfico real.
// Uso: node deploy/demo/trafico.js [minutos]   (por defecto 30)
// Los errores se ignoran a propósito: durante la caída simulada la app no
// responde y el tráfico debe reanudarse solo cuando vuelva.
const BASE = 'http://localhost:8080/api/v1';
const minutes = Number(process.argv[2] || 30);
const end = Date.now() + minutes * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, options = {}) {
  const res = await fetch(BASE + url, { ...options, signal: AbortSignal.timeout(4000) });
  return res.json();
}

async function login(email) {
  const body = JSON.stringify({ email, password: 'Demo1234!' });
  const res = await json('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  return res.data.token;
}

async function session() {
  const recruiter = await login('reclutador@technova.demo');
  const candidate = await login('maria.gomez@correo.demo');
  const R = { Authorization: `Bearer ${recruiter}` };
  const vacancies = (await json('/vacancies', { headers: R })).data;
  const technova = (await json('/candidates/me/companies', { headers: { Authorization: `Bearer ${candidate}` } }))
    .data.find((c) => /TechNova/.test(c.name)).id;
  const C = { Authorization: `Bearer ${candidate}`, 'X-Active-Company': technova };
  return { R, C, vacancies };
}

(async () => {
  let s = null;
  while (Date.now() < end) {
    try {
      if (!s) s = await session();
      for (const v of s.vacancies) {
        await json(`/vacancies/${v.id}`, { headers: s.R });
        await json(`/applications/vacancy/${v.id}/ranking`, { headers: s.R });
      }
      await json('/reports/summary', { headers: s.R });
      await json('/vacancies/browse', { headers: s.C });
      await json('/applications/mine', { headers: s.C });
      await sleep(400);
    } catch (err) {
      s = null; // la app no responde (caída simulada): reintentar en un momento
      await sleep(2000);
    }
  }
})();
