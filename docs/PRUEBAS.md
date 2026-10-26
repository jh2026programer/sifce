# Pruebas

**Estado real de este apartado**: el proyecto tiene **pruebas manuales**
(registro de la sección 1) y una **suite de 138 pruebas automáticas** de la
API con Jest + Supertest (sección 2), que corre sola en CircleCI en cada push
(etapa 4 · TEST del ciclo de vida). La sección 3 deja lo que aún no se
automatizó (frontend y extremo a extremo).

## 1. Pruebas manuales ejecutadas (registro real)

Entorno: PostgreSQL 16 local + `node whatever/server.js` + datos del script de
siembra (`npm run db:seed`).

| # | Escenario | Resultado |
|---|---|---|
| 1 | `GET /health` | `200 OK` |
| 2 | Login con credenciales válidas (reclutador) | Token JWT emitido |
| 3 | Listado de vacantes de la propia empresa | 2 vacantes devueltas |
| 4 | Ranking de una vacante (RF10) | Candidatos ordenados por `overall_score` descendente |
| 5 | Comparación de 2 candidatos (RF12) | Fortalezas/brechas devueltas correctamente para cada uno |
| 6 | Cambio de etapa de una postulación (RF13) | Estado actualizado + historial registrado |
| 7 | Detalle de postulación con explicación (RF11) | Explicación, fortalezas y brechas coherentes con los puntajes |
| 8 | Registro público de una segunda empresa | Empresa y administrador creados |
| 9 | **Aislamiento entre empresas**: admin de la empresa 2 intenta ver vacante/postulaciones de la empresa 1 | `404 Recurso no encontrado` en ambos casos; listado propio vacío |
| 10 | Registro de un candidato nuevo + completar perfil | Perfil creado correctamente |
| 11 | Agregar habilidad/experiencia/idioma **sin** campos opcionales | ❌ Falló la primera vez (`NOT NULL constraint`) → **corregido** → ✅ pasó al reintentar |
| 12 | Postularse sin haber cargado CV | Rechazado con mensaje claro (`400`) |
| 13 | Cargar un PDF real (generado en el momento) | Cargado y extraído correctamente |
| 14 | Postularse con CV cargado | Postulación creada, análisis de IA disparado |
| 15 | Postulación duplicada a la misma vacante | Rechazada con `409` |
| 16 | Cargar un archivo `.pdf` corrupto/no válido | Aceptado como archivo, pero marcado `extraction_failed` con mensaje claro (degradación controlada, no caída del sistema) |
| 17 | Superadmin desactiva una empresa | ❌ Sus usuarios podían seguir iniciando sesión la primera vez → **corregido** → ✅ login bloqueado con `403` tras la corrección |
| 18 | Reactivar la empresa | Login vuelve a funcionar |
| 19 | `npm run build` del frontend | Compiló sin errores (129 módulos) |
| 20 | `vite preview` sirviendo el build | HTML e íconos servidos correctamente en `4173` |
| 21 | Candidata vinculada a 2 empresas: `GET /candidates/me/companies` | Devuelve exactamente las 2 empresas vinculadas |
| 22 | `GET /vacancies/browse` sin encabezado `X-Active-Company` | `400` con mensaje claro pidiendo seleccionar un entorno |
| 23 | Mismo endpoint con el entorno de la Empresa A vs. la Empresa B (misma candidata) | Dos listas de vacantes completamente distintas, sin mezcla |
| 24 | `GET /applications/mine` en ambos entornos | 1 postulación en la Empresa A, 0 en la Empresa B — confirma que las postulaciones no se mezclan entre entornos del mismo candidato |
| 25 | Ver el detalle de una vacante de la Empresa B usando el encabezado de la Empresa A | `404` (aislamiento cruzado, incluso para la misma persona) |
| 26 | Postularse a una vacante de la Empresa B enviando el encabezado de la Empresa A | `404` (rechazado antes de crear la postulación) |
| 27 | Registro de candidato con código de empresa válido en el mismo paso | Cuenta y vínculo creados en una sola transacción |
| 28 | Registro de candidato con código inválido | `404` con mensaje claro, y **la cuenta no queda creada** (rollback verificado con un intento de login posterior) |
| 29 | Vincularse a una empresa ya vinculada | `409` |
| 30 | Vincularse con el código en minúsculas | Aceptado (normalización a mayúsculas verificada) |
| 31 | `GET /companies/mine` como administrador | Incluye `access_code` |
| 32 | `PATCH /companies/mine/access-code` (regenerar) | Nuevo código devuelto; el código anterior deja de servir para nuevas vinculaciones (`404`), pero los candidatos ya vinculados conservan el acceso |
| 33 | `npm run build` del frontend tras el rediseño | Compiló sin errores (131 módulos) |
| 34 | Crear empresa como superadmin SIN credenciales de administrador | `400` con mensaje explicando por qué son obligatorias (antes de la corrección, esto creaba una empresa inutilizable) |
| 35 | Crear empresa como superadmin CON credenciales de administrador | Empresa y administrador creados; **login real verificado** con esas credenciales inmediatamente después |
| 36 | Editar una empresa como superadmin (`PATCH /companies/:id`) | Cambios reflejados correctamente |
| 37 | `GET /reports/summary` como reclutador | Devuelve conteos por estado de vacante, embudo por etapa, compatibilidad promedio, top vacantes y postulaciones recientes coherentes con los datos demo |
| 38 | `GET /reports/export/applications` | Devuelve el total correcto de filas para exportar a CSV |
| 39 | `npm run build` del frontend tras agregar `recharts` y el rediseño completo | Compiló sin errores (722 módulos) |
| 40 | Login con credenciales correctas, OTP habilitado | Responde `requiresOtp: true` + `otpId`, sin emitir token todavía; código visible en la terminal del backend |
| 41 | Verificar OTP con código incorrecto | `400` con contador de intentos restantes |
| 42 | Verificar OTP con el código correcto | Token de sesión emitido recién ahí, historial de actividad registrado |
| 43 | Reenviar OTP inmediatamente después de pedirlo | `429` por cooldown de 30 segundos |
| 44 | 5 intentos de login con contraseña incorrecta | Cuenta bloqueada 15 minutos; el 6.º intento con la contraseña **correcta** también es rechazado mientras dura el bloqueo |
| 45 | `GET /auth/public-config` con CAPTCHA desactivado (valor por defecto) | `captchaEnabled: false`, `captchaSiteKey: null` |
| 46 | Registro de candidato sin token de CAPTCHA, con CAPTCHA desactivado | Se crea la cuenta sin exigir token (comportamiento esperado) |
| 47 | `verifyCaptcha()` con CAPTCHA activado pero sin token / sin clave secreta | Falla con mensajes específicos para cada caso, sin intentar contactar a Google si falta la clave |
| 48 | `npm run build` del frontend con OTP + CAPTCHA + rediseño oscuro completo | Compiló sin errores (725 módulos) |
| 49 | Candidato retira su propia postulación | Estado pasa a "retirado", historial registrado |
| 50 | Otro candidato intenta retirar una postulación que no es suya | `404` (no revela que existe, mismo criterio que el resto del sistema) |
| 51 | Retirar dos veces la misma postulación | `409` en el segundo intento |
| 52 | Volver a postularse a la misma vacante tras retirarse | Reactiva el mismo registro (no crea uno duplicado), análisis de IA recalculado desde cero, historial conserva los tres pasos (postulado → retirado → postulado) |
| 53 | Reclutador ve una postulación retirada en la lista de la vacante | Se muestra como insignia de solo lectura, sin el menú desplegable de etapas (evita que la reactiven por accidente desde ahí) |

La verificación real contra la API de Google reCAPTCHA (con claves reales
configuradas) no se probó en esta ronda — queda como limitación declarada,
igual que con los proveedores de IA reales en su momento.

Los escenarios #22 a #26 son la verificación directa del requisito del
cliente ("eliminar la visualización pública y cruzada de empresas y
vacantes"): se probaron con la **misma cuenta de candidato** operando en dos
entornos distintos, no solo con cuentas distintas.

Los errores #11 y #17 (encontrados en la ronda de pruebas original) son
reales y se encontraron **gracias** a estas pruebas; quedaron corregidos en
el código entregado, no son una limitación pendiente.

## 2. Pruebas automáticas de la API (Jest + Supertest) — implementadas

Herramientas (etapa 4 · TEST del ciclo de vida):
- **Jest**: framework de pruebas (equivalente en JavaScript a JUnit o pytest).
- **Supertest**: hace peticiones HTTP reales a la app Express sin abrir un puerto.
- **jest-junit**: genera `whatever/reports/junit.xml`, que CircleCI muestra en su pestaña "Tests".

### Cómo correrlas

```bash
npm test            # desde la raíz: 25 de microservicios + 113 de la API
```

Necesita PostgreSQL con las credenciales de `whatever/.env`. Las pruebas
trabajan en un schema propio, `sifce_test`, que se borra y se vuelve a crear
(tablas + datos demo) al inicio de cada archivo de prueba: **nunca tocan los
datos reales del schema `public`**. La IA corre en modo `mock` (sin costo) y
CAPTCHA/OTP se desactivan (ver `whatever/tests/setup/env.js`).

En CircleCI el job `test` levanta su propia base PostgreSQL 16 temporal y
corre exactamente el mismo comando después de que el job `build` pasa.

### Qué cubren

| Archivo (`whatever/tests/`) | Requisitos | Qué verifica |
|---|---|---|
| `auth.test.js` | RF01, RF02, RF03, RNF-S2/S3 | login de los 7 usuarios demo, errores genéricos, token inválido, bloqueo tras 5 intentos, registro de candidato (con código) y de empresa, cuenta propia |
| `isolation.test.js` | RNF-S4, RF16, RF17 | una empresa nunca ve ni modifica vacantes, postulaciones, candidatos, CV, criterios, etapas o usuarios de otra (404); entornos del candidato con `X-Active-Company`; rotación del código de acceso |
| `selection-process.test.js` | RF05, RF07–RF13, RF17 | vacantes, carga de PDF, postulación, análisis de IA completo, ranking ordenado, comparación, cambio de etapa con historial, retiro y re-postulación |
| `company-admin.test.js` | RF14, RF15, RF18, RF19, reportes | información de la empresa, usuarios internos, criterios, etapas, resumen de reportes y exportación CSV |
| `superadmin.test.js` | RF04, gestión global | empresas (creación operable, desactivación que corta sesiones) y gestión global de usuarios (filtros, desbloqueo, activar/desactivar, contraseña) |
| `candidate-profile.test.js` | RF06 | perfil y sus 5 secciones, valores por defecto, vinculación por código |
| `microservicios.test.js` | RF07, RF09, RF11 | la API con los dos microservicios encendidos de verdad (subir CV → postularse → compatibilidad) y su respaldo interno cuando se apagan |

Además, `microservicios/tests/` tiene 25 pruebas propias de los dos
microservicios (validador, servicio y endpoint de cada uno); ver
`docs/MICROSERVICIOS.md`.

Encontraron y se corrigió un error real: la extracción de texto de los PDF
fallaba cuando el archivo llegaba en un entorno aislado (`bad XRef entry`);
ahora el servicio que lee los PDF (hoy `microservicios/validador-cv/service.js`) entrega a la librería los bytes como
`Uint8Array` propio.

## 3. Lo que aún no se automatizó

### Frontend — Vitest + React Testing Library
- Render de `ProtectedRoute` con/sin sesión y con rol incorrecto.
- Formularios (login, registro, vacante, perfil) con validación de campos obligatorios.
- Estados de carga/error de cada página que consume la API (mockeando `axios`).

### Extremo a extremo — Playwright o Cypress
- Flujo completo candidato: registro → perfil → CV → postulación → ver estado.
- Flujo completo reclutador: crear vacante → ver postulación → ver ranking → cambiar etapa.

Estas pruebas de interfaz y de extremo a extremo quedan como siguiente
iteración; las de la API (sección 2) ya están implementadas y en CI.
