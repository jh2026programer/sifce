# Monitoreo del rendimiento (ciclo de vida, etapa 8 · MONITOR)

**Operate** (etapa 7, `docs/OPERACION.md`) responde *"¿SIFCE funciona ahora
mismo? Si no, ¡avisa!"*. **Monitor** responde *"¿cómo se comporta SIFCE con
el tiempo, y por qué?"*: qué es lento, qué falla con más frecuencia y dónde
se va el tiempo de cada petición, para mejorar continuamente.

Herramienta: **New Relic APM** (diapositiva: supervisión del rendimiento de
las aplicaciones — New Relic o Dynatrace), plan gratuito permanente.

## Cómo está conectado

- `whatever/instrumentation.js` carga el agente oficial (`newrelic`) antes que
  Express y `pg`, así mide cada petición HTTP y cada consulta a PostgreSQL.
  `whatever/server.js` lo requiere en su primera línea.
- Solo se activa si hay clave de licencia (*Ingest - License*):
  - Docker Swarm: archivo `deploy/.newrelic-key` (ignorado por Git) → secreto
    de Swarm → `NEW_RELIC_LICENSE_KEY_FILE`.
  - Desarrollo (opcional): `NEW_RELIC_LICENSE_KEY` en `whatever/.env`.
  - Sin clave el agente no se carga y SIFCE funciona igual. Las pruebas
    automáticas nunca lo cargan.
- **Privacidad**: nunca se envían el cuerpo de las peticiones, las cabeceras
  de autenticación ni las cookies (contraseñas, datos de candidatos); solo
  rutas, tiempos y errores.
- Aplicación en New Relic: **"SIFCE (Docker Swarm)"**, con las 2 réplicas de la
  API agrupadas.

## Dónde mirar en New Relic

Entrar a https://one.newrelic.com → **APM & Services** → **SIFCE (Docker Swarm)**.

| Sección | Qué responde | Requisito relacionado |
|---|---|---|
| **Summary** | Tiempo de respuesta, peticiones por minuto, tasa de errores y *Apdex* (satisfacción del usuario) en el tiempo | RNF-R1, RNF-F1 |
| **Transactions** | ¿Cuáles endpoints son los más lentos o los más usados? Cada uno con su desglose (Express, PostgreSQL, IA) | RNF-R1 |
| **Databases** | ¿Qué consultas a PostgreSQL tardan más y cuántas veces se ejecutan? | RNF-R1, RNF-F2 |
| **Distributed tracing** | La traza completa de una petición: cada paso con su duración | — |
| **Errors inbox** | Errores agrupados con su detalle y frecuencia | RNF-F1, RNF-F4 |
| **Service map** | Con qué se comunica la API (PostgreSQL, proveedor de IA) | — |

## Rutina de monitoreo sugerida

- **Semanal**: revisar en *Transactions* el top 5 de endpoints más lentos y en
  *Databases* las consultas más costosas; si alguno se acerca a 1 s, abrir una
  tarjeta en Trello (PLAN) para optimizarlo.
- **Tras cada despliegue**: comparar en *Summary* el tiempo de respuesta y la
  tasa de errores antes y después (cada despliegue aparece en la línea de
  tiempo del gráfico).
- **Mensual**: revisar *Errors inbox* y cerrar o convertir en tareas los
  errores recurrentes.
