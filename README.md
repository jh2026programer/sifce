# SIFCE — Sistema Inteligente de Filtro y Contratación Empresarial

Plataforma **central y privada por empresa**: nosotros somos el proveedor
del servicio, y cada empresa cliente opera su propio entorno aislado e
independiente para gestionar sus vacantes, candidatos y procesos de
selección — sin que otras empresas puedan ver su información, y sin ningún
listado público o cruzado de vacantes entre empresas.

Un candidato tiene **una sola cuenta** en la plataforma. Para operar dentro
del entorno de una empresa debe vincularse mediante el **código único** que
esa empresa le entrega. Si se vincula a varias empresas, cada una aparece
como un entorno independiente y seleccionable al iniciar sesión, sin mezclar
vacantes, postulaciones ni resultados entre ellas.

Dentro de cada entorno, un módulo de inteligencia artificial analiza hojas
de vida y calcula un porcentaje de compatibilidad frente a los requisitos de
cada vacante. **La IA nunca contrata automáticamente**: es una herramienta
de apoyo a la decisión del reclutador.

Desarrollado como proyecto académico (UTS — Tecnología en Desarrollo de
Sistemas Informáticos) a partir de la Especificación de Requisitos de
Software (SRS, formato IEEE 830) del sistema.

## Cambios de esta revisión (arquitectura MVW en la raíz + gestión global de usuarios + rediseño)

- **Arquitectura MVW en la raíz del proyecto**: las carpetas principales
  ahora son `model/` (esquema y SQL), `whatever/` (API Express) y `view/`
  (interfaz React), unidas con npm workspaces: un solo `npm install` y todos
  los comandos desde la raíz (`npm run dev:api`, `npm run dev:web`). Todo el
  SQL salió de los controladores y vive en un archivo de modelo por entidad
  (`model/*.model.js`). Detalle y reglas en `docs/ARQUITECTURA.md`. La API
  responde exactamente igual que antes: se verificó con una prueba
  automatizada de 150 llamadas (mismos códigos, mensajes y forma del JSON).
- **El Superadministrador gestiona TODOS los usuarios** de la plataforma
  (`/superadmin/users`, endpoints `/users/all`): buscar/filtrar por nombre,
  correo, rol, empresa o estado; editar nombre; activar/desactivar (nunca a
  un superadministrador); restablecer contraseña; desbloquear cuentas.
- **Rediseño visual**: paleta carbón + cobre + verde azulado, tipografías
  Sora (títulos) + Inter (texto), área de trabajo clara. Se corrigieron los
  botones invisibles (texto blanco sobre fondo blanco) del landing y de
  "Cerrar sesión" con la clase `.btn-outline-invert`, y el cierre de sesión
  pasó a un menú desplegable de usuario con avatar de iniciales.
- **`.env.example`**: los ejemplos ahora usan exactamente los nombres de
  variables que lee el código (antes había nombres distintos), y hay un
  `.env.example` en la raíz que resume qué va en cada `.env`.
- Un id con formato inválido en la URL ahora responde `400` en vez de `500`.
- Se retiró código duplicado que ninguna parte del sistema usaba (versiones
  anteriores de controladores, servicios y páginas).

## Cambios de esta revisión (seguridad: OTP, CAPTCHA, bloqueo por intentos + rediseño futurista)

- **Verificación en dos pasos (OTP)** en el login: implementada y probada,
  pero **desactivada por defecto** (`OTP_ENABLED=false`) — actívala cuando
  quieras con una sola variable de entorno. Ver `docs/SEGURIDAD.md`.
- **CAPTCHA ("no soy un robot")** en los registros de candidato y de
  empresa, vía Google reCAPTCHA v2. Desactivado por defecto (requiere una
  cuenta gratuita de Google); el registro funciona igual sin ella.
- **Bloqueo de cuenta** tras 5 contraseñas incorrectas seguidas (15 minutos),
  protección estándar contra fuerza bruta.
- **Rediseño visual completo**: tema oscuro con acentos cian/violeta, brillos
  tipo neón, tipografía Orbitron para títulos, y fondo con cuadrícula sutil —
  acorde a la identidad visual del logo.

## Cambios de esta revisión (corrección de errores + reportes + rediseño)

Tras una revisión del cliente sobre el entregable anterior, se corrigieron
dos errores reales y se agregaron capacidades nuevas:

- **Corregido**: crear una empresa desde el panel del Superadministrador
  dejaba la empresa sin Administrador de Empresa (sin correo ni
  contraseña), por lo que quedaba visible en la base de datos pero
  **inaccesible** — nadie podía iniciar sesión en ella. Ahora `POST
  /companies` exige y crea las credenciales del primer Administrador de
  Empresa en la misma transacción que la empresa (igual que el registro
  público), verificado con un inicio de sesión real tras la creación.
- **Agregado**: el Superadministrador ahora puede **editar** cualquier
  empresa (`PATCH /companies/:id`) — antes solo podía crearlas y
  activarlas/desactivarlas.
- **Agregado**: módulo de **reportes** para Administrador de Empresa y
  Reclutador — resumen con KPIs, embudo de postulaciones por etapa,
  tendencia diaria, vacantes con más postulaciones, y exportación a CSV
  de todas las postulaciones de la empresa (`/reports`).
- **Rediseño visual**: nueva paleta de color, tipografía (Inter), tarjetas
  de estadísticas con íconos, gráficos reales (barras y líneas, con
  `recharts`) en el panel principal y en reportes, y una barra lateral con
  íconos — sin perder la austeridad pedida originalmente (nada puramente
  decorativo, cada elemento visual comunica información real).

## Estado de este entregable (léelo antes de evaluar)

Este es un **prototipo funcional real** — no maquetas ni pantallas
decorativas — verificado con un backend vivo contra una base de datos
PostgreSQL real (ver `docs/PRUEBAS.md` para el registro exacto de pruebas
ejecutadas). Los 19 requisitos funcionales del SRS están implementados con
lógica real de backend y conectados a una interfaz funcional, sobre el
modelo privado por empresa descrito arriba (una revisión posterior al primer
entregable reemplazó por completo el listado público de vacantes por este
modelo de vinculación por código — ver `docs/ARQUITECTURA.md`, sección
"Modelo privado por empresa"). Lo que **no** se incluye, para ser honestos:
una suite de pruebas automatizadas (se documenta la estrategia en
`docs/PRUEBAS.md`), pruebas de carga reales, y pruebas en múltiples
navegadores/dispositivos físicos.

## Tecnologías

- **Frontend**: React 18 + Vite, React Router, Axios — JavaScript (sin TypeScript)
- **Backend**: Node.js + Express — API REST
- **Base de datos**: PostgreSQL
- **IA**: adaptador desacoplado (`mock` por defecto; `groq`, `anthropic`, `openai` o `http` para IA real) — ver `docs/MODULO_IA.md`

## Estructura del proyecto (patrón MVW en la raíz)

Las tres capas del patrón MVW son las tres carpetas principales del proyecto:

```
sifce/
  package.json         npm workspaces (model, whatever, view) + comandos de la raíz
  .env.example         Resumen de qué variables van en whatever/.env y view/.env
  model/               MODEL — datos
    schema.sql           esquema completo de PostgreSQL
    db.js                conexión (pool pg) + withTransaction()
    *.model.js           un archivo con el SQL de cada entidad (user, vacancy, application, ...)
    scripts/             dbSetup.js (aplica el esquema) y seed.js (datos demo)
  whatever/            WHATEVER — API REST (Node.js + Express)
    server.js            punto de entrada
    config/              variables de entorno (lee whatever/.env)
    routes/              endpoints y qué middleware los protege
    middleware/          autenticación, roles, entorno activo, errores, carga de PDF
    controllers/         coordinación de cada RF (validan, llaman modelos y presentadores)
    services/            reglas de negocio: auth, OTP, CAPTCHA, IA, compatibilidad, logs
    presenters/          forma de las respuestas JSON (response.js, user.view.js, ...)
    utils/               AppError, asyncHandler, scope (aislamiento), accessCode, pdfExtractor
    uploads/resumes/     hojas de vida cargadas (no se versiona el contenido real)
  view/                VIEW — interfaz web (React + Vite)
    index.html, vite.config.js, public/
    src/
      main.jsx, App.jsx  punto de entrada y tabla de rutas
      pages/             pantallas, organizadas por rol
      components/        componentes reutilizables
      styles/            estilos globales y colores de las gráficas
      api/, context/     cliente Axios y sesión
      routes/, hooks/, utils/, constants/
  docs/
    ARQUITECTURA.md    MVW en carpetas, reglas de dependencia, módulos, seguridad, errores
    MODULO_IA.md       Contrato del módulo de IA e independencia del proveedor
    SEGURIDAD.md       OTP, CAPTCHA y bloqueo por intentos fallidos
    TRAZABILIDAD.md    Matriz RF/RNF → módulo → pantalla → endpoint → tabla → verificación
    PRUEBAS.md         Registro de pruebas manuales ejecutadas + estrategia de automatización
    DESPLIEGUE.md      Cómo desplegar en distintos entornos
  README.md            Este archivo
```

## Requisitos previos

- Node.js 18 o superior
- PostgreSQL 13 o superior
- npm 7 o superior (para npm workspaces)

## Instalación y ejecución (paso a paso)

Todos los comandos `npm` se ejecutan **desde la raíz `sifce/`**.

### 1. Base de datos

```bash
# Crear la base de datos y un usuario (ajusta la contraseña)
sudo -u postgres psql -c "CREATE USER sifce_user WITH PASSWORD 'change_me';"
sudo -u postgres psql -c "CREATE DATABASE sifce OWNER sifce_user;"
sudo -u postgres psql -d sifce -c "GRANT ALL ON SCHEMA public TO sifce_user;"
```

### 2. Configuración

```bash
cp whatever/.env.example whatever/.env   # PowerShell: Copy-Item whatever\.env.example whatever\.env
cp view/.env.example view/.env           # PowerShell: Copy-Item view\.env.example view\.env
```

Edita `whatever/.env`: `DB_PASSWORD` debe coincidir con la contraseña creada
arriba, y genera un `JWT_SECRET` aleatorio. `view/.env` ya apunta a
`http://localhost:4000/api/v1`.

### 3. Dependencias y base de datos

```bash
npm install          # instala model, whatever y view de una vez (un solo node_modules en la raíz)
npm run db:create    # aplica model/schema.sql sobre tu base de datos
npm run db:seed      # crea datos y credenciales de demostración (ver abajo)
```

### 4. Ejecutar (dos terminales, ambas en la raíz)

```bash
npm run dev:api      # terminal 1: API en http://localhost:4000/api/v1
npm run dev:web      # terminal 2: interfaz en http://localhost:5173
```

### 5. (Opcional) build de producción de la interfaz

```bash
npm run build:web    # genera view/dist — servible desde cualquier servidor estático
npm run start:api    # API sin recarga automática (producción)
```

## Credenciales de demostración

> El login funciona en un solo paso (correo + contraseña) por defecto — la
> verificación en dos pasos (OTP) está implementada pero **desactivada**
> hasta que la actives (`OTP_ENABLED=true` en `whatever/.env`). Si la
> activas, revisa la terminal del backend después de iniciar sesión: ahí
> aparece el código (a menos que configures envío por correo real). Ver
> `docs/SEGURIDAD.md`.

Creadas por `npm run db:seed` (contraseña para todas: **`Demo1234!`**):

| Rol | Correo |
|---|---|
| Superadministrador | `superadmin@sifce.demo` |
| Administrador de Empresa (TechNova Soluciones) | `admin@technova.demo` |
| Reclutador (TechNova Soluciones) | `reclutador@technova.demo` |
| Administrador de Empresa (Grupo Andino Retail) | `admin@andino.demo` |
| Candidato (vinculado a TechNova **y** Grupo Andino) | `maria.gomez@correo.demo` |
| Candidato (vinculado solo a TechNova) | `carlos.ruiz@correo.demo` |
| Candidato (vinculado solo a TechNova) | `laura.torres@correo.demo` |

Códigos de acceso de empresa (para vincular un candidato nuevo desde
`/register/candidate` o desde "Mis empresas" ya autenticado):

| Empresa | Código |
|---|---|
| TechNova Soluciones S.A.S. | `TECHNOVA24` |
| Grupo Andino Retail S.A.S. | `ANDINO24` |

El seed crea 2 empresas, 3 vacantes activas repartidas entre ambas, 3
postulaciones ya con su análisis de IA calculado (para ver el ranking y la
comparación funcionando de inmediato) y las 6 etapas base del proceso de
selección en cada empresa. María queda vinculada a **ambas** empresas a
propósito, para poder demostrar el selector de entornos.

## Demostración completa sugerida

1. Inicia sesión como `admin@technova.demo` → en "Información de la
   empresa" copia el código `TECHNOVA24` → revisa "Usuarios", "Criterios de
   evaluación" (25/30/30/15) y "Etapas".
2. Inicia sesión como `reclutador@technova.demo` → entra a la vacante
   "Desarrollador Backend Node.js" → pestaña **Ranking** (María 100%, Carlos
   22.5%) → pestaña **Postulaciones**, selecciona ambos candidatos → pestaña
   **Comparación**.
3. Abre el detalle de una postulación → revisa la explicación de IA,
   fortalezas y brechas → cambia la etapa a "Preseleccionado".
4. Cierra sesión e inicia como `maria.gomez@correo.demo` → en "Mis
   empresas" verás que está vinculada a **TechNova y a Grupo Andino Retail**
   → entra a TechNova → "Mis postulaciones" (verifica que el cambio de
   etapa se refleja) → vuelve a "Mis empresas" y entra a Grupo Andino →
   comprueba que ahí no aparece ninguna postulación ni vacante de TechNova
   (entornos completamente aislados para el mismo candidato).
5. Regístrate como candidato nuevo (`/register/candidate`) usando el código
   `ANDINO24` en el paso de registro → verifica que quedas vinculado
   directamente a Grupo Andino Retail y **no** ves nada de TechNova.
6. Como superadmin (`superadmin@sifce.demo`) → desactiva TechNova → intenta
   iniciar sesión como su reclutador (debe fallar) → reactívala. En
   "Usuarios" filtra por rol o estado, desactiva a un candidato, restablece
   su contraseña y vuelve a activarlo.
7. Como `admin@technova.demo` → genera un nuevo código de acceso → confirma
   que el código viejo (`TECHNOVA24`) ya no sirve para vincular candidatos
   nuevos, pero que los candidatos ya vinculados no pierden acceso.

## Modelo privado por empresa (léelo si vienes del entregable anterior)

La primera versión de este prototipo tenía un listado público de vacantes
visible para cualquier candidato autenticado, sin importar la empresa. Esa
visión **se eliminó por completo**: ahora no existe ninguna consulta que
devuelva vacantes o información de una empresa sin que el candidato esté
vinculado primero mediante su código único. El detalle técnico completo está
en `docs/ARQUITECTURA.md` ("Modelo privado por empresa"); en resumen:

- `companies.access_code`: código único que cada empresa entrega a sus
  candidatos (visible y regenerable desde "Información de la empresa").
- `candidate_company_links`: tabla de vínculos candidato↔empresa. Un
  candidato puede estar vinculado a varias empresas simultáneamente.
- Encabezado `X-Active-Company`: el frontend indica en qué entorno vinculado
  quiere operar el candidato en cada request; el backend revalida el
  vínculo contra la base de datos en cada petición (nunca confía en el
  valor sin más — mismo principio que ya se aplicaba en la autenticación).
- Sin este encabezado (o sin un entorno seleccionado), las rutas de
  vacantes y postulaciones del candidato responden `400` — no hay una vista
  "por defecto" que muestre datos de cualquier empresa.

## Módulo de IA — modo DEMO

Por defecto `AI_PROVIDER=mock`: el análisis de compatibilidad es
determinístico (coincidencia de palabras clave entre el CV y los requisitos
de la vacante), documentado en `docs/MODULO_IA.md`, y cada resultado queda
marcado como `provider: "mock"` en la base de datos para nunca presentarse
como un análisis de IA real. Para conectar un proveedor real, configura
`AI_PROVIDER=http`, `AI_API_URL` y `AI_API_KEY` en `whatever/.env` — ningún
otro archivo necesita cambios (RNF-M3).

## Endpoints principales

Todos bajo el prefijo `/api/v1`. Lista completa de rutas en
`whatever/routes/`. Los más relevantes:

| Método | Ruta | RF |
|---|---|---|
| POST | `/auth/login` | RF01 |
| POST | `/auth/login/verify-otp` | Verificación en dos pasos |
| POST | `/auth/login/resend-otp` | Verificación en dos pasos |
| GET | `/auth/public-config` | Config pública (CAPTCHA) |
| POST | `/auth/register/candidate` (código de empresa opcional) | RF02 |
| POST | `/auth/register/company` | RF02, RF04 |
| GET | `/candidates/me/companies` | vinculación privada |
| POST | `/candidates/me/companies` (`{ code }`) | vinculación privada |
| PATCH | `/companies/mine/access-code` | RF19 (extendido) |
| PATCH | `/companies/:id` (superadministrador) | RF04 (extendido) |
| GET | `/users/all` (superadministrador; filtros `q`, `role`, `companyId`, `status`) | gestión global de usuarios |
| PATCH | `/users/all/:id`, `/users/all/:id/password`, `/users/all/:id/unlock` | gestión global de usuarios |
| GET | `/reports/summary` | reportes (nuevo) |
| GET | `/reports/export/applications` | reportes (nuevo) |
| GET/POST | `/vacancies` | RF05 |
| GET | `/vacancies/browse` (requiere `X-Active-Company`) | RF16 |
| GET/PATCH | `/candidates/me` | RF06 |
| POST | `/resumes` | RF07 |
| POST | `/applications` (requiere `X-Active-Company`) | RF08 |
| GET | `/applications/vacancy/:id/ranking` | RF10 |
| GET | `/applications/:id` | RF09, RF11 |
| POST | `/applications/compare` | RF12 |
| PATCH | `/applications/:id/stage` | RF13 |
| PATCH | `/applications/:id/withdraw` | RF13 (retiro por el candidato) |
| GET/POST | `/criteria` | RF14 |
| GET/POST | `/stages` | RF15 |

## Roles y aislamiento por empresa

Ver `docs/ARQUITECTURA.md`. Resumen: Superadministrador (gestiona empresas a
nivel de plataforma), Administrador de Empresa, Reclutador y Candidato. Cada
empresa solo puede ver y gestionar sus propios usuarios, vacantes,
candidatos postulados y resultados. Un candidato solo ve vacantes y
postulaciones de las empresas a las que se vinculó explícitamente por
código, y nunca mezcladas entre sí — verificado en `docs/PRUEBAS.md`.

## Cálculo de compatibilidad

Ver `docs/MODULO_IA.md` para la fórmula exacta y cómo se combinan los
criterios configurables de cada empresa.

## Problemas comunes

| Problema | Solución |
|---|---|
| `ECONNREFUSED` al iniciar la API | PostgreSQL no está corriendo, o `DB_HOST`/`DB_PORT` en `.env` no coinciden con tu instalación |
| `password authentication failed` | Revisa `DB_USER`/`DB_PASSWORD` en `whatever/.env` contra el usuario creado en PostgreSQL |
| El frontend no recibe datos / error de CORS | Verifica que `CORS_ORIGIN` en `whatever/.env` coincida con la URL real del frontend |
| "El PDF no contiene texto legible" al cargar un CV | El PDF es una imagen escaneada sin capa de texto; usa un PDF generado digitalmente (no un escaneo) |
| El análisis de IA queda en "Procesando" indefinidamente | Revisa los logs del backend; si `AI_PROVIDER=http` y el servicio externo no responde, el estado pasará a "failed" y podrás reintentar desde el detalle de la postulación |
| Un candidato recibe `400` al listar/buscar vacantes o postularse | Falta seleccionar un entorno de empresa. En el frontend, ve a "Mis empresas" y entra a una; si pruebas la API directamente, agrega el encabezado `X-Active-Company: <id-de-la-empresa>` |
| Un código de empresa "no es válido" | Verifica mayúsculas/espacios (el backend normaliza a mayúsculas y recorta espacios, pero confirma que el código no fue rotado — cada regeneración invalida el código anterior para nuevas vinculaciones) |
