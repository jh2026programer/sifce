const config = require('../config/env');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');

// Código de PostgreSQL cuando un valor no tiene el formato del tipo de la
// columna (ej. un id que no es un UUID válido en la URL).
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

// Middleware central de errores. Toda excepción de la app termina aquí
// (vía asyncHandler o next(err)). Nunca se envía el stack trace al cliente;
// solo se imprime en el log del servidor para depuración (Sección 21 / RNF-F1).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.code === PG_INVALID_TEXT_REPRESENTATION) {
    err = new AppError('Identificador o valor con formato inválido.', 400); // eslint-disable-line no-param-reassign
  }

  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  view.error(res, statusCode, {
    message: isOperational ? err.message : 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.',
    details: isOperational ? err.details || undefined : undefined,
    stack: config.nodeEnv === 'development' && !isOperational ? err.stack : undefined,
  });
}

function notFoundHandler(req, res) {
  view.error(res, 404, { message: 'Recurso no encontrado.' });
}

module.exports = { errorHandler, notFoundHandler };
