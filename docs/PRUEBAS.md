# Pruebas

**Estado real de este apartado**: durante la construcción de este prototipo
se ejecutaron pruebas manuales de extremo a extremo contra un backend vivo y
una base de datos PostgreSQL real (no simulada), y se corrigieron los
errores que esas pruebas encontraron. **No se escribió una suite de pruebas
automatizadas** (Jest/Supertest) por el alcance de tiempo de este prototipo.
Esta sección documenta (1) exactamente qué se probó manualmente y qué se
encontró, y (2) una estrategia concreta para automatizar esas mismas pruebas
más adelante.

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

## 2. Estrategia de pruebas automatizadas recomendada (no incluida en el código)

Para un entorno de CI/CD, se recomienda:

### Backend — Jest + Supertest
```
npm install --save-dev jest supertest --prefix backend
```
Casos sugeridos, agrupados como en la matriz de trazabilidad:
- **Autenticación**: login válido/inválido, cuenta desactivada, empresa desactivada, token expirado/manipulado.
- **Roles**: cada ruta protegida devuelve 403 para roles no permitidos.
- **Aislamiento entre empresas**: para cada recurso (vacantes, postulaciones, candidatos, criterios, etapas, usuarios), un usuario de la empresa B nunca puede leer/modificar un recurso de la empresa A.
- **Vinculación privada y entornos del candidato**: registro con código válido/inválido/duplicado, listado de empresas vinculadas, rechazo sin `X-Active-Company`, y — el caso más importante — una misma candidata vinculada a 2 empresas no puede ver ni mezclar vacantes/postulaciones entre ambos entornos.
- **CRUD de vacantes**: creación, edición, cambio de estado, validaciones de campos obligatorios.
- **Carga de CV**: PDF válido, tipo de archivo incorrecto, tamaño excedido, extracción fallida.
- **Postulación**: éxito, duplicada, vacante inactiva, sin CV.
- **Análisis de IA (proveedor mock)**: dado un perfil y una vacante conocidos, el puntaje por categoría es el esperado (pruebas de regresión sobre `mockProvider.js`, que es determinístico por diseño — ideal para tests unitarios sin mocks adicionales).
- **Ranking y comparación**: orden correcto, validación de "misma empresa"/"misma vacante".
- **Cambio de etapa**: transición válida + registro en `application_stage_history`.
- **Criterios y etapas**: pesos por defecto (25/25/25/25) cuando no hay configuración propia.

### Frontend — Vitest + React Testing Library
- Render de `ProtectedRoute` con/sin sesión y con rol incorrecto.
- Formularios (login, registro, vacante, perfil) con validación de campos obligatorios.
- Estados de carga/error de cada página que consume la API (mockeando `axios`).

### Extremo a extremo — Playwright o Cypress
- Flujo completo candidato: registro → perfil → CV → postulación → ver estado.
- Flujo completo reclutador: crear vacante → ver postulación → ver ranking → cambiar etapa.

Ninguno de estos archivos de prueba automatizada se generó en este prototipo;
esta sección deja el plan concreto para hacerlo en una siguiente iteración.
