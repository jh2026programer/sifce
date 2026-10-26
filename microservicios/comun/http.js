// Utilidades HTTP compartidas por los dos microservicios.

// Imprime cada petición en la consola del microservicio (método, ruta,
// código y duración), para ver en vivo cuándo lo llama SIFCE.
function registrarPeticiones(nombre) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next(); // pruebas sin ruido
    const inicio = Date.now();
    res.on('finish', () => {
      const hora = new Date().toLocaleTimeString('es-CO', { hour12: false });
      console.log(`[${nombre}] ${hora}  ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`);
    });
    next();
  };
}

// Errores que no son de validación: JSON mal formado, cuerpo demasiado
// grande o una falla inesperada. Siempre se responde JSON, nunca HTML.
// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, errores: ['El cuerpo de la solicitud no es un JSON válido.'] });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, errores: ['La solicitud supera el tamaño máximo permitido.'] });
  }
  console.error(err);
  return res.status(500).json({ ok: false, errores: ['Error interno del microservicio.'] });
}

module.exports = { registrarPeticiones, manejarErrores };
