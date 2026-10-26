// Pruebas del microservicio de compatibilidad: validador, servicio y endpoint.
const request = require('supertest');
const app = require('../compatibilidad/server');
const { validarSolicitud } = require('../compatibilidad/validator');
const { calcularCompatibilidad, clasificar } = require('../compatibilidad/service');

const PESOS_IGUALES = { formacion: 25, experiencia: 25, habilidades: 25, idiomas: 25 };
const PUNTAJES = { formacion: 100, experiencia: 80, habilidades: 60, idiomas: 40 };

describe('validator.js', () => {
  test('acepta una solicitud completa', () => {
    expect(validarSolicitud({ puntajes: PUNTAJES, pesos: PESOS_IGUALES })).toEqual([]);
  });

  test('rechaza puntajes fuera de 0-100 y criterios faltantes', () => {
    const errores = validarSolicitud({
      puntajes: { formacion: 120, experiencia: -1, habilidades: 'mucho' },
      pesos: PESOS_IGUALES,
    });
    expect(errores).toEqual([
      'El puntaje de "formacion" debe estar entre 0 y 100.',
      'El puntaje de "experiencia" debe estar entre 0 y 100.',
      'El puntaje de "habilidades" debe ser un número.',
      'Falta el puntaje de "idiomas".',
    ]);
  });

  test('exige que los pesos sumen 100', () => {
    const errores = validarSolicitud({
      puntajes: PUNTAJES,
      pesos: { formacion: 50, experiencia: 50, habilidades: 50, idiomas: 0 },
    });
    expect(errores).toEqual(['Los pesos deben sumar 100 (suman 150).']);
  });

  test('tolera decimales de pesos normalizados', () => {
    const tercio = 100 / 3;
    const pesos = { formacion: tercio, experiencia: tercio, habilidades: tercio, idiomas: 0 };
    expect(validarSolicitud({ puntajes: PUNTAJES, pesos })).toEqual([]);
  });

  test('rechaza un cuerpo que no es objeto', () => {
    expect(validarSolicitud(null)).toHaveLength(1);
    expect(validarSolicitud([1, 2])).toHaveLength(1);
  });
});

describe('service.js', () => {
  test('con pesos iguales es el promedio simple', () => {
    const r = calcularCompatibilidad({ puntajes: PUNTAJES, pesos: PESOS_IGUALES });
    expect(r.compatibilidad).toBe(70);
    expect(r.nivel).toBe('media');
    expect(r.detalle).toHaveLength(4);
    expect(r.detalle[0]).toEqual({ criterio: 'formacion', puntaje: 100, peso: 25, aporte: 25 });
  });

  test('los pesos de la empresa cambian el resultado', () => {
    const pesos = { formacion: 10, experiencia: 10, habilidades: 70, idiomas: 10 };
    expect(calcularCompatibilidad({ puntajes: PUNTAJES, pesos }).compatibilidad).toBe(64);
  });

  test('clasifica en alta, media y baja', () => {
    expect(clasificar(75)).toBe('alta');
    expect(clasificar(74.99)).toBe('media');
    expect(clasificar(50)).toBe('media');
    expect(clasificar(49.99)).toBe('baja');
    expect(clasificar(0)).toBe('baja');
  });
});

describe('server.js (endpoint)', () => {
  test('GET /salud responde', async () => {
    const res = await request(app).get('/salud');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, servicio: 'compatibilidad' });
  });

  test('POST /compatibilidad calcula el resultado', async () => {
    const res = await request(app).post('/compatibilidad').send({ puntajes: PUNTAJES, pesos: PESOS_IGUALES });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.resultado.compatibilidad).toBe(70);
    expect(res.body.resultado.nivel).toBe('media');
  });

  test('POST /compatibilidad con datos inválidos responde 400 con los errores', async () => {
    const res = await request(app).post('/compatibilidad').send({ puntajes: PUNTAJES });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, errores: ['Falta el objeto "pesos".'] });
  });

  test('JSON mal formado responde 400 en JSON', async () => {
    const res = await request(app).post('/compatibilidad').set('Content-Type', 'application/json').send('{malo');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});
