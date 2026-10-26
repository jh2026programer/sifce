# Microservicios de SIFCE

SIFCE tiene dos microservicios: programas Node.js **independientes** que
corren aparte de la API (no en Docker) y se comunican con ella por HTTP y
JSON. Cada uno está hecho de **tres scripts**:

| Script | Papel |
|---|---|
| `server.js` | **Endpoint**: el servidor HTTP que recibe la solicitud y responde |
| `validator.js` | **Validador**: revisa que los datos lleguen completos y correctos antes de procesarlos |
| `service.js` | **Servicio**: la regla de negocio, lo que el microservicio realmente hace |

```
microservicios/
  package.json        dependencias propias (express, pdf-parse) y comandos
  iniciar.js          arranca los dos a la vez
  comun/http.js       registro de peticiones en consola y manejo de errores
  compatibilidad/     server.js · validator.js · service.js   (puerto 4101)
  validador-cv/       server.js · validator.js · service.js   (puerto 4102)
  tests/              pruebas de los dos (Jest + Supertest)
```

## 1. Microservicio de compatibilidad (puerto 4101)

**Qué hace:** calcula la compatibilidad global de un candidato con una vacante.
Es la regla central del negocio (RF09, RF11, RF14):

```
compatibilidad = (formación × peso + experiencia × peso + habilidades × peso + idiomas × peso) / 100
```

Los puntajes (0-100) los da la IA; los pesos los configura cada empresa (por
defecto 25 % cada uno). Además clasifica el resultado: **alta** (≥ 75),
**media** (≥ 50) o **baja**.

| | |
|---|---|
| Endpoint | `POST /compatibilidad` · `GET /salud` |
| Validador | Están los 4 puntajes y los 4 pesos; puntajes entre 0 y 100; pesos entre 0 y 100 y que sumen 100 |
| Respuestas | `200` resultado · `400` datos inválidos (con la lista de errores) |

Ejemplo (PowerShell):

```powershell
$body = '{"puntajes":{"formacion":100,"experiencia":80,"habilidades":60,"idiomas":40},"pesos":{"formacion":25,"experiencia":25,"habilidades":25,"idiomas":25}}'
Invoke-RestMethod -Method Post -Uri http://localhost:4101/compatibilidad -Body $body -ContentType application/json | ConvertTo-Json -Depth 4
```

```json
{ "ok": true,
  "resultado": { "compatibilidad": 70, "nivel": "media",
                 "detalle": [ { "criterio": "formacion", "puntaje": 100, "peso": 25, "aporte": 25 }, "..." ] } }
```

## 2. Microservicio validador de hojas de vida (puerto 4102)

**Qué hace:** recibe el PDF de la hoja de vida, comprueba que sea válido,
extrae su texto (que después analiza la IA) y detecta datos básicos: correo,
teléfono, habilidades conocidas, páginas y palabras (RF07).

| | |
|---|---|
| Endpoint | `POST /validar-cv` (el PDF va como cuerpo, `Content-Type: application/pdf`) · `GET /salud` |
| Validador | Tipo `application/pdf`; no vacío; máximo 5 MB; que sea un PDF real (empieza por `%PDF-`), no otro archivo renombrado |
| Servicio | Lee el PDF; si no tiene texto (escaneado como imagen) o está dañado, lo informa con un mensaje claro |
| Respuestas | `200` texto y datos · `400` no es un PDF válido · `422` es PDF pero no se puede leer |

Ejemplo (PowerShell):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4102/validar-cv -InFile .\mi_cv.pdf -ContentType application/pdf | ConvertTo-Json -Depth 4
```

## Cómo se conectan con SIFCE

```
 Candidato sube su CV ──> API (whatever/) ──HTTP──> validador-cv ──> texto + datos
                                │
 Postulación ──> IA da puntajes ─┴──HTTP──> compatibilidad ──> % global y nivel ──> ranking
```

- El cliente está en `whatever/services/microservicios.js`. Lo usan
  `controllers/resumes.controller.js` (al subir un CV) y
  `services/compatibilityService.js` (al analizar una postulación).
- Las direcciones se configuran en `whatever/.env`:
  `MS_COMPATIBILIDAD_URL=http://localhost:4101` y
  `MS_VALIDADOR_CV_URL=http://localhost:4102`.
- **Tolerancia a fallas:** si un microservicio está apagado o no responde en
  `MS_TIMEOUT_MS` (5 s), la API ejecuta el mismo código del microservicio
  dentro de su propio proceso (respaldo) y SIFCE sigue funcionando. Si la URL
  está vacía, usa siempre ese modo local.
- **Operación:** la métrica de Prometheus
  `sifce_microservice_requests_total{service, mode}` cuenta cada solicitud
  según cómo se atendió: `remote` (respondió el microservicio), `fallback`
  (no respondió y se usó el respaldo) o `local` (sin URL configurada).

## Cómo arrancarlos

Desde la raíz del proyecto, en una terminal aparte:

```powershell
npm run microservicios          # los dos a la vez (Ctrl + C los detiene)
npm run ms:compatibilidad       # solo uno
npm run ms:validador-cv
```

Cada petición se ve en la consola, por ejemplo:

```
[validador-cv] 23:10:51  POST /validar-cv -> 200 (9 ms)
[compatibilidad] 23:10:51  POST /compatibilidad -> 200 (26 ms)
```

Escuchan solo en `127.0.0.1` (este PC). Con SIFCE en Docker Swarm, la API
llega a ellos por `host.docker.internal` (ya configurado en
`deploy/docker-stack.yml`). Puertos e interfaz se cambian con
`MS_COMPATIBILIDAD_PORT`, `MS_VALIDADOR_CV_PORT` y `MS_HOST`.

## Pruebas

```powershell
npm test -w microservicios      # 25 pruebas: validador, servicio y endpoint de cada uno
npm test                        # las de los microservicios + las de la API
```

`whatever/tests/microservicios.test.js` levanta los dos microservicios de
verdad y comprueba el flujo completo por la API (subir CV → postularse →
compatibilidad) y el respaldo cuando se apagan.
