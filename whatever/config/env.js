// Carga y valida las variables de entorno usadas por toda la aplicación.
// Centralizar esto evita valores hardcodeados dispersos por el código (RNF-M2).
const fs = require('fs');
const path = require('path');

// Carpeta raíz de la API (whatever/). El .env y la carpeta de hojas de vida se
// ubican respecto a ella, no respecto a la terminal desde donde se ejecute el
// comando: así funcionan igual "npm run dev" dentro de whatever/, los scripts
// de model/ (db:create, db:seed) y los comandos lanzados desde la raíz.
const API_ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(API_ROOT, '.env') });

// Valores sensibles: si existe NOMBRE_FILE, el valor se lee de ese archivo.
// Así funcionan los "secrets" de Docker Swarm (deploy/docker-stack.yml), que
// la plataforma monta como archivos en /run/secrets/ en vez de exponerlos
// como variables de entorno. Sin NOMBRE_FILE se usa la variable normal (.env).
function fromEnvOrFile(name) {
  const file = process.env[`${name}_FILE`];
  if (file) return fs.readFileSync(file, 'utf8').trim();
  return process.env[name];
}

function required(name, fallback) {
  const value = fromEnvOrFile(name) ?? fallback;
  if (value === undefined) {
    // eslint-disable-next-line no-console
    console.warn(`[config] Variable de entorno "${name}" no está definida.`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: required('DB_NAME', 'sifce'),
    user: required('DB_USER', 'sifce_user'),
    password: required('DB_PASSWORD', ''),
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev_secret_change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),

  resume: {
    maxSizeMb: parseInt(process.env.RESUME_MAX_SIZE_MB || '5', 10),
    // Ruta absoluta; si RESUME_UPLOAD_DIR es relativa, se toma desde whatever/.
    uploadDir: path.resolve(API_ROOT, process.env.RESUME_UPLOAD_DIR || 'uploads/resumes'),
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'mock',
    apiUrl: process.env.AI_API_URL || '',
    apiKey: fromEnvOrFile('AI_API_KEY') || '',
    model: process.env.AI_MODEL || '',
  },

  // --- Verificación en dos pasos (OTP) al iniciar sesión ---
  otp: {
    // Desactivada por defecto por ahora (se activa más adelante con
    // OTP_ENABLED=true). El código y el flujo completo ya están listos.
    enabled: process.env.OTP_ENABLED === 'true',
    // "console" (por defecto): imprime el código en la terminal del backend,
    // sin necesitar configurar un correo real — sigue siendo un segundo
    // factor genuino para desarrollo/demo. "smtp": envía un correo real.
    notifier: process.env.OTP_NOTIFIER || 'console',
    ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: fromEnvOrFile('SMTP_PASS') || '',
    from: process.env.SMTP_FROM || 'SIFCE <no-reply@sifce.local>',
  },

  // --- CAPTCHA ("no soy un robot", Google reCAPTCHA v2) en registro ---
  captcha: {
    // Deshabilitado por defecto porque requiere una clave gratuita de
    // Google reCAPTCHA — ver docs/SEGURIDAD.md. Con CAPTCHA_ENABLED=false
    // el registro funciona igual que antes, sin bloquear la demo por falta
    // de esas claves.
    enabled: process.env.CAPTCHA_ENABLED === 'true',
    secretKey: fromEnvOrFile('CAPTCHA_SECRET_KEY') || '',
    siteKey: process.env.CAPTCHA_SITE_KEY || '',
  },

  // --- Bloqueo de cuenta por intentos fallidos (fuerza bruta) ---
  loginLockout: {
    maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
    lockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES || '15', 10),
  },
};
