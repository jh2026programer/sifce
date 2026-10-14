<#
  SIFCE - Despliegue en Docker Swarm (ciclo de vida, etapa 6 · DEPLOY)

  Uso (desde cualquier carpeta, en PowerShell):
    .\deploy\deploy.ps1                       # IA en modo mock (demo, sin costo)
    .\deploy\deploy.ps1 -AiProvider groq      # IA real; toma AI_API_KEY de whatever\.env

  Qué hace:
    1. Verifica que Docker esté corriendo y activa el modo Swarm si hace falta.
    2. Construye las imágenes sifce-api y sifce-web (versión de package.json).
    3. Crea los secretos de Swarm la primera vez (contraseña de la base, clave
       JWT y clave de IA). Nunca se muestran ni quedan en el código.
    4. Despliega el stack "sifce" y espera a que todos los servicios estén listos.
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
New-SwarmSecret 'sifce_db_password' (New-RandomKey)
New-SwarmSecret 'sifce_jwt_secret' (New-RandomKey)

$aiKey = 'sin-clave'
if ($AiProvider -ne 'mock') {
  $line = Get-Content whatever/.env -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*AI_API_KEY\s*=\s*\S' } | Select-Object -First 1
  if (-not $line) { throw "AiProvider=$AiProvider necesita AI_API_KEY en whatever\.env" }
  $aiKey = ($line -split '=', 2)[1].Trim()
}
if ((Test-Docker secret inspect sifce_ai_api_key) -and $AiProvider -ne 'mock') {
  Write-Host '   (la clave de IA ya existía; para cambiarla: .\deploy\remove.ps1 -BorrarSecretos y vuelve a desplegar)'
}
New-SwarmSecret 'sifce_ai_api_key' $aiKey

# --- 4. Despliegue --------------------------------------------------------
Step "Desplegando el stack 'sifce' (IA: $AiProvider)"
$env:SIFCE_VERSION = $version
$env:AI_PROVIDER = $AiProvider
Invoke-Docker stack deploy --detach=false -c deploy/docker-stack.yml sifce

Step 'Estado de los servicios'
Invoke-Docker stack services sifce

Write-Host "`nSIFCE $version desplegado en http://localhost:8080" -ForegroundColor Green
Write-Host 'Usuarios demo: ver README (contraseña Demo1234!). Los datos demo pueden tardar unos segundos en cargarse la primera vez.'
