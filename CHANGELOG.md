# Registro de cambios

Todas las versiones publicadas de SIFCE. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y la numeración
[Versionado Semántico](https://semver.org/lang/es/): `MAYOR.MENOR.PARCHE`.

## [1.0.0] - 2026-10-14

Primera versión estable del Sistema Inteligente de Filtro y Contratación
Empresarial: implementa los 19 requisitos funcionales del SRS (IEEE 830)
sobre un modelo privado por empresa.

### Funcionalidades

- **Autenticación y cuentas** (RF01–RF03): inicio de sesión con JWT,
  contraseñas con bcrypt, registro de candidatos y de empresas, gestión de la
  cuenta propia.
- **Plataforma multiempresa privada**: cada empresa es un entorno aislado. Los
  candidatos tienen una sola cuenta y se vinculan a cada empresa con su
  código de acceso único (regenerable); nunca hay listados públicos ni
  cruzados entre empresas.
- **Superadministrador** (RF04): alta de empresas junto con su administrador,
  edición, activación/desactivación, y gestión global de todos los usuarios
  (buscar, editar, activar/desactivar, restablecer contraseña, desbloquear).
- **Administrador de Empresa** (RF14, RF15, RF18, RF19): información de la
  empresa, usuarios internos, criterios de evaluación ponderados y etapas
  del proceso de selección.
- **Vacantes y postulaciones** (RF05, RF08, RF16, RF17): vacantes con
  requisitos de formación, experiencia, habilidades e idiomas; postulación
  dentro del entorno activo; retiro y reactivación de postulaciones.
- **Hojas de vida** (RF06, RF07): perfil profesional completo y carga de CV en
  PDF con extracción de texto.
- **Análisis con inteligencia artificial** (RF09–RF12): compatibilidad
  ponderada por los criterios de cada empresa, explicación con fortalezas y
  brechas, ranking y comparación de candidatos. Proveedor intercambiable por
  configuración: `mock`, Groq, Claude (Anthropic), OpenAI o un servicio HTTP
  propio. La decisión final siempre es humana.
- **Proceso de selección** (RF13): cambio de etapa con historial completo.
- **Reportes**: indicadores, embudo por etapa, tendencia diaria y exportación
  a CSV.
- **Seguridad**: bloqueo tras 5 intentos fallidos, verificación en dos pasos
  por OTP y reCAPTCHA v2 (ambos opcionales por configuración), registro de
  actividad.

### Arquitectura y calidad

- Patrón **MVW** visible en la raíz del proyecto: `model/` (esquema y SQL por
  entidad), `whatever/` (API Express) y `view/` (React + Vite), unidos con npm
  workspaces.
- **101 pruebas automáticas** de la API (Jest + Supertest) que verifican
  autenticación, aislamiento entre empresas, el proceso de selección completo
  y la administración.
- **Integración continua** en CircleCI: en cada cambio se compila, se
  empaquetan los artefactos y se ejecutan las pruebas contra una base
  PostgreSQL temporal.

### Artefactos de esta versión

- `sifce-web.zip`: interfaz compilada, lista para servirse como sitio estático.
- `sifce-api.zip`: API y modelos con su `package-lock.json`, listos para
  `npm ci --omit=dev` y `npm run start:api`.

### Limitaciones conocidas

- Sin pruebas automáticas de la interfaz ni de extremo a extremo.
- Sin migraciones de base de datos: un cambio de esquema exige recrearla.
- reCAPTCHA y OTP por correo no se han probado con servicios reales.
- Aún no desplegado en un servidor (etapa DEPLOY pendiente).

[1.0.0]: https://github.com/jh2026programer/sifce/releases/tag/v1.0.0
