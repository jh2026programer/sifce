<#
  SIFCE - Despliegue en Docker Swarm (etapas 6 · DEPLOY y 7 · OPERATE)

  Uso (desde cualquier carpeta, en PowerShell):
    .\deploy\deploy.ps1                       # IA en modo mock (demo, sin costo)
    .\deploy\deploy.ps1 -AiProvider groq      # IA real; toma AI_API_KEY de whatever\.env

  Qué hace:
    1. Verifica que Docker esté corriendo y activa el modo Swarm si hace falta.
    2. Construye las imágenes sifce-api y sifce-web (versión de package.json).
    3. Prepara los secretos de Swarm: contraseña de la base y clave JWT
       (aleatorias, se crean una sola vez), clave de IA, clave de PagerDuty
       (si existe deploy\.pagerduty-key) y contraseña del admin de Grafana.
    4. Despliega el stack "sifce" (app + Prometheus, Alertmanager y Grafana)
       y espera a que todos los servicios estén listos.
#>
param(
  [ValidateSet('mock', 'groq', 'anthropic', 'openai')]
  [string]$AiProvider = 'mock'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

function Invoke-Docker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Falló: docker $($args -join ' ')" }
}

# Consulta a Docker que puede fallar sin que sea un error (ej. "¿existe este
# secreto?"). En PowerShell 5.1 redirigir el stderr de un programa con
# ErrorActionPreference=Stop lo vuelve un error fatal; aquí se evita.
function Test-Docker {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & docker @args 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) }
  finally { $ErrorActionPreference = $previous }
}

# Huella corta (10 caracteres) de un archivo o de un texto.
function Get-FileFingerprint([string]$path) { (Get-FileHash $path -Algorithm SHA256).Hash.Substring(0, 10).ToLower() }
function Get-TextFingerprint([string]$text) {
  $sha = [Security.Cryptography.SHA256]::Create()
  $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text))
  (-join ($bytes | ForEach-Object { $_.ToString('x2') })).Substring(0, 10)
}

# --- 1. Docker y Swarm ---------------------------------------------------
Step 'Verificando Docker'
if (-not (Test-Docker info --format '{{.ServerVersion}}')) { throw 'Docker no responde. Abre Docker Desktop y espera a que diga "Engine running".' }

$swarm = docker info --format '{{.Swarm.LocalNodeState}}'
if ($swarm -ne 'active') {
  Step 'Activando Docker Swarm (nodo único)'
  if (-not (Test-Docker swarm init)) { Invoke-Docker swarm init --advertise-addr 127.0.0.1 | Out-Null }
}

# --- 2. Imágenes ----------------------------------------------------------
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
Step "Construyendo imágenes sifce-api:$version y sifce-web:$version"
Invoke-Docker build -f whatever/Dockerfile -t "sifce-api:$version" .
Invoke-Docker build -f view/Dockerfile -t "sifce-web:$version" .

# Etiqueta única por contenido (ej. 1.0.0-e550367e04a6). Si solo se usara
# "1.0.0", Swarm creería que la imagen no cambió y NO actualizaría los
# contenedores después de un cambio de código.
function Set-UniqueTag([string]$image) {
  $id = (docker image inspect "${image}:$version" --format '{{.Id}}').Replace('sha256:', '').Substring(0, 12)
  Invoke-Docker tag "${image}:$version" "${image}:$version-$id"
  return "$version-$id"
}
$env:SIFCE_API_TAG = Set-UniqueTag 'sifce-api'
$env:SIFCE_WEB_TAG = Set-UniqueTag 'sifce-web'
Write-Host "   sifce-api:$($env:SIFCE_API_TAG)   sifce-web:$($env:SIFCE_WEB_TAG)"

# --- 3. Secretos ----------------------------------------------------------
function New-SwarmSecret([string]$name, [string]$value) {
  if (Test-Docker secret inspect $name) { Write-Host "   secreto $name ya existe"; return }
  # Archivo temporal sin salto de línea final (evita espacios ocultos en la clave).
  $tmp = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($tmp, $value)
    Invoke-Docker secret create $name $tmp | Out-Null
    Write-Host "   secreto $name creado"
  } finally { Remove-Item $tmp -Force }
}
function New-RandomKey { ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')) }

Step 'Preparando secretos de Swarm'
# Se crean una sola vez: la base ya inicializada depende de esta contraseña.
New-SwarmSecret 'sifce_db_password' (New-RandomKey)
New-SwarmSecret 'sifce_jwt_secret' (New-RandomKey)

# Contraseña del admin de Grafana: se guarda en un archivo local (ignorado por Git).
$grafanaFile = Join-Path $PSScriptRoot '.grafana-admin.txt'
if (-not (Test-Docker secret inspect sifce_grafana_admin_password)) {
  $grafanaPassword = (New-RandomKey).Substring(0, 16)
  [IO.File]::WriteAllText($grafanaFile, "usuario: admin`r`ncontraseña: $grafanaPassword`r`n")
  New-SwarmSecret 'sifce_grafana_admin_password' $grafanaPassword
} else { Write-Host '   secreto sifce_grafana_admin_password ya existe' }

# Clave de IA: un secreto por proveedor y contenido, así cambiar de mock a
# groq (o cambiar la clave) no obliga a borrar nada.
$aiKey = 'sin-clave'
if ($AiProvider -ne 'mock') {
  $line = Get-Content whatever/.env -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*AI_API_KEY\s*=\s*\S' } | Select-Object -First 1
  if (-not $line) { throw "AiProvider=$AiProvider necesita AI_API_KEY en whatever\.env" }
  $aiKey = ($line -split '=', 2)[1].Trim()
}
$env:SIFCE_AI_SECRET = "sifce_ai_key_${AiProvider}_$(Get-TextFingerprint $aiKey)"
New-SwarmSecret $env:SIFCE_AI_SECRET $aiKey

# PagerDuty: si existe deploy\.pagerduty-key, las alertas abren incidentes.
$pdFile = Join-Path $PSScriptRoot '.pagerduty-key'
$pdKey = if (Test-Path $pdFile) { (Get-Content $pdFile -Raw).Trim() } else { '' }
if ($pdKey) {
  $env:SIFCE_ALERTMANAGER_FILE = 'alertmanager.yml'
  Write-Host '   PagerDuty: clave encontrada, las alertas abrirán incidentes'
} else {
  $pdKey = 'sin-clave'
  $env:SIFCE_ALERTMANAGER_FILE = 'alertmanager-sin-pagerduty.yml'
  Write-Host '   PagerDuty: sin deploy\.pagerduty-key, las alertas solo se verán en Prometheus/Alertmanager' -ForegroundColor Yellow
}
$env:SIFCE_PAGERDUTY_SECRET = "sifce_pagerduty_key_$(Get-TextFingerprint $pdKey)"
New-SwarmSecret $env:SIFCE_PAGERDUTY_SECRET $pdKey

# --- 4. Despliegue --------------------------------------------------------
$monitoring = Join-Path $PSScriptRoot 'monitoring'
$env:SIFCE_VERSION = $version
$env:AI_PROVIDER = $AiProvider
$env:SIFCE_SCHEMA_HASH = Get-FileFingerprint 'model/schema.sql'
$env:SIFCE_PROMETHEUS_HASH = Get-FileFingerprint "$monitoring/prometheus.yml"
$env:SIFCE_RULES_HASH = Get-FileFingerprint "$monitoring/alert-rules.yml"
$env:SIFCE_ALERTMANAGER_HASH = Get-FileFingerprint "$monitoring/$($env:SIFCE_ALERTMANAGER_FILE)"
$env:SIFCE_GRAFANA_DS_HASH = Get-FileFingerprint "$monitoring/grafana-datasource.yml"
$env:SIFCE_GRAFANA_PROV_HASH = Get-FileFingerprint "$monitoring/grafana-dashboards.yml"
$env:SIFCE_GRAFANA_DASH_HASH = Get-FileFingerprint "$monitoring/dashboards/sifce-operacion.json"

Step "Desplegando el stack 'sifce' (IA: $AiProvider)"
Invoke-Docker stack deploy --detach=false -c deploy/docker-stack.yml sifce

Step 'Estado de los servicios'
Invoke-Docker stack services sifce

Write-Host "`nSIFCE $version desplegado:" -ForegroundColor Green
Write-Host '  Aplicación      http://localhost:8080   (usuarios demo en el README, contraseña Demo1234!)'
Write-Host '  Grafana         http://localhost:3000   (panel SIFCE · Operación; admin en deploy\.grafana-admin.txt)'
Write-Host '  Prometheus      http://localhost:9090/alerts'
Write-Host '  Alertmanager    http://localhost:9093'
