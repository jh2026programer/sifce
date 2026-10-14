# Seguridad — CAPTCHA, verificación en dos pasos (OTP) y bloqueo por intentos

Este documento cubre las capas de seguridad agregadas tras una revisión del
cliente ("¿qué tipo de seguridad tiene, como OTP o 'no soy un robot'?").
El bloqueo por intentos fallidos ya está activo; CAPTCHA y OTP están
implementados y listos, pero **desactivados por defecto** hasta que actives
cada uno con sus propias claves (ver abajo).

## 1. CAPTCHA ("no soy un robot") en los registros públicos

**Desactivado por defecto** (`CAPTCHA_ENABLED=false`) porque requiere una
clave gratuita de Google — así el registro de candidato y de empresa
funcionan de inmediato sin depender de esa configuración externa. El
frontend, cuando está desactivado, simplemente no muestra el widget ni exige
un token.

Se usa **Google reCAPTCHA v2** ("Casilla 'No soy un robot'") — el CAPTCHA
más reconocido, la mayoría de la gente ya lo ha usado en otros sitios.

### Activarlo

1. Entra a [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create) con una cuenta de Google (gratis, sin tarjeta).
2. Ponle una etiqueta (ej. "SIFCE"), elige tipo **reCAPTCHA v2** → **"Casilla 'No soy un robot'"**.
3. En "Dominios", agrega `localhost` (para desarrollo) y el dominio real cuando lo despliegues.
4. Acepta los términos y da "Enviar". Te muestra dos claves: **clave de sitio** (pública) y **clave secreta** (privada).
5. En `whatever/.env`:
   ```
   CAPTCHA_ENABLED=true
   CAPTCHA_SITE_KEY=la_clave_de_sitio
   CAPTCHA_SECRET_KEY=la_clave_secreta
   ```
6. Reinicia el backend. El frontend detecta automáticamente que está
   habilitado (consulta `GET /auth/public-config`) y muestra la casilla "No
   soy un robot" en los formularios de registro — no hay que tocar nada en
   el frontend ni guardar la clave de sitio en su propio `.env`.

### Dónde se aplica

Registro de candidato y registro de empresa (`POST /auth/register/*`). No se
aplica al login: ahí la protección contra automatización la da el bloqueo
por intentos fallidos (sección 3), que es el mecanismo estándar para ese
caso — un CAPTCHA en cada inicio de sesión añade fricción a todos los
usuarios legítimos por igual, mientras que el bloqueo solo afecta a quien
realmente está fallando repetidamente.

## 2. Verificación en dos pasos (OTP) en el login — lista para más adelante

**Desactivada por defecto** (`OTP_ENABLED=false`). El flujo completo ya está
programado y probado (ver `docs/PRUEBAS.md`); actívala cuando quieras sumar
esta capa, sin tocar código:

```
OTP_ENABLED=true
```

Con eso, después de validar correo y contraseña, el sistema genera un
código de 6 dígitos, lo guarda **hasheado** (nunca en texto plano) con una
expiración de 10 minutos, y lo exige antes de emitir cualquier sesión.

### Cómo se entrega el código

| `OTP_NOTIFIER` | Comportamiento |
|---|---|
| `console` (por defecto) | El código se imprime en la terminal donde corre `node whatever/server.js`. Sigue siendo un segundo factor genuino (no viaja al navegador, no aparece en la respuesta de la API), solo que no requiere configurar correo para poder probarlo de inmediato. |
| `smtp` | Envía el código por correo real. Requiere `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (ver abajo cómo conseguir credenciales gratis). |

### Configurar correo real gratis (Gmail), para cuando la actives

1. Activa la verificación en dos pasos en tu cuenta de Gmail (obligatorio para el siguiente paso): [myaccount.google.com/security](https://myaccount.google.com/security).
2. Genera una "contraseña de aplicación": [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → elige "Otra" → dale un nombre (ej. "SIFCE") → cópiala (16 caracteres).
3. En `whatever/.env`:
   ```
   OTP_ENABLED=true
   OTP_NOTIFIER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=tu_correo@gmail.com
   SMTP_PASS=la_contraseña_de_aplicación_de_16_caracteres
   SMTP_FROM="SIFCE <tu_correo@gmail.com>"
   ```
4. Reinicia el backend. Cualquier otro proveedor SMTP (Outlook, un dominio propio, SendGrid, etc.) funciona igual — solo cambian host/puerto/usuario.

### Importante si la activas: la base de datos necesita la tabla de OTP

`OTP_ENABLED=true` solo funciona si tu base de datos ya tiene la tabla
`login_otp_codes` y las columnas `failed_login_attempts`/`locked_until` en
`users` (vienen en `model/schema.sql`). Si tu base es de una versión
anterior del proyecto, tienes que recrearla (`DROP DATABASE` +
`CREATE DATABASE` + `npm run db:create`) antes de activar OTP — si no, el
login fallará con un error genérico apenas intente guardar el código.

## 3. Bloqueo de cuenta por intentos fallidos (fuerza bruta)

**Esta ya está activa, sin nada que configurar.** Tras
`LOGIN_MAX_ATTEMPTS` contraseñas incorrectas seguidas (5 por defecto), la
cuenta queda bloqueada por `LOGIN_LOCK_MINUTES` minutos (15 por defecto) —
durante ese tiempo, ni siquiera la contraseña correcta permite entrar (evita
que alguien siga intentando mientras espera a que expire). El contador se
reinicia solo con un login exitoso.

```
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15
```

Igual que con OTP: esta función necesita las columnas nuevas en `users`, así
que si tu base es de una versión anterior, recréala antes de usarla (ver
arriba).

## Resumen de variables de entorno

Ver `whatever/.env.example` para la lista completa con comentarios. Estado
por defecto: CAPTCHA desactivado, OTP desactivado, bloqueo por intentos
fallidos activo (no requiere configuración).
