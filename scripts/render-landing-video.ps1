# Rend la video de la landing via inference.sh (belt).
# Prerequis : belt login (compte inference.sh) + captures deployees en prod.
# Usage : .\scripts\render-landing-video.ps1
# Sortie : URL du MP4 -> telecharger dans frontend/public/landing-video.mp4

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$codePath = Join-Path $root "remotion\landing-video.tsx"

if (-not (Test-Path $codePath)) { Write-Error "Introuvable : $codePath" }

$code = Get-Content $codePath -Raw

$inputObj = @{
  code             = $code
  duration_seconds = 16
  fps              = 30
  width            = 1920
  height           = 1080
}

$json = $inputObj | ConvertTo-Json -Compress -Depth 4
$tmp = Join-Path $env:TEMP "remotion-input.json"
[System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Rendu en cours (1-3 min)..." -ForegroundColor Cyan
belt app run infsh/remotion-render --input-file $tmp

Write-Host ""
Write-Host "Ensuite :" -ForegroundColor Yellow
Write-Host "  1. Telecharger le MP4 retourne -> frontend\public\landing-video.mp4"
Write-Host "  2. Me dire 'video prete' : j'integre la balise <video> sur la landing"
