# SIFCE — Contexto para Claude Code

> **Nota para Claude Code:** este proyecto lo veníamos desarrollando en una conversación con Claude (chat). Ahora continuamos el trabajo contigo en Claude Code para tener mejor desempeño trabajando directamente sobre el código. Este archivo resume todo lo construido hasta hoy para que tengas el contexto completo.
>
> **Estado (2026-10-13):** ya se hizo el ajuste de **arquitectura** (MVW visible en carpetas, ver sección 3). Queda pendiente el de **ciclo de vida del software** (sección 10): espera instrucciones antes de cambiar algo ahí.

---

## 1. Qué es SIFCE

**Sistema Inteligente de Filtro y Contratación Empresarial.** Prototipo web funcional construido a partir de un documento SRS IEEE 830 ("Taller 1 Final Nuevas Tecnologías Grupo B191.docx") con **19 RF y 17 RNF**.

- Plataforma central con **múltiples entornos privados e independientes por empresa** (no es bolsa de empleo pública, ni red social, ni contrata automáticamente).
- La IA analiza hojas de vida contra los requisitos de la vacante y genera compatibilidad, ranking, fortalezas y brechas. **La decisión final siempre es humana.**
- Roles: **Superadministrador**, **Administrador de Empresa**, **Reclutador**, **Candidato**.

## 2. Stack y restricciones obligatorias

- Frontend: **React + Vite** (JavaScript, sin TypeScript).
- Backend: **Node.js + Express**, API REST, JSON.
- Base de datos: **PostgreSQL** (driver `pg`, SQL directo, sin ORM — es deliberado para controlar el filtro por `company_id`).
- Arquitectura: **MVW** (Model – View – Whatever).
- Editor: Visual Studio Code. Entorno del usuario: **Windows + PowerShell**.
- No cambiar tecnologías principales. No meter TypeScript. No hardcodear secretos.

## 3. Arquitectura MVW en carpetas (en la raíz)

Las tres carpetas principales del proyecto SON las tres capas (detalle en `docs/ARQUITECTURA.md`):

| Capa | Carpeta | Contenido |
|---|---|---|
| **Model** | `model/` | `schema.sql`, `db.js` (pool + `withTransaction`), un `*.model.js` por entidad con TODO el SQL, `scripts/` (dbSetup, seed) |
| **Whatever** | `whatever/` | API Express: `server.js`, `config/`, `routes/`, `middleware/`, `controllers/`, `services/`, `presenters/` (forma del JSON), `utils/`, `uploads/` |
| **View** | `view/` | App React + Vite completa: `src/pages`, `components`, `styles`, `api`, `context`, `routes`, `hooks`, `utils`, `constants` |

Reglas: **ningún archivo de `whatever/` escribe SQL** (siempre llama a un modelo); los modelos no conocen `req`/`res` ni lanzan errores HTTP (devuelven filas o `null`); `view/` solo habla con la API por HTTP.

**npm workspaces** (`package.json` de la raíz): un solo `npm install` en la raíz y un único `node_modules` compartido (así `model/` encuentra `pg`). Todos los comandos se ejecutan desde la raíz: `npm run dev:api`, `npm run dev:web`, `npm run db:create`, `npm run db:seed`, `npm run build:web`, `npm run start:api`.

Configuración: solo `whatever/.env` (lo usan la API y los scripts de `model/`; `whatever/config/env.js` lo lee siempre desde `whatever/` sin importar la carpeta actual) y `view/.env` (`VITE_API_URL`). `RESUME_UPLOAD_DIR` relativo se resuelve desde `whatever/`.

Estructura raíz:

```
sifce/
  package.json, package-lock.json, node_modules/   (workspaces)
  model/       (schema.sql, db.js, *.model.js, scripts/)
  whatever/    (API Express, .env)
  view/        (React + Vite, .env)
  docs/        (ARQUITECTURA, MODULO_IA, SEGURIDAD, TRAZABILIDAD, PRUEBAS, DESPLIEGUE)
  README.md, CLAUDE.md, .gitignore, .env.example (resumen de ambos .env)
```

Historia: primero se organizó MVW dentro de cada app (`backend/src/{model,view,whatever}`, `frontend/src/...`); el 2026-10-13 el usuario pidió pasar a esta estructura en la raíz. Respaldos fuera del proyecto: `../sifce_respaldo_2026-10-13/` (original), `../sifce_respaldo_2026-10-13_mvw_por_app/` (MVW por app), `../sifce_legacy_respaldo/` (código muerto retirado).

## 4. Funcionalidades construidas (cronología resumida)

1. **Versión base completa**: autenticación JWT + bcrypt, registro, perfiles de candidato (formación, experiencia, habilidades, idiomas, certificaciones), CRUD de vacantes, carga de CV PDF (multer, 5 MB, pdf-parse), postulaciones, análisis IA, compatibilidad ponderada, ranking, comparación de candidatos, criterios de evaluación configurables, etapas del proceso configurables, historial de etapas, logs de actividad, manejo centralizado de errores.
2. **Modelo privado segmentado por empresa**:
   - Cada empresa tiene un **código de acceso único** (`companies.access_code`, regenerable).
   - El candidato tiene **una sola cuenta** y se vincula a empresas con el código (`candidate_company_links`).
   - El candidato **selecciona el entorno activo**; el header `X-Active-Company` se revalida en backend (`middleware/companyContext.js`).
   - No hay listado público ni cruzado entre empresas. Aislamiento en `utils/scope.js` (devuelve 404, no 403, para no filtrar existencia).
3. **Diseño profesional** + **módulo de Reportes** para admin (`/reports/summary`, exportación CSV de postulaciones, gráficas con Recharts).
4. **Superadministrador**: crear empresa **con credenciales del administrador** (empresa + admin + etapas en una sola transacción), editar empresas, activar/desactivar.
5. **Logo SIFCE** en landing, login y header (`view/public/sifce-logo.png` + favicons).
6. **IA real** mediante adaptador: `mock | groq | anthropic | openai | http`.
7. **Seguridad**: bloqueo por intentos fallidos (5 intentos / 15 min, activo), **OTP por correo** (implementado pero **desactivado** por defecto), **Google reCAPTCHA v2** en registros (desactivado por defecto, se activa con llaves en `.env`).
8. **Candidato puede retirarse de una postulación** (estado `retirado`); si vuelve a postularse se **reactiva** el mismo registro (por la restricción UNIQUE vacante+candidato). No se puede retirar si ya está `seleccionado`.
9. **Superadmin gestiona TODOS los usuarios** de la plataforma (`/users/all`, pantalla `/superadmin/users`): buscar/filtrar, editar nombre, activar/desactivar (nunca a un superadmin), restablecer contraseña, desbloquear cuenta.
10. **Rediseño visual** con paleta nueva y corrección de botones invisibles (texto blanco sobre blanco) en landing y cerrar sesión.

## 5. Módulo de IA

- Selector: `whatever/services/ai/aiProvider.js` según `AI_PROVIDER` en `.env`.
- Proveedores: `mockProvider.js` (modo DEMO claramente identificado), `groqProvider.js` (gratis, modelo por defecto `openai/gpt-oss-20b`), `anthropicProvider.js`, `openaiProvider.js`, `httpProvider.js`.
- Salida estructurada vía tool use / function calling.
- **Compatibilidad global = promedio ponderado** de formación, experiencia, habilidades e idiomas con los pesos configurados por cada empresa (por defecto 25/25/25/25).
- Resultados guardados en `ai_analysis_results`; hay botón para **reanalizar**.
- El servidor muestra al arrancar qué proveedor está activo y avisa si falta la API key.
- Ojo: nodemon **no recarga `.env`** — reiniciar el backend tras cambiarlo.

## 6. Base de datos (resumen)

Enums: `user_role`, `company_status`, `vacancy_status`, `vacancy_modality`, `application_status` (incluye `retirado`), `resume_status`, `ai_analysis_status`.

Tablas: `companies`, `users` (con `failed_login_attempts`, `locked_until`), `login_otp_codes`, `candidate_profiles` + `candidate_education/experience/skills/languages/certifications`, `candidate_company_links`, `resumes`, `evaluation_criteria`, `selection_stages`, `vacancies` (JSONB de habilidades/idiomas), `applications`, `application_stage_history`, `ai_analysis_results`, `activity_logs`.

**No hay migraciones**: cualquier cambio de esquema exige borrar y recrear la BD (`npm run db:create` + `npm run db:seed`).

## 7. Diseño visual actual

- Paleta carbón + cobre + verde azulado: `--color-primary: #b4530c`, `--color-accent: #0e7c72`, `--sidebar-bg: #211d18`.
- Tipografías Sora (títulos) + Inter (texto). Estilos globales en `view/src/styles/index.css`; colores de gráficas (Recharts) en `view/styles/chartTheme.js`.
- `.btn-outline-invert` para botones sobre fondos oscuros; menú desplegable de usuario con avatar de iniciales.
- El usuario se frustró porque varias veces "no veía los cambios" de diseño: **verifica visualmente** cualquier cambio de UI antes de darlo por hecho.

## 8. Datos demo (seed)

- Superadmin, empresas **TechNova** (código `TECHNOVA24`) y **Grupo Andino Retail** (`ANDINO24`), sus administradores, un reclutador, 3 candidatos con CV PDF generados (María vinculada a ambas empresas), vacantes, postulaciones y análisis demo.
- Credenciales completas en el `README.md`.

## 9. Pendientes y limitaciones conocidas

- Pruebas automáticas solo de la API (101, Jest + Supertest en `whatever/tests/`, `npm test`); sin pruebas automáticas de la interfaz ni E2E.
- Sin migraciones de BD.
- Desplegado solo en el PC del usuario con Docker Swarm (no en la nube). HTTPS no configurado.
- No probado con servicios reales: reCAPTCHA, SMTP, pruebas de carga, multi-navegador.
- OTP queda para después (el usuario lo pidió así).

## 10. Ciclo de vida (DevOps / Trello)

El equipo lleva el proyecto en un tablero de Trello con las fases **PLAN → CODE → BUILD → TEST → RELEASE → DEPLOY → OPERATE → MONITOR**, con descripciones y tareas por tarjeta. Los próximos ajustes de ciclo de vida probablemente se relacionen con esto.

Herramientas elegidas por etapa (a partir de la diapositiva del curso; OPERATE se expone ante el profesor, el resto solo se implementa):
1. PLAN → Trello ✅
2. CODE → VS Code + Git + GitHub ✅ (repo https://github.com/jh2026programer/sifce, rama `main`)
3. BUILD → npm/Vite + **CircleCI** (`.circleci/config.yml`: npm ci, `node --check`, carga de la API, build de view) ✅ (pipeline #1 en verde)
4. TEST → Jest + Supertest (en vez de JUnit/pytest), corriendo en CircleCI (job `test` con PostgreSQL temporal) ✅. Local: `npm test`, usa el schema `sifce_test` (se recrea por archivo, nunca toca `public`)
5. RELEASE → tags de Git + GitHub Releases + CHANGELOG (en vez de Nexus/Octopus). Los assets de la Release son los artefactos que fabrica el job build de CircleCI (sifce-web.zip, sifce-api.zip) ✅ Release v1.0.0 publicada (https://github.com/jh2026programer/sifce/releases/tag/v1.0.0, tag sobre e5f29d1). GitHub CLI (`gh`) instalado y autenticado como jh2026programer.
6. DEPLOY → Docker + Docker Swarm ✅ en el PC del usuario (Docker Desktop 29.8). `deploy/deploy.ps1` construye `sifce-api` (whatever/Dockerfile) y `sifce-web` (view/Dockerfile, nginx), crea secretos de Swarm (la API los lee con `*_FILE`) y despliega el stack `sifce`: web (puerto 8080, proxy de /api), api ×2, db (postgres:16, schema como config), seed (replicated-job). `deploy/remove.ps1` lo detiene. Autorreparación verificada (réplica matada → nueva en ~11 s sin caída).
7. OPERATE → Prometheus (`prom-client`, `/metrics`) + Grafana + PagerDuty — **es la etapa que se expone**. Hecho: `whatever/services/metrics.js` (métricas amarradas a RNF), servicios prometheus (:9090), alertmanager (:9093) y grafana (:3000, panel `sifce-operacion` generado con `deploy/monitoring/generar_panel.py`) en el stack; 7 reglas en `deploy/monitoring/alert-rules.yml`; manual y guion de demo en `docs/OPERACION.md`. Configs/secretos con huella de contenido e imágenes con etiqueta única (`1.0.0-<id>`) para que Swarm actualice. PagerDuty: la clave va en `deploy/.pagerduty-key` (gitignored); sin ella se usa `alertmanager-sin-pagerduty.yml`.
8. MONITOR → New Relic APM ✅ (cuenta del usuario, región US). Agente cargado por `whatever/instrumentation.js` (primera línea de server.js) solo si hay clave; en Swarm la clave sale de `deploy/.newrelic-key` (gitignored, debe ser la *Ingest - License* completa, 40 caracteres, termina en NRAL) → secreto → `NEW_RELIC_LICENSE_KEY_FILE`. App en New Relic: "SIFCE (Docker Swarm)". No envía cuerpos ni cabeceras de auth. Guía en `docs/MONITOREO.md`.

Al trabajar cada etapa, decir siempre en qué número/etapa del ciclo estamos. Marcar en Trello (tablero "Mi tablero de Trello") las tarjetas completadas.

## 11. Forma de trabajo y seguridad

- Comunicación en **español**, explicaciones claras (el usuario es estudiante y también pide explicaciones conceptuales).
- **Nunca** pegar ni commitear claves reales (`.env` está en `.gitignore`). Una clave de Groq se expuso en el chat y debe considerarse revocada. Enmascarar siempre (`AI_API_KEY=gsk_***`).
- Comandos pensados para **Windows/PowerShell** (usar `curl.exe`, `taskkill` para liberar el puerto 4000, etc.).
- Hacer cambios completos y probados; no dejar botones falsos ni pantallas de decoración.

---

**Recordatorio:** los siguientes ajustes serán de **arquitectura** y **ciclo de vida del software**. Espera mis instrucciones con los detalles antes de modificar nada.
