# Genera dashboards/sifce-operacion.json (panel de Grafana "SIFCE · Operación").
# Uso desde la raíz: python deploy/monitoring/generar_panel.py deploy/monitoring/dashboards/sifce-operacion.json
# Después: .\deploy\deploy.ps1 (el panel nuevo se carga como una config nueva de Swarm).
import json, sys

DS = {"type": "prometheus", "uid": "prometheus"}
panels = []
pid = [0]

def nid():
    pid[0] += 1
    return pid[0]

def target(expr, legend="", instant=False):
    t = {"datasource": DS, "expr": expr, "legendFormat": legend, "refId": chr(64 + 1)}
    if instant:
        t["instant"] = True
    return t

def row(title, y):
    panels.append({"type": "row", "title": title, "id": nid(), "collapsed": False,
                   "gridPos": {"h": 1, "w": 24, "x": 0, "y": y}, "panels": []})

def stat(title, desc, expr, x, y, w=4, h=5, unit="none", steps=None, mappings=None, legend="", decimals=None, text_mode="auto"):
    fc = {"unit": unit, "thresholds": {"mode": "absolute", "steps": steps or [{"color": "green", "value": None}]}}
    if mappings:
        fc["mappings"] = mappings
    if decimals is not None:
        fc["decimals"] = decimals
    panels.append({
        "type": "stat", "title": title, "description": desc, "id": nid(), "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y},
        "targets": [target(expr, legend)],
        "fieldConfig": {"defaults": fc, "overrides": []},
        "options": {"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                    "colorMode": "background", "graphMode": "none", "textMode": text_mode, "justifyMode": "center"},
    })

def ts(title, desc, targets, x, y, w=12, h=8, unit="none", threshold=None, stack=False, colors=None):
    fc = {"unit": unit, "custom": {"lineWidth": 2, "fillOpacity": 15, "showPoints": "never",
                                   "stacking": {"mode": "normal" if stack else "none", "group": "A"}}}
    if threshold is not None:
        fc["thresholds"] = {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "red", "value": threshold}]}
        fc["custom"]["thresholdsStyle"] = {"mode": "line+area"}
    tg = []
    for i, (expr, legend) in enumerate(targets):
        t = target(expr, legend)
        t["refId"] = chr(65 + i)
        tg.append(t)
    panels.append({
        "type": "timeseries", "title": title, "description": desc, "id": nid(), "datasource": DS,
        "gridPos": {"h": h, "w": w, "x": x, "y": y}, "targets": tg,
        "fieldConfig": {"defaults": fc, "overrides": [
            {"matcher": {"id": "byName", "options": name},
             "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": color}}]}
            for name, color in (colors or {}).items()]},
        "options": {"legend": {"displayMode": "list", "placement": "bottom", "showLegend": True},
                    "tooltip": {"mode": "multi", "sort": "desc"}},
    })

RED, GREEN, ORANGE = "red", "green", "orange"

# ---------------------------------------------------------------- Estado
row("Estado de SIFCE ahora", 0)
stat("Réplicas API", "Réplicas de la API que responden a Prometheus. Se esperan 2 (Swarm reemplaza las que caen).",
     'sum(up{job="sifce-api"}) or vector(0)', 0, 1,
     steps=[{"color": RED, "value": None}, {"color": ORANGE, "value": 1}, {"color": GREEN, "value": 2}])
stat("Base de datos", "¿La API puede consultar PostgreSQL? (RNF-F2)",
     'min(sifce_database_up) or vector(0)', 4, 1,
     steps=[{"color": RED, "value": None}, {"color": GREEN, "value": 1}],
     mappings=[{"type": "value", "options": {"0": {"text": "CAÍDA"}, "1": {"text": "OK"}}}])
stat("Disponibilidad 1 h", "Porcentaje del tiempo observado en la última hora con al menos una réplica respondiendo. RNF-D1 exige ≥ 95 %.",
     'avg_over_time(max(up{job="sifce-api"})[1h:15s]) * 100', 8, 1, unit="percent", decimals=2,
     steps=[{"color": RED, "value": None}, {"color": ORANGE, "value": 95}, {"color": GREEN, "value": 99}])
stat("Respuesta p95", "El 95 % de las peticiones responde en menos de este tiempo. RNF-R1 exige ≤ 3 s.",
     'histogram_quantile(0.95, sum by (le) (rate(sifce_http_request_duration_seconds_bucket[5m])))', 12, 1, unit="s", decimals=3,
     steps=[{"color": GREEN, "value": None}, {"color": ORANGE, "value": 1}, {"color": RED, "value": 3}])
stat("Alertas activas", "Reglas de alerta disparadas ahora mismo (se envían a PagerDuty).",
     'count(ALERTS{alertstate="firing"}) or vector(0)', 16, 1,
     steps=[{"color": GREEN, "value": None}, {"color": RED, "value": 1}])
stat("Proveedor IA", "Motor de IA configurado en la API.",
     'max by (provider) (sifce_ai_provider_info)', 20, 1, legend="{{provider}}", text_mode="name",
     steps=[{"color": "blue", "value": None}])

# ---------------------------------------------------------------- Tráfico
row("Tráfico y rendimiento (RNF-R1, RNF-F1)", 6)
ts("Peticiones por segundo según código de respuesta", "Errores 5xx sostenidos disparan la alerta SifceErroresDelServidor.",
   [('sum by (status_code) (rate(sifce_http_request_duration_seconds_count[1m]))', "{{status_code}}")],
   0, 7, unit="reqps",
   colors={"200": "green", "201": "green", "304": "blue", "400": "orange", "401": "orange",
           "404": "orange", "429": "orange", "500": "red"})
ts("Tiempo de respuesta (p50 y p95)", "La zona roja marca el límite del SRS: 3 segundos.",
   [('histogram_quantile(0.50, sum by (le) (rate(sifce_http_request_duration_seconds_bucket[2m])))', "p50 (mediana)"),
    ('histogram_quantile(0.95, sum by (le) (rate(sifce_http_request_duration_seconds_bucket[2m])))', "p95")],
   12, 7, unit="s", threshold=3)

# ---------------------------------------------------------------- Negocio
row("Uso del sistema e IA (RF01, RF08, RF09, RNF-F4, RNF-S3)", 15)
ts("Análisis de IA (cada 5 min)", "Completados vs fallidos por proveedor. Un fallo dispara SifceFallasAnalisisIA.",
   [('sum by (provider, result) (increase(sifce_ai_analyses_total[5m]))', "{{provider}} · {{result}}")], 0, 16, w=8)
ts("Inicios de sesión (cada 5 min)", "Por resultado: success, invalid, locked, inactive.",
   [('sum by (result) (increase(sifce_logins_total[5m]))', "{{result}}")], 8, 16, w=8)
ts("Cuentas bloqueadas y postulaciones (cada 10 min)", "Bloqueos por intentos fallidos (posible fuerza bruta) y postulaciones recibidas.",
   [('sum(increase(sifce_account_lockouts_total[10m]))', "cuentas bloqueadas"),
    ('sum(increase(sifce_applications_created_total[10m]))', "postulaciones")], 16, 16, w=8)

# ---------------------------------------------------------------- Recursos
row("Recursos de cada réplica", 24)
ts("Memoria por réplica", "Memoria residente de cada contenedor de la API.",
   [('sifce_process_resident_memory_bytes{job="sifce-api"}', "{{instance}}")], 0, 25, unit="bytes")
ts("CPU por réplica", "Uso de CPU de cada contenedor de la API.",
   [('rate(sifce_process_cpu_seconds_total{job="sifce-api"}[1m])', "{{instance}}")], 12, 25, unit="percentunit")

dashboard = {
    "uid": "sifce-operacion",
    "title": "SIFCE · Operación",
    "description": "Salud de SIFCE en producción (Docker Swarm). Ciclo de vida, etapa 7 · OPERATE.",
    "tags": ["sifce", "operate"],
    "timezone": "browser",
    "editable": False,
    "refresh": "5s",
    "time": {"from": "now-30m", "to": "now"},
    "schemaVersion": 39,
    "version": 1,
    "panels": panels,
    "templating": {"list": []},
    "annotations": {"list": [{
        "builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"}, "enable": True, "hide": True,
        "iconColor": "rgba(0, 211, 255, 1)", "name": "Annotations & Alerts", "type": "dashboard"}]},
}
json.dump(dashboard, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("paneles:", len(panels))
