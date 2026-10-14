// Error controlado con código HTTP asociado. El middleware de errores central
// (middleware/errorHandler.js) usa esto para responder mensajes claros al
// usuario sin exponer stack traces (Sección 21 / RNF-F1).
class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
