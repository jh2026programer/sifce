// ============================================================================
// Métricas de operación para Prometheus (ciclo de vida, etapa 7 · OPERATE).
//
// La API expone estas métricas en GET /metrics (texto en formato Prometheus).
// Prometheus las recoge de cada réplica cada pocos segundos, Grafana las
// grafica y las reglas de alerta (deploy/monitoring/alert-rules.yml) avisan a
// PagerDuty cuando algo se sale de lo normal. Cada métrica está amarrada a un
// requisito no funcional del SRS.
// ============================================================================
const client = require('prom-client');
const db = require('../../model/db');
const aiProvider = require('./ai/aiProvider');

const register = new client.Registry();
register.setDefaultLabels({ app: 'sifce-api' });

// CPU, memoria, event loop y demás métricas estándar del proceso Node.js.
client.collectDefaultMetrics({ register, prefix: 'sifce_' });

// RNF-R1 (respuesta ≤ 3 s) y RNF-F1 (errores): duración de cada petición HTTP.
const httpDuration = new client.Histogram({
  name: 'sifce_http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP a la API, por ruta y código de respuesta',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10],
  registers: [register],
});

// RF01 + RNF-S3/S4: resultados de inicio de sesión y bloqueos por fuerza bruta.
const logins = new client.Counter({
  name: 'sifce_logins_total',
  help: 'Intentos de inicio de sesión por resultado (success, invalid, locked, inactive)',
  labelNames: ['result'],
  registers: [register],
});
const lockouts = new client.Counter({
  name: 'sifce_account_lockouts_total',
  help: 'Cuentas bloqueadas por superar el máximo de intentos fallidos',
  registers: [register],
});

// RF08: postulaciones recibidas.
const applications = new client.Counter({
  name: 'sifce_applications_created_total',
  help: 'Postulaciones creadas o reactivadas por los candidatos',
  registers: [register],
});

// RF09 + RNF-F4: análisis de IA por proveedor y resultado, y su duración.
const aiAnalyses = new client.Counter({
  name: 'sifce_ai_analyses_total',
  help: 'Análisis de compatibilidad ejecutados, por proveedor de IA y resultado (completed, failed)',
  labelNames: ['provider', 'result'],
  registers: [register],
});
const aiDuration = new client.Histogram({
  name: 'sifce_ai_analysis_duration_seconds',
  help: 'Duración de cada análisis de compatibilidad',
  labelNames: ['provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 40],
  registers: [register],
});

// Los contadores con etiquetas no existen hasta su primer evento, y Prometheus
// necesita un valor "antes" para calcular cuánto aumentaron. Se crean en 0
// para que el primer login fallido o el primer análisis sí se cuenten (y las
// gráficas muestren 0 en vez de "sin datos").
['success', 'invalid', 'locked', 'inactive'].forEach((result) => logins.inc({ result }, 0));
['completed', 'failed'].forEach((result) => aiAnalyses.inc({ provider: aiProvider.name, result }, 0));

// Proveedor de IA configurado (valor 1 con la etiqueta del proveedor activo).
const aiInfo = new client.Gauge({
  name: 'sifce_ai_provider_info',
  help: 'Proveedor de IA configurado en esta réplica',
  labelNames: ['provider'],
  registers: [register],
});
aiInfo.set({ provider: aiProvider.name }, 1);

// RNF-D1 / RNF-F2: ¿la API logra hablar con la base de datos? Se mide en el
// momento en que Prometheus pide las métricas.
new client.Gauge({
  name: 'sifce_database_up',
  help: '1 si la API puede consultar PostgreSQL, 0 si no',
  registers: [register],
  async collect() {
    try {
      await db.query('SELECT 1');
      this.set(1);
    } catch (err) {
      this.set(0);
    }
  },
});

// Middleware: mide cada petición. Se usa la ruta "patrón" (/vacancies/:id),
// no la URL real, para no crear una serie de datos por cada id.
function httpMetricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'sin_ruta';
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
}

module.exports = {
  register,
  httpMetricsMiddleware,
  recordLogin: (result) => logins.inc({ result }),
  recordLockout: () => lockouts.inc(),
  recordApplication: () => applications.inc(),
  startAiTimer: () => aiDuration.startTimer({ provider: aiProvider.name }),
  recordAiAnalysis: (result) => aiAnalyses.inc({ provider: aiProvider.name, result }),
};
