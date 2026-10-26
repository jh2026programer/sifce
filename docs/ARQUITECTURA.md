# Arquitectura del SIFCE

## Modelo privado por empresa (vinculación por código único)

Este es el cambio de fondo respecto a un portal de vacantes abierto: **no
existe ninguna vista, endpoint ni consulta que muestre vacantes o
información de una empresa a un candidato que no esté vinculado a ella.**

### Modelo de datos

- `companies.access_code` (`VARCHAR(12) UNIQUE NOT NULL`): código que la
  empresa entrega a sus candidatos. Se genera automáticamente al crear la
  empresa (`whatever/utils/accessCode.js`, alfabeto sin caracteres ambiguos) y se
  puede regenerar desde `PATCH /companies/mine/access-code` sin afectar a
  quienes ya se vincularon.
- `candidate_company_links` (`candidate_id`, `company_id`, `linked_at`,
  `UNIQUE(candidate_id, company_id)`): un candidato puede vincularse a
  varias empresas; cada vínculo es independiente.

### Flujo de vinculación

1. **En el registro** (`POST /auth/register/candidate`): el candidato puede
   incluir `companyCode` opcionalmente. Si lo hace, la cuenta y el vínculo
   se crean en la misma transacción — si el código es inválido, se revierte
   todo (verificado: no queda una cuenta huérfana).
2. **Ya autenticado** (`POST /candidates/me/companies`, body `{ code }`):
   para vincularse a una empresa adicional en cualquier momento.
3. **Listado de entornos propios** (`GET /candidates/me/companies`): la
   única lista de empresas que un candidato puede ver — nunca una lista de
   empresas a las que NO está vinculado.

### Entorno activo por request (`X-Active-Company`)

El candidato puede estar vinculado a varias empresas, así que cada request
debe indicar en cuál quiere operar. El frontend envía el encabezado
`X-Active-Company` con el `id` de la empresa seleccionada (guardado en
`localStorage` tras elegirla en "Mis empresas"). El middleware
`whatever/middleware/companyContext.js` es el único punto que resuelve
esto:

- `requireActiveCompany`: exige el encabezado, revalida el vínculo contra
  `candidate_company_links` en la base de datos (no solo confía en el
  valor recibido) y verifica que la empresa siga activa. Se usa en
  `GET /vacancies/browse`, `POST /applications` y `GET /applications/mine`.
- `attachActiveCompanyIfPresent`: variante no bloqueante para rutas
  compartidas con otros roles (ej. `GET /vacancies/:id`), donde el detalle
  de una vacante debe rechazarse si no coincide con el entorno activo del
  candidato, pero la ruta en sí también la usan reclutadores/administradores
  sin este concepto.

Sin un entorno activo válido, estas rutas responden `400`/`404` — no existe
un "modo por defecto" que muestre datos de cualquier empresa.

### Qué es compartido y qué es privado por entorno

- **Compartido entre entornos** (una sola identidad): cuenta, perfil
  profesional (formación, experiencia, habilidades, idiomas,
  certificaciones) y hojas de vida — el candidato es una sola persona con
  un solo CV, que usa para postularse en cualquier empresa a la que se
  vincule.
- **Privado por entorno**: vacantes visibles, postulaciones, resultados de
  IA y seguimiento del proceso de selección. Las postulaciones del
  candidato en la Empresa A nunca aparecen al operar dentro de la Empresa B,
  aunque sea la misma persona (verificado en `docs/PRUEBAS.md`).

## Módulo de reportes

Solicitado por el cliente tras el primer entregable. `reports.controller.js`
(consultas en `model/report.model.js`, formato en `whatever/presenters/report.view.js`)
expone datos agregados, siempre acotados a `company_id` (mismo principio de
aislamiento que el resto del sistema):

- `GET /reports/summary`: conteo de vacantes por estado, total de
  postulaciones, embudo por etapa, compatibilidad promedio, top 5 vacantes
  por número de postulaciones, serie diaria de postulaciones (14 días) y las
  8 postulaciones más recientes. Usado tanto por el panel principal
  (`DashboardPage`) como por la pantalla dedicada de reportes (`ReportsPage`).
- `GET /reports/export/applications`: exportación plana de todas las
  postulaciones de la empresa; el frontend la convierte a CSV en el
  navegador (`view/src/utils/csv.js`), sin necesidad de una librería de generación de
  archivos en el backend.

Todas las consultas son agregaciones SQL directas (sin una capa de
"analytics" separada); es una decisión deliberada para un sistema de este
tamaño — evita la complejidad de mantener tablas de agregación
pre-calculadas cuando el volumen de datos no lo justifica.

## Corrección: creación de empresas por el Superadministrador

En el entregable anterior, `POST /companies` (creación de empresa por el
Superadministrador) no exigía ni creaba credenciales de un Administrador de
Empresa. La empresa quedaba registrada en la base de datos, pero **sin
ningún usuario capaz de acceder a ella** — visible pero completamente
inoperable. Se corrigió para que esta operación exija `adminFullName`,
`adminEmail` y `adminPassword`, y cree la empresa, su Administrador y sus
etapas por defecto en una única transacción (igual que el registro público
de empresas), verificado con un inicio de sesión real inmediatamente después
de la creación. De paso, se agregó `PATCH /companies/:id` para que el
Superadministrador pueda editar cualquier empresa (antes solo podía crearlas
y activarlas/desactivarlas).

## Gestión global de usuarios (Superadministrador)

El Superadministrador administra **todas** las cuentas de la plataforma
(administradores, reclutadores y candidatos de cualquier empresa) desde
"Usuarios" (`/superadmin/users`):

| Acción | Endpoint |
|---|---|
| Listar con búsqueda y filtros (`q`, `role`, `companyId`, `status` = `active`, `inactive` o `locked`) | `GET /users/all` |
| Editar nombre / activar / desactivar | `PATCH /users/all/:id` (`{ fullName?, isActive? }`) |
| Restablecer contraseña (también levanta un bloqueo vigente) | `PATCH /users/all/:id/password` (`{ password }`) |
| Desbloquear una cuenta bloqueada por intentos fallidos | `PATCH /users/all/:id/unlock` |

Reglas: nunca se puede desactivar a un superadministrador (la plataforma no
puede quedar sin quien la administre); la nueva contraseña exige mínimo 8
caracteres; cada acción queda en `activity_logs`. Desactivar a un usuario
corta también su sesión abierta, porque `whatever/middleware/auth.js`
revalida el estado del usuario en cada request.

## Patrón solicitado: MVW (Model – View – Whatever)

El SRS exige el patrón **MVW**. En SIFCE el patrón **es la estructura del
proyecto**: las tres carpetas principales de la raíz son las tres capas.

```
sifce/
  package.json        npm workspaces: model, whatever, view
  model/              MODEL — los datos
    schema.sql          tablas, enums e índices de PostgreSQL
    db.js               conexión (pool pg) + withTransaction()
    user.model.js       users (login, bloqueo, gestión global)
    company.model.js    companies (código de acceso, estado)
    companyLink.model.js  vínculos candidato-empresa
    candidate.model.js  perfil y secciones del candidato
    resume.model.js     hojas de vida
    vacancy.model.js    vacantes
    application.model.js  postulaciones + historial de etapas
    aiResult.model.js   resultados del análisis de IA
    criteria.model.js   criterios de evaluación
    stage.model.js      etapas del proceso
    report.model.js     consultas agregadas de reportes
    activityLog.model.js  log de actividad
    otp.model.js        códigos OTP
    scripts/            dbSetup.js (aplica schema.sql) y seed.js (datos demo)
  whatever/           WHATEVER — la API que coordina todo (Express)
    server.js           punto de entrada
    config/env.js       variables de entorno (lee whatever/.env)
    routes/             endpoints y qué middleware los protege
    middleware/         autenticación, roles, entorno activo, errores, carga de PDF
    controllers/        coordinación de cada RF (validan, llaman modelos y presentadores)
    services/           reglas de negocio: auth, OTP, CAPTCHA, IA, compatibilidad, logs
    presenters/         forma del JSON de respuesta (response.js, user.view.js, report.view.js)
    utils/              AppError, asyncHandler, scope (aislamiento), accessCode
    uploads/resumes/    PDF de hojas de vida
  view/               VIEW — lo que ve el usuario (React + Vite)
    src/pages/          pantallas, organizadas por rol
    src/components/     componentes reutilizables (navbar, sidebar, badges, modales)
    src/styles/         index.css (paleta y estilos) + chartTheme.js (colores de gráficas)
    src/api/            cliente Axios por recurso (habla con whatever/)
    src/context/        sesión (AuthContext) y entorno de empresa activo
    src/routes/         rutas protegidas por rol y por entorno activo
    src/constants/      roles, estados y categorías del dominio
    src/hooks/, utils/  hooks y utilidades (CAPTCHA, CSV)
```

### Cómo se conectan

```
view/      --HTTP + JSON-->  whatever/   (la interfaz solo habla con la API)
whatever/  --require-------->  model/    (los controladores piden datos a los modelos)
model/     --SQL----------->  PostgreSQL (db.js es el único punto que ejecuta SQL)
```

- **Ningún archivo de `whatever/` escribe SQL.** Si un controlador necesita
  datos, llama a una función con nombre de un modelo
  (`vacancyModel.listByCompany(companyId)`). Todo el SQL del sistema está en
  `model/`, y es ahí donde se revisa que cada consulta filtre por
  `company_id`.
- **Los modelos no conocen HTTP**: no leen `req`, no responden `res`, no
  lanzan errores HTTP. Devuelven filas o `null`, y el controlador decide si
  eso es un `404`.
- **`view/` nunca toca la base de datos**: todo lo pide a la API por HTTP.
- Las operaciones de varios pasos usan `db.withTransaction(fn)`: los modelos
  reciben el `client` de la transacción como primer argumento (`executor`).

### Decisiones y compromisos de esta organización

- **npm workspaces.** `model/` vive fuera de la carpeta de la API, así que
  por sí sola no encontraría la librería `pg`. Con workspaces, un único
  `npm install` en la raíz instala las dependencias de las tres carpetas en
  un `node_modules` compartido, y cada parte declara las suyas en su propio
  `package.json`. Todos los comandos se ejecutan desde la raíz
  (`npm run dev:api`, `npm run dev:web`, `npm run db:create`, ...).
- **Un solo `.env` para el servidor.** `model/` no tiene configuración
  propia: `db.js` y sus scripts usan `whatever/config/env.js`, que siempre
  lee `whatever/.env` sin importar desde qué carpeta se ejecute el comando.
- **Presentadores dentro de `whatever/`.** La forma del JSON que responde la
  API (`whatever/presenters/`) es código del servidor, así que vive con la
  API; la carpeta `view/` queda reservada para la interfaz que ve el usuario.
- **`view/` contiene la app de React completa**, incluida su propia lógica
  de cliente (`api/`, `context/`, `routes/`). Es el precio de que la raíz
  tenga exactamente tres capas: separar esa lógica en otra carpeta de la
  raíz rompería el proyecto de Vite.
- `model/` y `whatever/` se despliegan juntos (la API carga los modelos de
  la carpeta hermana); `view/` se compila a estáticos y se despliega aparte.

Se mantiene SQL directo con `pg`, sin ORM, por decisión deliberada: el
aislamiento por empresa depende de que cada consulta filtre por
`company_id`, y con SQL explícito eso se puede auditar línea por línea.

## Diagrama de módulos

```
┌──────────────────────────────────────────────────────────────┐
│                 view/  (React + Vite, navegador)             │
│        pages, components  ->  api (Axios), context           │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS + JSON (API REST)
┌──────────────────────────────▼───────────────────────────────┐
│                 whatever/  (Node.js + Express)               │
│  routes -> middleware (auth, rol, entorno activo)            │
│         -> controllers (uno por recurso)                     │
│         -> services (auth, IA, logs)  -> presenters (JSON)   │
│  services/ai/aiProvider.js                                   │
│  (adaptador: mock | groq | anthropic | openai | http)        │
└──────────────────────────────┬───────────────────────────────┘
                               │ require('../model/...')
┌──────────────────────────────▼───────────────────────────────┐
│          model/  (*.model.js -> db.js, SQL con pg)           │
└──────────────────────────────┬───────────────────────────────┘
                               │ SQL parametrizado
┌──────────────────────────────▼───────────────────────────────┐
│               PostgreSQL (aislado por company_id)            │
└──────────────────────────────────────────────────────────────┘
```

### Microservicios

Dos procesos independientes (carpeta `microservicios/`, fuera de Docker) a los
que `whatever/services/microservicios.js` llama por HTTP:

```
whatever/ ──POST /validar-cv──────> validador-cv   (puerto 4102)
          ──POST /compatibilidad──> compatibilidad (puerto 4101)
```

Cada uno tiene endpoint (`server.js`), validador (`validator.js`) y servicio
(`service.js`). No acceden a la base de datos: reciben datos y devuelven un
resultado, así que no rompen el aislamiento por empresa. Si no responden, la
API usa su mismo código en proceso (respaldo). Detalle en
`docs/MICROSERVICIOS.md`.

## Módulos funcionales (Sección 2 del prompt / SRS §2.1)

1. **Gestión de empresas y usuarios** — `companies.controller.js`, `users.controller.js`, `auth.controller.js` (incluye la gestión global de usuarios del Superadministrador)
2. **Gestión de vacantes y requisitos** — `vacancies.controller.js`
3. **Gestión de candidatos, hojas de vida y vinculación privada por empresa** — `candidates.controller.js`, `resumes.controller.js`, `services/companyLinkService.js`, `middleware/companyContext.js`
4. **Configuración de criterios y etapas** — `criteria.controller.js`, `stages.controller.js`
5. **Análisis de hojas de vida mediante IA** — `whatever/services/ai/`
6. **Evaluación y cálculo de compatibilidad** — `whatever/services/compatibilityService.js` + `model/aiResult.model.js`
7. **Ranking y comparación de candidatos** — `applications.controller.js` (`getRankingForVacancy`, `compareApplications`)
8. **Gestión y seguimiento de etapas del proceso** — `applications.controller.js` (`updateApplicationStage`) + tabla `application_stage_history`
9. **Base de datos** — `model/schema.sql`
10. **Interfaz web adaptada por rol** — `view/src/pages/`, enrutado por `view/src/routes/ProtectedRoute.jsx`

## Aislamiento por empresa (Sección 7)

Implementado en dos capas, no solo en la interfaz (requisito explícito del
prompt):

1. **Backend**: `whatever/utils/scope.js` centraliza las funciones
   `requireCompanyId` y `assertBelongsToCompany`, usadas en todo controlador
   que toca datos de empresa. Ninguna consulta de vacantes, candidatos
   postulados, criterios, etapas o usuarios internos se construye sin el
   `company_id` del usuario autenticado (extraído del JWT, nunca de un
   parámetro que el cliente pueda manipular).
2. **Frontend**: las rutas se filtran por rol (`ProtectedRoute`) y las
   páginas solo muestran lo que el backend efectivamente devuelve — no hay
   lógica de "ocultar" datos de otra empresa en el cliente, porque el
   backend jamás los envía.

Verificado en pruebas manuales (ver `docs/PRUEBAS.md`): una segunda empresa
registrada obtiene `404 Recurso no encontrado` al intentar acceder a
vacantes, postulaciones o candidatos de la primera.

El mismo principio aplica al lado del candidato, pero con un mecanismo
propio: ver "Modelo privado por empresa" más abajo. Ahí el aislamiento no es
solo "empresa A no ve a empresa B", sino también "el mismo candidato, dentro
del entorno de la empresa A, no ve nada de su propio historial en la
empresa B" — verificado con la misma candidata vinculada a dos empresas.

## Independencia del proveedor de IA (RNF-M3)

Ver `docs/MODULO_IA.md`.

## Seguridad (Sección 19 / RNF-S1 a RNF-S5)

- Contraseñas con `bcryptjs` (nunca texto plano).
- Autenticación JWT con expiración configurable; cada request revalida que
  el usuario y su empresa sigan activos (no solo al iniciar sesión).
- Autorización por rol en cada ruta (`whatever/middleware/authorize.js`).
- Validación de tipo y tamaño de archivo en la carga de CV (solo PDF, 5 MB).
- Descarga de hojas de vida protegida: solo el candidato dueño o el personal
  de la empresa con una postulación vinculada puede descargarlas.
- CORS restringido a un origen configurable.
- HTTPS es responsabilidad del entorno de despliegue (proxy/balanceador);
  Express no termina TLS — ver `docs/DESPLIEGUE.md`.
- Variables sensibles (JWT_SECRET, credenciales de BD, AI_API_KEY) solo en
  `.env`, nunca en el código fuente.
- Verificación en dos pasos (OTP) en el login, CAPTCHA en los registros
  públicos, y bloqueo de cuenta por intentos fallidos — ver `docs/SEGURIDAD.md`
  para el detalle completo de cada una y cómo configurarlas.

## Manejo de errores (Sección 21 / RNF-F1)

Todo error pasa por `whatever/middleware/errorHandler.js` y sale con el formato de `whatever/presenters/response.js`. Los errores esperables
(`AppError`) devuelven un mensaje claro y un código HTTP apropiado; los
errores no esperados se registran en el log del servidor pero al usuario se
le muestra un mensaje genérico, sin stack trace. Un identificador con formato
inválido en la URL (por ejemplo, un id que no es UUID) responde `400` en vez
de un error 500.
