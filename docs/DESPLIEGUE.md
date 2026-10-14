# Despliegue (RNF-P3, RNF-S1, RNF-D1)

El backend y la base de datos son independientes entre sí y de cualquier
proveedor específico, por lo que pueden desplegarse en distintos entornos
sin cambios de código — solo variables de entorno.

## Despliegue con Docker Swarm (ciclo de vida, etapa 6 · DEPLOY)

Es el despliegue oficial del proyecto: cada capa corre en su contenedor y
**Docker Swarm** (orquestador de la diapositiva del curso) los arranca, los
vigila y los reinicia si fallan.

```
                 navegador -> http://localhost:8080
                                  |
+--------------------- Docker Swarm (stack "sifce") ----------------------+
|  web   nginx: sirve view/ compilada y reenvía /api/ a la API           |
|  api   Node.js x2 réplicas: Swarm reparte las peticiones entre ellas   |
|  db    PostgreSQL 16 con volumen persistente (db-data)                 |
|  seed  tarea de una sola vez: carga los datos demo y termina           |
+-------------------------------------------------------------------------+
```

### Requisitos

- Docker Desktop (Windows) con el motor encendido ("Engine running").

### Desplegar

```powershell
.\deploy\deploy.ps1                    # IA en modo mock
.\deploy\deploy.ps1 -AiProvider groq   # IA real (toma AI_API_KEY de whatever\.env)
```

El script (unos 30 s cuando las imágenes ya existen):
1. activa el modo Swarm si hace falta (nodo único);
2. construye las imágenes `sifce-api` (`whatever/Dockerfile`) y `sifce-web`
   (`view/Dockerfile`) con la versión de `package.json`;
3. crea los **secretos de Swarm** la primera vez: contraseña de la base y
   clave JWT aleatorias, y la clave de IA. La API los lee como archivos
   (`DB_PASSWORD_FILE`, `JWT_SECRET_FILE`, `AI_API_KEY_FILE`, ver
   `whatever/config/env.js`); nunca quedan en el código ni en variables visibles;
4. ejecuta `docker stack deploy -c deploy/docker-stack.yml sifce` y espera
   a que todo esté estable.

### Detener

```powershell
.\deploy\remove.ps1                  # detiene el stack, conserva los datos
.\deploy\remove.ps1 -BorrarDatos     # además borra la base y las hojas de vida del despliegue
.\deploy\remove.ps1 -BorrarSecretos  # además borra los secretos
```

### Comandos útiles

```powershell
docker stack services sifce             # réplicas de cada servicio
docker service ps sifce_api             # historial de tareas de la API
docker service logs -f sifce_api        # logs en vivo de las dos réplicas
docker service scale sifce_api=3        # escalar la API
```

### Decisiones de diseño

- **Un solo puerto expuesto (8080).** La API y PostgreSQL solo existen en la
  red interna del stack; desde fuera solo se llega a través de nginx.
- **Mismo origen.** La interfaz se compila con `VITE_API_URL=/api/v1` y nginx
  reenvía `/api/` a la API: no hay CORS entre dominios.
- **Autorreparación y actualizaciones sin caída.** Si una réplica de la API
  muere, Swarm crea otra (verificado: ~11 s, y la otra réplica siguió
  atendiendo). Las actualizaciones reemplazan una réplica a la vez
  (`order: start-first`) y se revierten solas si fallan.
- **Esquema automático.** `model/schema.sql` se entrega a PostgreSQL como
  *config* de Swarm y se ejecuta al crear el volumen por primera vez.
- **Datos independientes del desarrollo.** El stack tiene su propia base
  (volumen `sifce_db-data`); no toca la base local de `npm run dev:api`.

## Componentes a desplegar (instalación manual, sin Docker)

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
