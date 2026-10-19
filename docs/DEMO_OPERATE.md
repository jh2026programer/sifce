# Guía de la demostración en vivo · OPERATE (etapa 7)

Todo lo hace un solo script. Tú solo presionas **ENTER** y muestras lo que
indica cada paso.

```powershell
.\deploy\demo-operate.ps1
```

Duración: unos **5 minutos** (6 con el paso opcional).

## Cómo funciona (para que no te pierdas)

```
 SIFCE (API x2) --métricas cada 5 s--> PROMETHEUS --"¡falla!"--> ALERTMANAGER --> PAGERDUTY --> celular
                                          |
                                          +--> GRAFANA (lo que se proyecta)
 DOCKER SWARM: vigila los contenedores y revive los que mueren
```

| Pieza | En una frase |
|---|---|
| Docker Swarm | El guardaespaldas: si un contenedor muere, levanta otro solo |
| Prometheus | El vigilante: cada 5 s pregunta a SIFCE cómo está; si algo grave dura más de 15 s, alerta |
| Alertmanager | El mensajero: lleva la alerta a PagerDuty |
| PagerDuty | El despertador: abre el incidente, suena el celular y lo cierra cuando se arregla |
| Grafana | La pantalla: muestra todo en vivo |

## El día anterior

- [ ] Abrir Docker Desktop y correr `.\deploy\demo-operate.ps1` completo una vez (ensayo).
- [ ] Confirmar que el celular **suena con la app cerrada** (PagerDuty → Mi perfil →
      Métodos de contacto → *Probar*). Si no: Ajustes del celular → Apps → PagerDuty →
      Notificaciones permitidas y Batería **sin restricciones**.
- [ ] PagerDuty sigue activo (la prueba gratis dura 14 días; si vence antes, pasar al plan *Free*).

## 15 minutos antes de exponer

1. Abrir **Docker Desktop** y esperar "Engine running".
2. Abrir PowerShell en la carpeta `sifce` y ejecutar `.\deploy\demo-operate.ps1`.
3. El **paso 0** deja todo listo y abre tres pestañas: Grafana (pantalla
   completa), SIFCE y PagerDuty.
4. Si dice **"Hay alertas activas de antes"**, esperar a que en Grafana
   "Alertas activas" llegue a 0 (máximo 10 minutos).
5. Celular con sonido, app de PagerDuty abierta en *Incidents*.
6. **No presionar ENTER** hasta que empiece la exposición.

## Durante la demostración

| Paso | Qué hace el script | Qué muestras | Tiempo |
|---|---|---|---|
| **1. Todo normal** | Nada: confirma que todo está sano | Grafana: Réplicas API = 2, Base de datos = OK, Disponibilidad = 100 %, Respuesta p95 en ms, Alertas = 0. PagerDuty sin incidentes | — |
| **2. Autorreparación** | Destruye una de las 2 réplicas de la API | En la consola: SIFCE **sigue respondiendo (200)** mientras las réplicas bajan a 1/2 y vuelven a 2/2. En Grafana, "Réplicas API" baja y sube | ~11 s |
| **3. Incidente** | Apaga toda la API | En la consola: SIFCE *NO RESPONDE*, la alerta pasa de *inactiva* → *pendiente* → **DISPARADA** → PagerDuty **ENVIADO**. **¡Suena el celular!** Mostrar la notificación y el incidente "SIFCE caído". En el celular tocar **Acknowledge** | ~40 s |
| **4. Recuperación** | Vuelve a levantar las 2 réplicas | SIFCE responde de nuevo, la alerta se apaga y PagerDuty pasa el incidente a **Resolved solo**. Abrir el incidente y mostrar su línea de tiempo (abierto → reconocido → resuelto) | ~30 s |
| **5. (Opcional) Fuerza bruta** | 5 contraseñas incorrectas contra la cuenta de Carlos | La cuenta se bloquea al 5.º intento y se dispara la alerta de seguridad. Desbloquearla en vivo: SIFCE → `superadmin@sifce.demo` (Demo1234!) → Usuarios → filtro *Bloqueados* → **Desbloquear** | ~15 s |

Al final el script deja SIFCE funcionando con sus 2 réplicas y la cuenta de
Carlos desbloqueada.

## Si algo sale mal

| Problema | Solución |
|---|---|
| "Docker no responde" | Abrir Docker Desktop a mano, esperar "Engine running" y volver a ejecutar |
| El celular no suena | Mostrar el incidente en la web de PagerDuty (pestaña ya abierta). Después revisar notificaciones/batería del celular |
| Grafana se ve vacío | Esperar unos segundos (se actualiza cada 5 s) o recargar la pestaña |
| El paso 3 dice "No se confirmó el envío a PagerDuty" | Revisar que exista `deploy\.pagerduty-key` y que no haya silencios en http://localhost:9093/#/silences |
| SIFCE no vuelve después del paso 4 | `docker service scale sifce_api=2` |
| Un incidente quedó abierto en PagerDuty | Resolverlo a mano en la app (*Resolve*) |
