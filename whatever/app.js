// Construye la aplicación Express (middleware + rutas) SIN ponerla a escuchar
// en un puerto. server.js la arranca; las pruebas automáticas (tests/) la
// usan directamente con Supertest.
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const metrics = require('./services/metrics');

const app = express();

// RNF-S1: en producción, este servidor debe ejecutarse detrás de un proxy/
// balanceador con HTTPS (ver docs/DESPLIEGUE.md). Express no termina TLS por
// sí mismo.
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(metrics.httpMetricsMiddleware);

// Métricas para Prometheus (etapa 7 · OPERATE). Fuera de /api a propósito:
// nginx solo publica /api/, así que /metrics únicamente es accesible dentro
// de la red interna del stack, donde lo lee Prometheus.
app.get('/metrics', async (req, res, next) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (err) {
    next(err);
  }
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
