// Pruebas del microservicio validador de hojas de vida: validador, servicio y endpoint.
const request = require('supertest');
const app = require('../validador-cv/server');
const { validarArchivo, MAX_BYTES } = require('../validador-cv/validator');
const { analizarCv, detectarHabilidades } = require('../validador-cv/service');
const { buildPdf } = require('./pdf');

const CV = buildPdf([
  'Laura Perez - Desarrolladora',
  'Correo: laura.perez@correo.demo  Telefono: +57 310 555 1234',
  'Experiencia con Node.js, React, PostgreSQL y Docker',
  'Trabajo en equipo e Ingles avanzado',
]);
const PDF_SIN_TEXTO = buildPdf(['']);

describe('validator.js', () => {
  test('acepta un PDF real', () => {
    expect(validarArchivo({ buffer: CV, contentType: 'application/pdf' })).toEqual([]);
  });

  test('rechaza otro tipo de contenido', () => {
    const errores = validarArchivo({ buffer: CV, contentType: 'text/plain' });
    expect(errores).toEqual(['El archivo debe enviarse como PDF (Content-Type: application/pdf).']);
  });

  test('rechaza un archivo vacío', () => {
    expect(validarArchivo({ buffer: Buffer.alloc(0), contentType: 'application/pdf' })).toEqual([
      'El archivo está vacío.',
    ]);
  });

  test('rechaza un archivo que solo dice ser PDF', () => {
    const errores = validarArchivo({ buffer: Buffer.from('hola, no soy un pdf'), contentType: 'application/pdf' });
    expect(errores).toEqual(['El contenido no es un PDF real (le falta la firma "%PDF-").']);
  });

  test('rechaza un archivo de más de 5 MB', () => {
    const grande = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(MAX_BYTES)]);
    expect(validarArchivo({ buffer: grande, contentType: 'application/pdf' })).toEqual([
      'El archivo supera el tamaño máximo de 5 MB.',
    ]);
  });
});

describe('service.js', () => {
  test('extrae el texto y detecta correo, teléfono y habilidades', async () => {
    const r = await analizarCv(CV);
    expect(r.valido).toBe(true);
    expect(r.texto).toContain('Laura Perez');
    expect(r.datos.paginas).toBe(1);
    expect(r.datos.correo).toBe('laura.perez@correo.demo');
    expect(r.datos.telefono).toBe('+57 310 555 1234');
    expect(r.datos.habilidades).toEqual(
      expect.arrayContaining(['node.js', 'react', 'postgresql', 'docker', 'trabajo en equipo', 'ingles'])
    );
  });

  test('un PDF sin texto (escaneado) no es válido', async () => {
    const r = await analizarCv(PDF_SIN_TEXTO);
    expect(r.valido).toBe(false);
    expect(r.errores[0]).toMatch(/no contiene texto legible/);
  });

  test('un PDF dañado no rompe el servicio', async () => {
    const r = await analizarCv(Buffer.from('%PDF-1.4\nesto no es un pdf completo'));
    expect(r.valido).toBe(false);
    expect(r.errores[0]).toMatch(/No fue posible procesar el PDF/);
  });

  test('detecta habilidades sin importar tildes ni mayúsculas, y sin falsos positivos', () => {
    expect(detectarHabilidades('Atención al Cliente y JAVA')).toEqual(['java', 'atencion al cliente']);
    expect(detectarHabilidades('Uso de JavaScript')).toEqual(['javascript']);
  });
});

describe('server.js (endpoint)', () => {
  test('GET /salud responde', async () => {
    const res = await request(app).get('/salud');
    expect(res.body).toEqual({ ok: true, servicio: 'validador-cv' });
  });

  test('POST /validar-cv con un CV válido devuelve texto y datos', async () => {
    const res = await request(app).post('/validar-cv').set('Content-Type', 'application/pdf').send(CV);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.resultado.texto).toContain('Laura Perez');
    expect(res.body.resultado.datos.correo).toBe('laura.perez@correo.demo');
  });

  test('POST /validar-cv con un archivo que no es PDF responde 400', async () => {
    const res = await request(app).post('/validar-cv').set('Content-Type', 'text/plain').send('hola');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.errores).toHaveLength(2);
  });

  test('POST /validar-cv con un PDF sin texto responde 422', async () => {
    const res = await request(app).post('/validar-cv').set('Content-Type', 'application/pdf').send(PDF_SIN_TEXTO);
    expect(res.status).toBe(422);
    expect(res.body.errores[0]).toMatch(/no contiene texto legible/);
  });
});
