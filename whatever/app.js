// Construye la aplicación Express (middleware + rutas) SIN ponerla a escuchar
// en un puerto. server.js la arranca; las pruebas automáticas (tests/) la
// usan directamente con Supertest.
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// RNF-S1: en producción, este servidor debe ejecutarse detrás de un proxy/
// balanceador con HTTPS (ver docs/DESPLIEGUE.md). Express no termina TLS por
// sí mismo.
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
