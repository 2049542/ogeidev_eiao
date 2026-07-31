# ============================================================
# start-dev.ps1 — Levanta el backend y el frontend de EIAO en
# ventanas separadas y abre el navegador para ver los cambios.
#
# Uso: clic derecho > "Ejecutar con PowerShell", o desde una
# terminal: powershell -ExecutionPolicy Bypass -File start-dev.ps1
# ============================================================

$root = $PSScriptRoot

Write-Host "Iniciando backend (EIAO_proyect) en http://localhost:3000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\EIAO_proyect'; npm run dev"

Write-Host "Iniciando frontend (proyecto.html) en http://127.0.0.1:5500 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; npx --yes serve -l 5500 ."

Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:5500/proyecto.html"

Write-Host ""
Write-Host "Listo. Se abrieron 2 ventanas (backend y frontend) + el navegador." -ForegroundColor Green
Write-Host "Cierra esas ventanas de PowerShell cuando termines de probar." -ForegroundColor Green
