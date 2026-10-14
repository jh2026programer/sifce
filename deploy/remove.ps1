<#
  SIFCE - Detener el despliegue de Docker Swarm.

    .\deploy\remove.ps1                    # detiene los servicios; CONSERVA los datos
    .\deploy\remove.ps1 -BorrarDatos       # además borra la base y las hojas de vida del despliegue
    .\deploy\remove.ps1 -BorrarSecretos    # además borra los secretos (se regeneran al desplegar)
#>
param([switch]$BorrarDatos, [switch]$BorrarSecretos)

docker stack rm sifce
if ($BorrarDatos -or $BorrarSecretos) {
  Write-Host 'Esperando a que los contenedores se detengan...'
  while (docker ps -q --filter 'label=com.docker.stack.namespace=sifce') { Start-Sleep -Seconds 2 }
}
if ($BorrarDatos) {
  docker volume rm sifce_db-data sifce_uploads
}
if ($BorrarSecretos) {
  docker secret rm sifce_db_password sifce_jwt_secret sifce_ai_api_key
}
