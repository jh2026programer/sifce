# Operación de SIFCE en producción (ciclo de vida, etapa 7 · OPERATE)

Operar es mantener SIFCE funcionando día a día después de desplegarlo:
**detectar** cuando algo falla, **avisar** a la persona de turno,
**responder** y **resolver**. Este documento es el manual del operador.

## Herramientas

| Herramienta | Para qué | Dónde |
|---|---|---|
| **Docker Swarm** | Mantiene vivos los servicios: si una réplica de la API muere, crea otra (autorreparación) y actualiza sin caída | `docker stack services sifce` |
| **Prometheus** (diapositiva: monitorización del sistema) | Lee cada 5 s las métricas de cada réplica de la API (`/metrics`) y evalúa las reglas de alerta | http://localhost:9090/alerts |
| **Alertmanager** | Recibe las alertas de Prometheus, las agrupa y las envía a PagerDuty | http://localhost:9093 |
| **PagerDuty** (diapositiva: gestión de incidentes) | Abre un incidente, notifica al celular del operador de turno y lo cierra cuando el problema se resuelve | https://sifce.pagerduty.com |
| **Grafana** | Panel visual "SIFCE · Operación" con el estado en tiempo real | http://localhost:3000 |
| **Panel del Superadministrador** | Operación funcional: desbloquear cuentas, restablecer contraseñas, activar/desactivar empresas y usuarios | http://localhost:8080 → Usuarios / Empresas |

```
 réplicas de la API --/metrics--> Prometheus --alerta--> Alertmanager --> PagerDuty --> celular
                                      |
                                      +--> Grafana (panel)
```

## Métricas que expone SIFCE

| Métrica | Qué mide | Requisito del SRS |
|---|---|---|
| `up{job="sifce-api"}` | ¿Responde cada réplica? | RNF-D1 (disponibilidad ≥ 95 %) |
| `sifce_http_request_duration_seconds` | Tiempo de cada petición por ruta y código | RNF-R1 (≤ 3 s), RNF-F1 |
| `sifce_database_up` | ¿La API puede consultar PostgreSQL? | RNF-F2 |
| `sifce_ai_analyses_total{provider,result}` | Análisis de IA completados / fallidos | RF09, RNF-F4 |
| `sifce_logins_total{result}` y `sifce_account_lockouts_total` | Inicios de sesión y bloqueos por intentos fallidos | RF01, RNF-S3 |
| `sifce_applications_created_total` | Postulaciones recibidas | RF08 |
| `sifce_process_*` | Memoria y CPU de cada réplica | — |

## Alertas y qué hacer con cada una (runbook)

| Alerta | Severidad | Se dispara cuando | Qué hacer |
|---|---|---|---|
| **SifceApiCaida** | crítica | Ninguna réplica de la API responde durante 15 s | `docker service ps sifce_api` para ver por qué fallan; `docker service logs sifce_api`. Si no se recupera sola: `.\deploy\deploy.ps1` |
| **SifceReplicaApiCaida** | advertencia | Hay menos de 2 réplicas sanas | Normalmente Swarm la reemplaza en ~10 s y la alerta se resuelve sola. Si persiste, revisar logs |
| **SifceBaseDeDatosCaida** | crítica | La API no consulta PostgreSQL durante 15 s | `docker service ps sifce_db` y `docker service logs sifce_db`. Los datos están en el volumen `sifce_db-data` y no se pierden al reiniciar |
| **SifceRespuestaLenta** | advertencia | El p95 supera 3 s durante 1 min | Revisar CPU/memoria en Grafana; escalar: `docker service scale sifce_api=3` |
| **SifceErroresDelServidor** | error | Más de 1 error 500 cada 10 s | `docker service logs sifce_api` para ver el error; revertir la última versión si empezó tras un despliegue |
| **SifceFallasAnalisisIA** | error | Algún análisis de IA falló en 5 min | Clave inválida, cuota agotada o proveedor caído. Corregir la clave en `whatever\.env` y `.\deploy\deploy.ps1 -AiProvider groq`, o volver a `mock`. Los reclutadores reintentan desde el detalle de la postulación |
| **SifcePosibleFuerzaBruta** | advertencia | Alguna cuenta se bloqueó por intentos fallidos | Verificar con el titular. Si es legítimo: Superadmin → Usuarios → filtro "Bloqueados" → **Desbloquear** |

## Procedimientos frecuentes

### Desbloquear una cuenta o restablecer una contraseña
1. Iniciar sesión como superadministrador en http://localhost:8080.
2. Menú **Usuarios** → filtrar por nombre, correo o estado **Bloqueados**.
3. **Desbloquear** levanta el bloqueo de inmediato.
4. **Contraseña** asigna una nueva (mínimo 8 caracteres) y también desbloquea.
   Compartirla con el usuario por un canal seguro.

### Escalar la API
```powershell
docker service scale sifce_api=3      # Prometheus y Grafana detectan la réplica nueva solos
```

### Ver los logs en vivo
```powershell
docker service logs -f sifce_api
```

### Actualizar a una nueva versión
`.\deploy\deploy.ps1` reconstruye las imágenes con una etiqueta única por
contenido y Swarm reemplaza las réplicas de una en una (`start-first`): la
nueva arranca antes de apagar la vieja, sin caída. Si la nueva falla, Swarm
revierte sola (`failure_action: rollback`).

### Mantenimiento programado (RNF-D2)
Avisar a los usuarios con anticipación (correo o anuncio) indicando fecha,
hora y duración estimada, antes de ejecutar `.\deploy\remove.ps1`.

## Demostración sugerida (exposición)

1. **Estado normal**: Grafana con 2 réplicas, base OK, disponibilidad 100 %,
   p95 en milisegundos y 0 alertas; PagerDuty sin incidentes.
2. **Autorreparación**: matar una réplica
   (`docker kill (docker ps -q --filter name=sifce_api | Select-Object -First 1)`)
   → la app sigue respondiendo, Grafana muestra 1 réplica y Swarm la repone en
   ~10 s.
3. **Incidente real**: detener la API por completo
   (`docker service scale sifce_api=0`) → a los ~15 s Prometheus dispara
   `SifceApiCaida`, Alertmanager la envía, PagerDuty abre el incidente y
   **suena el celular**.
4. **Respuesta**: reconocer (*Acknowledge*) el incidente en el celular y
   restaurar el servicio (`docker service scale sifce_api=2`).
5. **Resolución**: la alerta se apaga y PagerDuty **cierra el incidente
   solo**; mostrar en PagerDuty los tiempos de reconocimiento y resolución
   (MTTA / MTTR).
