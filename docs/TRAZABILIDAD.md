# Matriz de trazabilidad RF / RNF

Columna **Verificación**: indica cómo se comprobó cada requisito en este
prototipo, sin inflar el estado real:
- **Prueba manual ejecutada** → se corrió un flujo real (backend vivo +
  PostgreSQL real, comandos documentados en `docs/PRUEBAS.md`) y se observó
  el resultado esperado.
- **Revisión de código** → la lógica existe y fue releída para confirmar que
  cumple el requisito, pero no se ejecutó una prueba dedicada.
- **Estrategia documentada (no ejecutada)** → requiere infraestructura o
  condiciones que este prototipo local no puede reproducir (carga real,
  múltiples navegadores/dispositivos físicos, TLS de producción); se deja
  documentado cómo se validaría en un entorno real.

## Requisitos funcionales

| RF | Nombre | Módulo | Pantalla(s) | Endpoint(s) | Tabla(s) | Verificación |
|---|---|---|---|---|---|---|
| RF01 | Autenticación de Usuario | auth | LoginPage | `POST /auth/login` | users, companies | Prueba manual ejecutada |
| RF02 | Registro de Usuario | auth | RegisterCandidatePage, RegisterCompanyPage | `POST /auth/register/candidate` (con código de empresa opcional), `POST /auth/register/company` | users, candidate_profiles, companies, candidate_company_links, selection_stages | Prueba manual ejecutada |
| RF03 | Gestión de Perfil de Usuario | users | MyAccountPage | `GET /auth/me`, `PATCH /users/me` | users | Prueba manual ejecutada |
| RF04 | Gestión de Empresas en la Plataforma (incluye edición, agregada tras corrección de error) | companies | CompaniesPage (superadmin) | `GET/POST /companies`, `PATCH /companies/:id`, `PATCH /companies/:id/status` | companies, users, selection_stages | Prueba manual ejecutada (creación exige y crea credenciales del Administrador de Empresa; verificado login real tras creación; edición verificada) |
| RF05 | Gestión de Vacantes | vacancies | VacanciesListPage, VacancyFormPage, VacancyDetailPage | `GET/POST /vacancies`, `PATCH /vacancies/:id`, `PATCH /vacancies/:id/status` | vacancies | Prueba manual ejecutada |
| RF06 | Gestión de Información del Candidato | candidates | ProfilePage | `GET/PATCH /candidates/me`, `POST/DELETE` sub-recursos | candidate_profiles, candidate_education, candidate_experience, candidate_skills, candidate_languages, candidate_certifications | Prueba manual ejecutada (2 errores reales encontrados y corregidos) |
| RF07 | Carga de Hoja de Vida | resumes | CvPage | `POST/GET /resumes`, `DELETE /resumes/:id`, `GET /resumes/:id/file` | resumes | Prueba manual ejecutada (PDF válido, PDF corrupto, tipo no-PDF, límite de tamaño) |
| RF08 | Postulación a Vacantes | applications | PublicVacancyPage | `POST /applications` (requiere entorno activo `X-Active-Company`) | applications, application_stage_history, ai_analysis_results | Prueba manual ejecutada (éxito, duplicada, sin CV, vacante inactiva, vacante de otro entorno rechazada) |
| RF09 | Análisis Inteligente y Evaluación de Compatibilidad | services/ai, compatibilityService | ApplicationDetailPage | disparado tras `POST /applications`; consultado en `GET /applications/:id` | ai_analysis_results | Prueba manual ejecutada (3 perfiles con distinto grado de ajuste, puntajes coherentes) |
| RF10 | Generación de Ranking de Candidatos | applications | VacancyDetailPage (pestaña Ranking) | `GET /applications/vacancy/:vacancyId/ranking` | applications, ai_analysis_results | Prueba manual ejecutada |
| RF11 | Explicación del Resultado de IA | applications | ApplicationDetailPage | `GET /applications/:id` | ai_analysis_results | Prueba manual ejecutada |
| RF12 | Comparación de Candidatos | applications | VacancyDetailPage (pestaña Comparación) | `POST /applications/compare` | applications, ai_analysis_results | Prueba manual ejecutada |
| RF13 | Gestión del Proceso de Selección (incluye retiro de postulación por el candidato, agregado tras esta revisión) | applications | VacancyDetailPage (pestaña Postulaciones), MyApplicationsPage, ApplicationDetailPage | `PATCH /applications/:id/stage`, `PATCH /applications/:id/withdraw` | applications, application_stage_history | Prueba manual ejecutada (retiro, doble retiro rechazado, dueño verificado, reactivación al volver a postularse a la misma vacante) |
| RF14 | Configuración de Criterios de Evaluación | criteria | CriteriaPage | `GET/POST/PATCH/DELETE /criteria` | evaluation_criteria | Prueba manual ejecutada |
| RF15 | Configuración de Etapas del Proceso de Selección | stages | StagesPage | `GET/POST/PATCH /stages` | selection_stages | Prueba manual ejecutada (creación automática al registrar empresa) |
| RF16 | Consulta de Vacantes Disponibles (**redefinido**: dentro del entorno de empresa vinculado, ya no público/cruzado) | vacancies, middleware/companyContext | BrowseVacanciesPage | `GET /vacancies/browse` (requiere `X-Active-Company`) | vacancies, companies, candidate_company_links | Prueba manual ejecutada (sin encabezado → 400; dos empresas distintas → listas distintas y no mezcladas) |
| RF17 | Consulta de Estado de Postulación (dentro del entorno de empresa activo, sin mezclar entre empresas) | applications | MyApplicationsPage | `GET /applications/mine` (requiere `X-Active-Company`) | applications, candidate_company_links | Prueba manual ejecutada (misma candidata, dos empresas: listas independientes) |
| RF18 | Gestión de Usuarios de la Empresa | users | UsersPage (admin) | `GET/POST /users`, `PATCH /users/:id` | users | Prueba manual ejecutada |
| RF19 | Configuración de la Información de la Empresa Propia | companies | CompanySettingsPage | `GET/PATCH /companies/mine` | companies | Prueba manual ejecutada |

## Requisito adicional (solicitado después del SRS original)

El cliente solicitó, tras revisar el primer entregable, convertir la
plataforma de un portal de vacantes con visualización pública/cruzada a un
sistema privado y segmentado por empresa, con vinculación de candidatos por
código único. Este requisito no tiene un número RF en el SRS original, así
que se documenta aparte para no falsear la trazabilidad del documento base:

| Requisito (no numerado en el SRS) | Módulo | Pantalla(s) | Endpoint(s) | Tabla(s) | Verificación |
|---|---|---|---|---|---|
| Vinculación de candidato a empresa mediante código único, sin listado público de empresas | auth, candidates, companies, middleware/companyContext | CompanyEnvironmentsPage, RegisterCandidatePage, CompanySettingsPage | `POST /candidates/me/companies`, `GET /candidates/me/companies`, `PATCH /companies/mine/access-code` | companies (`access_code`), candidate_company_links | Prueba manual ejecutada (código válido/inválido, vínculo duplicado, rotación de código sin afectar vínculos existentes) |
| Entornos independientes seleccionables para un mismo candidato vinculado a varias empresas | applications, vacancies | DashboardPage, BrowseVacanciesPage, MyApplicationsPage | `GET /vacancies/browse`, `POST /applications`, `GET /applications/mine` (todos con `X-Active-Company`) | vacancies, applications, candidate_company_links | Prueba manual ejecutada (una candidata vinculada a 2 empresas: vacantes y postulaciones completamente independientes entre entornos) |
| Reportes para Administrador de Empresa y Reclutador (KPIs, embudo, tendencia, exportación CSV) | reports | ReportsPage, DashboardPage | `GET /reports/summary`, `GET /reports/export/applications` | vacancies, applications, ai_analysis_results | Prueba manual ejecutada (datos agregados verificados contra los datos demo reales) |
| Edición de empresas por el Superadministrador (antes solo podía crear/activar/desactivar) | companies | CompaniesPage (superadmin) | `PATCH /companies/:id` | companies | Prueba manual ejecutada |
| Corrección: creación de empresa por el Superadministrador ahora exige y crea las credenciales del Administrador (antes quedaba inoperable) | companies, auth | CompaniesPage (superadmin) | `POST /companies` | companies, users, selection_stages | Prueba manual ejecutada (login real del administrador creado, verificado inmediatamente después de la creación) |
| Verificación en dos pasos (OTP) en el login | auth, otpService | LoginPage (paso de código) | `POST /auth/login`, `POST /auth/login/verify-otp`, `POST /auth/login/resend-otp` | login_otp_codes | Prueba manual ejecutada (código correcto/incorrecto/expirado/reenvío con cooldown, todo contra Postgres real) |
| CAPTCHA ("no soy un robot") en registro de candidato y de empresa | auth, captchaService | RegisterCandidatePage, RegisterCompanyPage | `POST /auth/register/candidate`, `POST /auth/register/company`, `GET /auth/public-config` | — | Prueba manual ejecutada (bypass cuando está desactivado; error claro cuando está activado sin clave/token) — la verificación real contra Google no se probó por no contar con claves de reCAPTCHA configuradas |
| Bloqueo de cuenta tras intentos fallidos (fuerza bruta) | auth | — | `POST /auth/login` | users (`failed_login_attempts`, `locked_until`) | Prueba manual ejecutada (bloqueo tras 5 intentos, incluso con la contraseña correcta durante el bloqueo) |
| Gestión global de usuarios por el Superadministrador (buscar/filtrar, editar nombre, activar/desactivar, restablecer contraseña, desbloquear) | users | PlatformUsersPage (superadmin, `/superadmin/users`) | `GET /users/all`, `PATCH /users/all/:id`, `PATCH /users/all/:id/password`, `PATCH /users/all/:id/unlock` | users, companies, activity_logs | Prueba automatizada de API (18 casos: filtros, desactivar/activar con corte de sesión, superadmin no desactivable, contraseña corta rechazada, login con la nueva contraseña, desbloqueo) + prueba manual en el navegador |

## Requisitos no funcionales

| RNF | Nombre | Implementación | Verificación |
|---|---|---|---|
| RNF-R1 | Tiempo de respuesta ≤3s | Análisis de IA en segundo plano (no bloquea la respuesta), índices en `company_id`/`vacancy_id`/`candidate_id` | Prueba manual ejecutada (respuestas observadas en <300ms en local) |
| RNF-R2 | 50 usuarios concurrentes | Pool de conexiones `pg` (máx. 20), servidor sin estado en memoria | Estrategia documentada (no ejecutada) — se recomienda `k6` o `autocannon` contra un entorno desplegado |
| RNF-R3 | Indicador de procesamiento de IA | Frontend hace polling de `ai_status` (pending/processing) y muestra spinner | Prueba manual ejecutada |
| RNF-S1 | Transmisión segura (HTTPS) | CORS restringido; terminación TLS delegada al proxy de despliegue (`docs/DESPLIEGUE.md`) | Revisión de código / documentación (no aplica en `localhost`) |
| RNF-S2 | Autenticación y autorización por rol | `whatever/middleware/auth.js`, `whatever/middleware/authorize.js` | Prueba manual ejecutada (401 sin token, 403 con rol incorrecto) |
| RNF-S3 | Protección de credenciales | `bcryptjs` (hash, nunca texto plano) | Prueba manual ejecutada (verificado en la fila de `users` en PostgreSQL) |
| RNF-S4 | Protección de información y archivos | `whatever/utils/scope.js`, verificación de propiedad en descarga de CV (`model/resume.model.js`) | Prueba manual ejecutada (aislamiento entre 2 empresas confirmado con 404) |
| RNF-S5 | Registro de actividades | `whatever/services/activityLogService.js` → `model/activityLog.model.js` → tabla `activity_logs` | Prueba manual ejecutada (registros verificados tras login/crear vacante/etc.) |
| RNF-F1 | Manejo de errores | `whatever/middleware/errorHandler.js` + `whatever/presenters/response.js` (sin stack trace al usuario; id con formato inválido → 400) | Prueba manual ejecutada |
| RNF-F2 | Integridad de la información | Claves foráneas, transacciones (`db.withTransaction`: `BEGIN/COMMIT/ROLLBACK`) en operaciones multi-tabla | Revisión de código |
| RNF-F3 | Persistencia de resultados de IA | Tabla `ai_analysis_results` | Prueba manual ejecutada (persiste tras reinicio del servidor) |
| RNF-F4 | Recuperación ante fallos de conexión | Estado `failed` + endpoint de reintento (`POST /applications/:id/retry-analysis`) | Revisión de código (camino de error de `httpProvider` no se probó contra un servicio caído real) |
| RNF-D1 | Disponibilidad ≥95% | Proceso backend independiente del frontend estático y la BD | Estrategia documentada (no medible en un prototipo local) |
| RNF-D2 | Gestión de mantenimiento | Proceso operativo (comunicación previa a usuarios) | Documentado (no es una funcionalidad de software) |
| RNF-M1 | Estructura modular | Patrón MVW como estructura de la raíz: `model/` (esquema + SQL por entidad), `whatever/` (API: rutas, middleware, controladores, servicios, presentadores), `view/` (interfaz React), unidos con npm workspaces — ver `docs/ARQUITECTURA.md` | Revisión de código + prueba automatizada de API (150 llamadas con resultado idéntico antes y después de cada reorganización) |
| RNF-M2 | Documentación del código | Comentarios en decisiones no obvias, `docs/` | Revisión de código |
| RNF-M3 | Independencia del proveedor de IA | `whatever/services/ai/aiProvider.js` (adaptador `mock`/`groq`/`anthropic`/`openai`/`http`) | Revisión de código (el cambio de proveedor no requiere tocar controladores) |
| RNF-P1 | Compatibilidad con navegadores | CSS estándar sin APIs propietarias | Estrategia documentada (no probado en navegadores reales distintos de Chromium) |
| RNF-P2 | Compatibilidad con dispositivos | CSS responsive (`@media`) | Estrategia documentada (no probado en dispositivos físicos) |
| RNF-P3 | Despliegue en diferentes entornos | Variables de entorno, sin rutas ni credenciales hardcodeadas | Ver `docs/DESPLIEGUE.md` |
