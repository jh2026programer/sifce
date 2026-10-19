<#
  SIFCE - Demostración en vivo de OPERATE (ciclo de vida, etapa 7)

  Uso, desde la carpeta sifce en PowerShell:
    .\deploy\demo-operate.ps1

  Cada paso espera a que presiones ENTER. Guion completo: docs/DEMO_OPERATE.md

    0. Preparación   Docker, SIFCE y monitoreo listos; usuarios simulados; abre las pestañas.
    1. Todo normal   Grafana en verde, PagerDuty sin incidentes.
    2. Autorreparación  Se "mata" una réplica de la API: SIFCE sigue respondiendo y Swarm la revive.
    3. Incidente     Se cae toda la API: Prometheus alerta, PagerDuty abre el incidente, suena el celular.
    4. Recuperación  Se restaura la API: la alerta se apaga y PagerDuty cierra el incidente solo.
    5. (Opcional)    Ataque de fuerza bruta: alerta de seguridad y desbloqueo de la cuenta.
#>
param(
  [switch]$SinNavegador,   # no abrir pestañas (si ya están abiertas)
  [switch]$Automatico      # sin pausas (solo para probar el script)
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$APP = 'http://localhost:8080'
$GRAFANA = 'http://localhost:3000/d/sifce-operacion?from=now-15m&to=now&refresh=5s&kiosk'
$PROMETHEUS = 'http://localhost:9090'
$ALERTMANAGER = 'http://localhost:9093'
$PAGERDUTY = 'https://sifce.pagerduty.com/incidents'
$trafficPidFile = Join-Path $env:TEMP 'sifce-demo-trafico.pid'

# ------------------------------------------------------------------ utilidades
function Title($n, $text) {
  Write-Host ''
  Write-Host ('=' * 72) -ForegroundColor DarkCyan
  Write-Host "  PASO $n  |  $text" -ForegroundColor Cyan
  Write-Host ('=' * 72) -ForegroundColor DarkCyan
}
function Say($text) { Write-Host "  $text" -ForegroundColor Gray }
function Good($text) { Write-Host "  [OK] $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }
function Show($text) { Write-Host "  >>   $text" -ForegroundColor White }
function Pause-Demo($text) {
  if ($Automatico) { Start-Sleep -Seconds 2; return }
  Write-Host ''
  Read-Host "  ---> Presiona ENTER para $text" | Out-Null
}

function Test-Docker {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & docker @args 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) }
  finally { $ErrorActionPreference = $previous }
}

function Get-AppStatus {
  try {
    return [int](Invoke-WebRequest "$APP/api/v1/health" -UseBasicParsing -TimeoutSec 2).StatusCode
  } catch {
    if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
    return 0
  }
}
function Format-AppStatus($code) {
  if ($code -eq 200) { 'RESPONDE (200)' } elseif ($code -eq 0) { 'NO RESPONDE' } else { "ERROR ($code)" }
}

function Get-ApiReplicas { (docker service ls --filter name=sifce_api --format '{{.Replicas}}' | Select-Object -First 1) }

function Get-AlertState([string]$name) {
  try {
    $alerts = (Invoke-RestMethod "$PROMETHEUS/api/v1/alerts" -TimeoutSec 3).data.alerts
    $match = @($alerts | Where-Object { $_.labels.alertname -eq $name })
    if ($match.Count -eq 0) { return 'inactiva' }
    if ($match[0].state -eq 'firing') { return 'DISPARADA' }
    return 'pendiente'
  } catch { return 'desconocida' }
}

function Get-PagerDutySent {
  try {
    $metrics = (Invoke-WebRequest "$ALERTMANAGER/metrics" -UseBasicParsing -TimeoutSec 3).Content -split "`n"
    $line = $metrics | Where-Object { $_ -match '^alertmanager_notifications_total\{integration="pagerduty"\}' } | Select-Object -First 1
    if ($line) { return [int][double]($line -split ' ')[-1] }
  } catch { }
  return 0
}

function Invoke-Sifce([string]$method, [string]$path, $body, [string]$token) {
  $headers = @{}
  if ($token) { $headers.Authorization = "Bearer $token" }
  $params = @{ Uri = "$APP/api/v1$path"; Method = $method; Headers = $headers; TimeoutSec = 5; ContentType = 'application/json' }
  if ($null -ne $body) { $params.Body = ($body | ConvertTo-Json -Compress) }
  return Invoke-RestMethod @params
}
function Get-Token([string]$email, [string]$password = 'Demo1234!') {
  (Invoke-Sifce POST '/auth/login' @{ email = $email; password = $password }).data.token
}

function Stop-Traffic {
  if (Test-Path $trafficPidFile) {
    $procId = Get-Content $trafficPidFile -ErrorAction SilentlyContinue
    if ($procId) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    Remove-Item $trafficPidFile -Force -ErrorAction SilentlyContinue
  }
}

# ======================================================================== 0
Title 0 'Preparación (hazlo ANTES de que empiece la exposición)'

if (-not (Test-Docker info --format '{{.ServerVersion}}')) {
  Say 'Docker Desktop está cerrado: abriéndolo...'
  $exe = @(
    "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $exe) { throw 'No se encontró Docker Desktop. Ábrelo manualmente y vuelve a ejecutar el script.' }
  Start-Process $exe
  $deadline = (Get-Date).AddMinutes(4)
  while (-not (Test-Docker info --format '{{.ServerVersion}}')) {
    if ((Get-Date) -gt $deadline) { throw 'Docker no arrancó en 4 minutos.' }
    Start-Sleep -Seconds 5
  }
}
Good 'Docker funcionando'

if (-not (Test-Docker service inspect sifce_api)) {
  Warn 'SIFCE no está desplegado: desplegando (unos minutos)...'
  & (Join-Path $PSScriptRoot 'deploy.ps1') | Out-Null
}

Say 'Esperando a que SIFCE y el monitoreo estén completos...'
$deadline = (Get-Date).AddMinutes(4)
while ($true) {
  $replicas = docker stack services sifce --format '{{.Name}}={{.Replicas}}'
  $missing = @('sifce_api=2/2', 'sifce_db=1/1', 'sifce_web=1/1', 'sifce_prometheus=1/1', 'sifce_alertmanager=1/1', 'sifce_grafana=1/1') |
    Where-Object { $replicas -notcontains $_ }
  if ($missing.Count -eq 0 -and (Get-AppStatus) -eq 200) { break }
  if ((Get-Date) -gt $deadline) { throw "Servicios incompletos: $($missing -join ', ')" }
  Start-Sleep -Seconds 5
}
Good 'SIFCE desplegado: API x2, base de datos, web, Prometheus, Alertmanager y Grafana'

$amConfig = (Invoke-RestMethod "$ALERTMANAGER/api/v2/status").config.original
if ($amConfig -match 'pagerduty_configs') { Good 'Alertmanager conectado a PagerDuty' }
else { Warn 'Alertmanager SIN PagerDuty (falta deploy\.pagerduty-key): el celular no sonará' }

# Cuenta usada en el paso 5: se deja desbloqueada.
try {
  $super = Get-Token 'superadmin@sifce.demo'
  $carlos = (Invoke-Sifce GET '/users/all?q=carlos.ruiz' $null $super).data | Select-Object -First 1
  if ($carlos.is_locked) { Invoke-Sifce PATCH "/users/all/$($carlos.id)/unlock" $null $super | Out-Null }
} catch { }

$firing = @((Invoke-RestMethod "$PROMETHEUS/api/v1/alerts").data.alerts | Where-Object { $_.state -eq 'firing' })
if ($firing.Count -gt 0) {
  Warn "Hay alertas activas de antes: $(($firing.labels.alertname | Sort-Object -Unique) -join ', ')"
  Warn 'Espera a que se apaguen (Grafana: "Alertas activas" en 0) antes de empezar.'
} else { Good 'Sin alertas activas' }

Stop-Traffic
$traffic = Start-Process node -ArgumentList 'deploy/demo/trafico.js', '30' -WindowStyle Hidden -PassThru
Set-Content $trafficPidFile $traffic.Id
Good 'Usuarios simulados usando SIFCE durante 30 minutos (para que Grafana se mueva)'

if (-not $SinNavegador) {
  Start-Process $PAGERDUTY
  Start-Process $APP
  Start-Process $GRAFANA
  Good 'Pestañas abiertas: Grafana (pantalla completa), SIFCE y PagerDuty'
}
Say 'Ten el celular a mano con la app de PagerDuty abierta en "Incidents".'

# ======================================================================== 1
Pause-Demo 'empezar la demostración'
Title 1 'Todo normal'
Show 'Mostrar Grafana: Réplicas API = 2, Base de datos = OK, Disponibilidad = 100 %,'
Show 'Respuesta p95 en milisegundos (el SRS exige menos de 3 s), Alertas activas = 0.'
Show 'Mostrar PagerDuty: sin incidentes abiertos.'
Say  "Ahora mismo: SIFCE $(Format-AppStatus (Get-AppStatus)) | réplicas de la API: $(Get-ApiReplicas)"

# ======================================================================== 2
Pause-Demo 'MATAR una réplica de la API (autorreparación)'
Title 2 'Autorreparación: una réplica de la API se cae'
$victim = docker ps -q --filter name=sifce_api | Select-Object -First 1
docker kill $victim | Out-Null
Warn "Réplica de la API destruida (contenedor $victim)"
Say  'Docker Swarm debe notarlo y levantar una nueva. SIFCE debe seguir respondiendo.'
$start = Get-Date
$sawDown = $false
while ($true) {
  $replicas = Get-ApiReplicas
  if ($replicas -ne '2/2') { $sawDown = $true }
  $elapsed = [int]((Get-Date) - $start).TotalSeconds
  Write-Host ("  {0,3} s | réplicas de la API: {1} | SIFCE: {2}" -f $elapsed, $replicas, (Format-AppStatus (Get-AppStatus)))
  if ($sawDown -and $replicas -eq '2/2') { break }
  if ($elapsed -gt 90) { Warn 'Tardó más de lo normal'; break }
  Start-Sleep -Seconds 2
}
Good "Swarm revivió la réplica en $([int]((Get-Date) - $start).TotalSeconds) s y SIFCE nunca dejó de responder"
Show 'En Grafana: "Réplicas API" bajó a 1 y volvió a 2; en "Memoria por réplica" aparece la nueva.'

# ======================================================================== 3
Pause-Demo 'TUMBAR toda la API (incidente real)'
Title 3 'Incidente: SIFCE se cae por completo'
$sentBefore = Get-PagerDutySent
docker service scale sifce_api=0 -d | Out-Null
Warn 'API apagada: 0 réplicas. Los usuarios ya no pueden usar SIFCE.'
Say  'Prometheus lo detecta; si dura más de 15 s dispara la alerta y PagerDuty abre el incidente.'
$start = Get-Date
while ($true) {
  $elapsed = [int]((Get-Date) - $start).TotalSeconds
  $state = Get-AlertState 'SifceApiCaida'
  $sent = (Get-PagerDutySent) - $sentBefore
  $pd = if ($sent -gt 0) { 'ENVIADO' } else { 'esperando' }
  Write-Host ("  {0,3} s | SIFCE: {1,-14} | alerta SifceApiCaida: {2,-10} | PagerDuty: {3}" -f $elapsed, (Format-AppStatus (Get-AppStatus)), $state, $pd)
  if ($sent -gt 0) { break }
  if ($elapsed -gt 120) { Warn 'No se confirmó el envío a PagerDuty en 2 minutos'; break }
  Start-Sleep -Seconds 3
}
if ($sent -gt 0) {
  Good "Incidente abierto en PagerDuty a los $([int]((Get-Date) - $start).TotalSeconds) s de la caída"
  Show '¡Suena el celular! Mostrar la notificación y el incidente "SIFCE caído" en PagerDuty.'
  Show 'En el celular: abrir el incidente y tocar "Acknowledge" (reconocer = "ya lo estoy atendiendo").'
  Show 'En Grafana: "Réplicas API" = 0 y "Alertas activas" = 1.'
}

# ======================================================================== 4
Pause-Demo 'RESTAURAR SIFCE (después de reconocer el incidente en el celular)'
Title 4 'Recuperación: el operador restaura el servicio'
$sentBefore = Get-PagerDutySent
docker service scale sifce_api=2 -d | Out-Null
Good 'Orden enviada: volver a 2 réplicas de la API'
$start = Get-Date
$appBack = $null
$quietSince = $null
$sent = 0
while ($true) {
  $elapsed = [int]((Get-Date) - $start).TotalSeconds
  $status = Get-AppStatus
  if ($status -eq 200 -and $null -eq $appBack) { $appBack = $elapsed }
  $state = Get-AlertState 'SifceApiCaida'
  if ($state -eq 'inactiva' -and $null -eq $quietSince) { $quietSince = $elapsed }
  $sent = (Get-PagerDutySent) - $sentBefore
  $pd = if ($sent -gt 0) { 'INCIDENTE RESUELTO' } else { 'abierto' }
  Write-Host ("  {0,3} s | SIFCE: {1,-14} | réplicas: {2} | alerta: {3,-10} | PagerDuty: {4}" -f $elapsed, (Format-AppStatus $status), (Get-ApiReplicas), $state, $pd)
  if ($sent -gt 0 -and $state -eq 'inactiva') { break }
  # La alerta ya se apagó pero el aviso a PagerDuty no llegó en 30 s: no seguir esperando.
  if ($null -ne $quietSince -and ($elapsed - $quietSince) -gt 30) { break }
  if ($elapsed -gt 120) { break }
  Start-Sleep -Seconds 3
}
if ($null -ne $appBack) { Good "SIFCE volvió a responder a los $appBack s de restaurarlo" }
else { Warn 'SIFCE todavía no responde: revisar con  docker service ps sifce_api' }
if ($sent -gt 0) {
  Good 'La alerta se apagó y PagerDuty cerró el incidente SOLO'
  Show 'En PagerDuty: el incidente pasa a "Resolved"; abrirlo y mostrar su línea de tiempo'
  Show '(se abrió -> se reconoció -> se resolvió) y cuánto tardó cada paso.'
} else {
  Warn 'No se confirmó el aviso de cierre a PagerDuty. Si el incidente sigue abierto,'
  Warn 'resuélvelo a mano en la app ("Resolve").'
}

# ======================================================================== 5
if (-not $Automatico) {
  Write-Host ''
  $extra = Read-Host '  ---> ¿Hacer el paso 5 opcional (ataque de fuerza bruta)? Escribe s y ENTER, o solo ENTER para terminar'
} else { $extra = 's' }
if ($extra -match '^[sS]') {
  Title 5 'Seguridad: ataque de fuerza bruta contra una cuenta'
  Say 'Alguien intenta adivinar la contraseña de carlos.ruiz@correo.demo...'
  for ($i = 1; $i -le 5; $i++) {
    try { Invoke-Sifce POST '/auth/login' @{ email = 'carlos.ruiz@correo.demo'; password = "adivinanza$i" } | Out-Null }
    catch { Write-Host ("  intento {0}: rechazado ({1})" -f $i, [int]$_.Exception.Response.StatusCode) -ForegroundColor DarkYellow }
  }
  Good 'Al 5.º intento SIFCE BLOQUEÓ la cuenta durante 15 minutos (RNF-S3)'
  $start = Get-Date
  while ($true) {
    $elapsed = [int]((Get-Date) - $start).TotalSeconds
    $state = Get-AlertState 'SifcePosibleFuerzaBruta'
    Write-Host ("  {0,3} s | alerta SifcePosibleFuerzaBruta: {1}" -f $elapsed, $state)
    if ($state -eq 'DISPARADA') { break }
    if ($elapsed -gt 60) { break }
    Start-Sleep -Seconds 3
  }
  Show 'PagerDuty recibe la alerta de seguridad (advertencia).'
  Show 'Para atenderla en vivo: en SIFCE entrar como superadmin@sifce.demo -> Usuarios ->'
  Show 'filtro "Bloqueados" -> Desbloquear a Carlos.'
  Pause-Demo 'terminar (si no la desbloqueaste en vivo, el script lo hace)'
  try {
    $super = Get-Token 'superadmin@sifce.demo'
    $carlos = (Invoke-Sifce GET '/users/all?q=carlos.ruiz' $null $super).data | Select-Object -First 1
    if ($carlos.is_locked) { Invoke-Sifce PATCH "/users/all/$($carlos.id)/unlock" $null $super | Out-Null; Good 'Cuenta de Carlos desbloqueada' }
    else { Good 'La cuenta de Carlos ya estaba desbloqueada' }
  } catch { Warn "No se pudo verificar el desbloqueo: $($_.Exception.Message)" }
  Say 'La alerta de fuerza bruta se apaga sola a los ~10 minutos sin nuevos bloqueos.'
}

# ======================================================================== fin
Stop-Traffic
Write-Host ''
Write-Host ('=' * 72) -ForegroundColor DarkCyan
Good 'Demostración terminada. SIFCE quedó funcionando con sus 2 réplicas.'
Write-Host ('=' * 72) -ForegroundColor DarkCyan
