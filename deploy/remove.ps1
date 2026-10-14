<#
  SIFCE - Detener el despliegue de Docker Swarm.

    .\deploy\remove.ps1                    # detiene los servicios; CONSERVA los datos
    .\deploy\remove.ps1 -BorrarDatos       # además borra la base y las hojas de vida del despliegue
    .\deploy\remove.ps1 -BorrarSecretos    # además borra los secretos (se regeneran al desplegar;
                                             la contraseña de la base solo con -BorrarDatos)
#>
param([switch]$BorrarDatos, [switch]$BorrarSecretos)

docker stack rm sifce
if ($BorrarDatos -or $BorrarSecretos) {
  Write-Host 'Esperando a que los contenedores se detengan...'
  while (docker ps -q --filter 'label=com.docker.stack.namespace=sifce') { Start-Sleep -Seconds 2 }
}
if ($BorrarDatos) {
  docker volume rm sifce_db-data sifce_uploads sifce_prometheus-data sifce_grafana-data
}
if ($BorrarSecretos) {
  # La contraseña de la base solo se borra junto con los datos: la base ya
  # creada depende de ella y quedaría inaccesible con una nueva.
  docker secret ls --format "{{.Name}}" |
    Where-Object { $_ -like "sifce_*" -and ($BorrarDatos -or $_ -ne "sifce_db_password") } |
    ForEach-Object { docker secret rm $_ }
  Remove-Item (Join-Path $PSScriptRoot ".grafana-admin.txt") -ErrorAction SilentlyContinue
}
