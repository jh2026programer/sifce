# Guía de estudio para la exposición · OPERATE (etapa 7)

Tres partes: **cómo abrir cada plataforma**, **cómo se implementó en el código**
y **cómo explicar una prueba**.

---

## Parte 1 · Cómo activar (abrir) cada plataforma

Todo se enciende junto. Solo hay que hacer esto:

1. Abrir **Docker Desktop** y esperar "Engine running" (abajo a la izquierda).
2. Listo: Prometheus, Alertmanager, Grafana y SIFCE arrancan solos, porque
   Docker Swarm los vuelve a levantar. Si alguno no está, en PowerShell, desde la
   carpeta `sifce`: `.\deploy\deploy.ps1`

Para comprobar que todo está encendido: `docker stack services sifce`. Todas
las filas deben decir `1/1` o `2/2`.

| Plataforma | Dirección | Usuario | Qué mostrar |
|---|---|---|---|
| **SIFCE** | http://localhost:8080 | Cuentas demo del README (clave `Demo1234!`) | La aplicación funcionando |
| **Prometheus** | http://localhost:9090 | No pide | **Status → Targets**: las 2 réplicas de la API en `UP`. **Alerts**: las 7 reglas |
| **Alertmanager** | http://localhost:9093 | No pide | Las alertas que se están enviando a PagerDuty (vacío cuando todo está bien) |
| **Grafana** | http://localhost:3000 | Entra solo, sin clave (modo lectura). Para editar: usuario `admin`, clave en `deploy\.grafana-admin.txt` | Panel "SIFCE · Operación" |
| **PagerDuty** | https://sifce.pagerduty.com y la app del celular | Tu cuenta | **Incidents** y el servicio "SIFCE Producción" |

### Qué hay en el panel de Grafana

- **Estado de SIFCE ahora**: Réplicas API (debe decir 2), Base de datos (OK),
  Disponibilidad 1 h (%), Respuesta p95 (el 95 % de las peticiones tarda menos
  que este valor), Alertas activas (debe decir 0) y Proveedor IA.
- **Tráfico y rendimiento**: peticiones por segundo y tiempo de respuesta.
- **Uso del sistema e IA**: inicios de sesión, cuentas bloqueadas,
  postulaciones y análisis de IA.
- **Recursos de cada réplica**: memoria y CPU.

### Cómo hacer una consulta en Prometheus (para mostrar los datos crudos)

En http://localhost:9090, escribir en el buscador y presionar **Execute**:

| Escribe | Muestra |
|---|---|
| `up{job="sifce-api"}` | 1 por cada réplica viva (0 si está caída) |
| `sifce_database_up` | 1 si la API puede hablar con PostgreSQL |
| `sifce_logins_total` | Inicios de sesión por resultado (exitosos, inválidos, bloqueados) |
| `sifce_account_lockouts_total` | Cuántas cuentas se han bloqueado |

---

## Parte 2 · Cómo se implementó en el código

### Paso A · SIFCE mide lo que pasa (`prom-client`)

**Archivo nuevo: [whatever/services/metrics.js](../whatever/services/metrics.js)**

Aquí se crean las métricas. Hay 3 tipos:

| Tipo | Para qué | Ejemplo en SIFCE |
|---|---|---|
| **Counter** (contador) | Algo que solo sube: "cuántas veces pasó" | `sifce_logins_total`, `sifce_account_lockouts_total`, `sifce_applications_created_total` |
| **Histogram** (histograma) | Cuánto tardó algo | `sifce_http_request_duration_seconds` (cada petición) |
| **Gauge** (medidor) | Un valor que sube y baja | `sifce_database_up` (1 o 0) |

Ejemplo, el contador de inicios de sesión:

```js
const logins = new client.Counter({
  name: 'sifce_logins_total',
  help: 'Intentos de inicio de sesión por resultado',
  labelNames: ['result'],          // success, invalid, locked, inactive
});
```

Y el medidor de la base de datos, que hace un `SELECT 1` cada vez que
Prometheus pregunta:

```js
new client.Gauge({
  name: 'sifce_database_up',
  async collect() {
    try { await db.query('SELECT 1'); this.set(1); }
    catch (err) { this.set(0); }
  },
});
```

### Paso B · Se conecta a la API

**[whatever/app.js](../whatever/app.js)**, dos cosas:

```js
app.use(metrics.httpMetricsMiddleware);   // mide CADA petición (ruta, código, tiempo)

app.get('/metrics', async (req, res) => { // Prometheus lee de aquí
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});
```

`/metrics` está **fuera de `/api`** a propósito: nginx solo publica `/api/`,
así que nadie de internet puede leer las métricas. Solo Prometheus, dentro de
la red interna de Docker.

### Paso C · Se registran los eventos donde ocurren

| Dónde | Qué se registra |
|---|---|
| [whatever/controllers/auth.controller.js](../whatever/controllers/auth.controller.js) | `metrics.recordLogin('success' / 'invalid' / 'locked')` y `metrics.recordLockout()` al bloquear una cuenta |
| [whatever/controllers/applications.controller.js](../whatever/controllers/applications.controller.js) | `metrics.recordApplication()` en cada postulación |
| [whatever/services/compatibilityService.js](../whatever/services/compatibilityService.js) | `metrics.startAiTimer()` y `metrics.recordAiAnalysis('completed' / 'failed')` en cada análisis de IA |

### Paso D · Prometheus vigila

**[deploy/monitoring/prometheus.yml](../deploy/monitoring/prometheus.yml)**

```yaml
global:
  scrape_interval: 5s              # pregunta cada 5 segundos
scrape_configs:
  - job_name: sifce-api
    metrics_path: /metrics
    dns_sd_configs:
      - names: ["tasks.api"]       # nombre de Swarm que devuelve CADA réplica
        port: 4000
```

### Paso E · Las reglas de alarma

**[deploy/monitoring/alert-rules.yml](../deploy/monitoring/alert-rules.yml)**, 7 reglas. La principal:

```yaml
- alert: SifceApiCaida
  expr: absent(up{job="sifce-api"} == 1)   # no hay NINGUNA réplica respondiendo
  for: 15s                                  # durante 15 segundos seguidos
  labels:
    severity: critical
    requisito: RNF-D1
```

El `for: 15s` evita falsas alarmas: un parpadeo de 2 segundos no despierta a nadie.

### Paso F · Alertmanager envía a PagerDuty

**[deploy/monitoring/alertmanager.yml](../deploy/monitoring/alertmanager.yml)**

```yaml
receivers:
  - name: pagerduty
    pagerduty_configs:
      - routing_key_file: /run/secrets/sifce_pagerduty_routing_key
        send_resolved: true       # también avisa cuando se arregla → PagerDuty cierra solo
```

La clave de PagerDuty **no está en el código ni en GitHub**. Está en
`deploy\.pagerduty-key` (ignorado por Git), y `deploy.ps1` la convierte en un
**secreto de Docker Swarm** que solo Alertmanager puede leer.

### Paso G · Grafana

- [deploy/monitoring/grafana-datasource.yml](../deploy/monitoring/grafana-datasource.yml): conecta Grafana con Prometheus.
- [deploy/monitoring/dashboards/sifce-operacion.json](../deploy/monitoring/dashboards/sifce-operacion.json): el panel (lo genera `generar_panel.py`).

Se cargan solos al arrancar: no hubo que configurar nada a mano en la web de Grafana.

### Paso H · Todo junto en Docker

[deploy/docker-stack.yml](../deploy/docker-stack.yml) declara los servicios
`prometheus`, `alertmanager` y `grafana` con sus imágenes oficiales y les pasa
los archivos anteriores como *configs* de Swarm.

---

## Parte 3 · Cómo explicar una prueba

Todas las pruebas siguen el mismo esquema de 4 frases. Apréndete el esquema,
no el texto exacto:

> **1. Qué voy a romper** → **2. Qué debería pasar** → **3. Lo muestro** → **4. Qué requisito comprueba**

### Prueba 1 · Caída total (la principal)

1. *"Voy a apagar toda la API de SIFCE, como si el servidor se hubiera caído."*
   (ENTER en el paso 3 del script, o a mano: `docker service scale sifce_api=0`)
2. *"Prometheus va a dejar de recibir respuesta. Si pasan 15 segundos así,
   dispara la alerta crítica, Alertmanager la manda a PagerDuty y me llega al
   celular."*
3. Mostrar: en Grafana "Réplicas API" baja a 0; en Prometheus → Alerts,
   `SifceApiCaida` pasa a amarillo (*pending*) y luego a rojo (*firing*); suena
   el celular. Tocar **Acknowledge** ("ya lo vi, me encargo").
4. *"Esto comprueba el requisito RNF-D1, disponibilidad: si SIFCE se cae, el
   equipo se entera en segundos, sin que nadie esté mirando la pantalla."*

Recuperación: `docker service scale sifce_api=2` (paso 4). La alerta se apaga y
PagerDuty pasa el incidente a **Resolved** solo.

### Prueba 2 · Autorreparación

1. *"Voy a matar una de las dos copias de la API."* (paso 2)
2. *"SIFCE debería seguir funcionando con la otra copia, y Docker Swarm debe
   crear una nueva sola."*
3. Mostrar: la consola sigue diciendo que SIFCE responde (200) y "Réplicas API"
   baja a 1 y vuelve a 2 en unos 11 segundos.
4. *"Comprueba RNF-D1: una falla parcial no afecta a los usuarios."*

### Prueba 3 · Fuerza bruta (seguridad)

1. *"Voy a intentar entrar 5 veces con una contraseña incorrecta a la cuenta de Carlos."* (paso 5)
2. *"Al 5.º intento SIFCE bloquea la cuenta 15 minutos y avisa como posible ataque."*
3. Mostrar: el mensaje de cuenta bloqueada, la alerta `SifcePosibleFuerzaBruta`
   y, en Prometheus, `sifce_account_lockouts_total` subiendo. Luego desbloquearla:
   SIFCE → `superadmin@sifce.demo` → Usuarios → filtro *Bloqueados* → **Desbloquear**.
4. *"Comprueba RNF-S3: protección contra ataques de contraseña, y el operador
   puede resolverlo desde el panel."*

### Preguntas que puede hacer el profe

| Pregunta | Respuesta corta |
|---|---|
| ¿Por qué Prometheus y no otra herramienta? | Es gratis, de código abierto, es el estándar con Docker y se conecta directo con Grafana y PagerDuty |
| ¿Qué pasa si se cae Prometheus? | SIFCE sigue funcionando para los usuarios; solo se pierde la vigilancia hasta que Swarm lo levante otra vez |
| ¿Por qué esperar 15 segundos? | Para no despertar a nadie por un parpadeo; si dura 15 s es un problema real |
| ¿Dónde está la clave de PagerDuty? | En un secreto de Docker, nunca en el código ni en GitHub |
| ¿Diferencia con MONITOR (New Relic)? | OPERATE: "¿funciona ahora? Si no, ¡avisa!". MONITOR: "¿cómo se comporta con el tiempo y por qué está lento?" |
