# Despliegue (RNF-P3, RNF-S1, RNF-D1)

El backend y la base de datos son independientes entre sí y de cualquier
proveedor específico, por lo que pueden desplegarse en distintos entornos
sin cambios de código — solo variables de entorno.

## Componentes a desplegar

1. **PostgreSQL** — cualquier instancia 13+ (local, contenedor, o un
   servicio gestionado). Solo se necesita: crear la base de datos, crear un
   usuario con permisos sobre ella, y cargar `model/schema.sql`.
2. **API (Node.js 18+, carpetas `whatever/` + `model/`)** — instalar con
   `npm install` en la raíz (npm workspaces) y ejecutar `node whatever/server.js`
   (o `npm run start:api`), gestionado con un supervisor de procesos (`pm2`,
   `systemd`, un contenedor, etc.). `model/` debe desplegarse junto a
   `whatever/`: la API carga los modelos desde esa carpeta hermana.
   Escucha en `PORT` (por defecto 4000) sobre HTTP plano.
3. **Interfaz (`view/`, estática tras `npm run build:web`)** — la carpeta `view/dist/`
   generada es HTML/CSS/JS estático: puede servirse desde cualquier
   servidor web o CDN, apuntando `VITE_API_URL` a la URL pública del backend.

## HTTPS (RNF-S1)

Express no termina TLS por sí mismo. En producción, el backend debe correr
detrás de un proxy inverso (Nginx, Caddy, un balanceador del proveedor de
nube, etc.) que:
- exponga el servicio públicamente solo por HTTPS,
- redirija HTTP → HTTPS,
- reenvíe las peticiones al puerto interno donde corre `node whatever/server.js`.

El mismo patrón aplica a cualquier proveedor de IA externo configurado
(`AI_API_URL`): debe ser una URL `https://`.

## Variables de entorno por entorno

Cada entorno (desarrollo, pruebas, producción) usa su propio `.env` en
`whatever/` y `view/`, generados a partir de los `.env.example`
correspondientes. Nada sensible se versiona (ver `.gitignore`).

## Disponibilidad y mantenimiento (RNF-D1, RNF-D2)

- Al ejecutarse el backend como un proceso independiente del frontend
  estático y de la base de datos, un mantenimiento de cualquiera de los tres
  no obliga a detener los otros dos.
- Se recomienda un supervisor de procesos con reinicio automático
  (`pm2 start whatever/server.js --name sifce-api` o equivalente) para
  recuperación ante caídas del proceso.
- Los mantenimientos programados deben comunicarse a los usuarios con
  anticipación (RNF-D2); esto es un proceso operativo, no una funcionalidad
  del sistema.
