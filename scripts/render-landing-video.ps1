# Rend la video de la landing via inference.sh (belt) puis la telecharge
# automatiquement dans frontend/public/landing-video.mp4.
# Prerequis : belt login (compte inference.sh).
# Usage : .\scripts\render-landing-video.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$codePath = Join-Path $root "remotion\landing-video.tsx"
$outVideo = Join-Path $root "frontend\public\landing-video.mp4"

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
$tmpIn = Join-Path $env:TEMP "remotion-input.json"
$tmpOut = Join-Path $env:TEMP "remotion-result.json"
[System.IO.File]::WriteAllText($tmpIn, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Rendu en cours (1-3 min)..." -ForegroundColor Cyan
belt app run infsh/remotion-render --input $tmpIn --save $tmpOut

if (-not (Test-Path $tmpOut)) { Write-Error "Pas de resultat ($tmpOut absent). Verifiez la sortie ci-dessus." }

# Extraire l'URL du MP4 du resultat (champ video/url ou uri selon le schema)
$result = Get-Content $tmpOut -Raw | ConvertFrom-Json
$videoUrl = $null
if ($result.output -and $result.output.video) {
  $v = $result.output.video
  if ($v -is [string]) { $videoUrl = $v }
  elseif ($v.url) { $videoUrl = $v.url }
  elseif ($v.uri) { $videoUrl = $v.uri }
}
if (-not $videoUrl) {
  # Repli : chercher une URL .mp4 n'importe ou dans le JSON
  $raw = Get-Content $tmpOut -Raw
  if ($raw -match 'https?://[^"\s]+\.mp4[^"\s]*') { $videoUrl = $Matches[0] }
}
if (-not $videoUrl) {
  Write-Host "Resultat brut :" -ForegroundColor Yellow
  Get-Content $tmpOut -Raw
  Write-Error "URL video introuvable dans le resultat."
}

Write-Host "Telechargement : $videoUrl" -ForegroundColor Cyan
Invoke-WebRequest -Uri $videoUrl -OutFile $outVideo -UseBasicParsing
$sizeMb = [math]::Round((Get-Item $outVideo).Length / 1MB, 1)

Write-Host ""
Write-Host "OK : video telechargee -> frontend\public\landing-video.mp4 ($sizeMb Mo)" -ForegroundColor Green
Write-Host "Prochaine etape : dire 'video prete' pour integrer la balise <video> sur la landing."
