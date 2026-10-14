// Envuelve un controlador async y reenvía cualquier excepción a next(),
// donde el middleware central de errores decide cómo responder.
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
