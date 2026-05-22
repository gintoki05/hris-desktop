param(
  [string]$ProjectName = "hris-desktop-updates",
  [string]$PagesDomain = "https://hris-desktop-updates.pages.dev",
  [string]$ReleaseDate = (Get-Date -Format "yyyy-MM-dd"),
  [string]$PubDate = ((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")),
  [string]$Notes,
  [switch]$Deploy
)

$ErrorActionPreference = "Stop"

$workspace = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$tauriConfigPath = Join-Path $workspace "src-tauri\tauri.conf.json"

if (-not (Test-Path -LiteralPath $tauriConfigPath)) {
  throw "Tauri config tidak ditemukan: $tauriConfigPath"
}

$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
$version = [string]$tauriConfig.version

if ([string]::IsNullOrWhiteSpace($version)) {
  throw "Version di src-tauri\tauri.conf.json kosong."
}

if ([string]::IsNullOrWhiteSpace($Notes)) {
  $Notes = "Update HRIS Payroll Klinik versi $version."
}

$bundleDirectory = Join-Path $workspace "src-tauri\target\release\bundle\msi"
$artifactName = "HRIS Payroll Klinik_${version}_x64_en-US.msi"
$artifactPath = Join-Path $bundleDirectory $artifactName
$signaturePath = "$artifactPath.sig"

if (-not (Test-Path -LiteralPath $artifactPath)) {
  throw "Artifact MSI versi $version belum ada. Jalankan npm run build lalu npm run tauri build secara lokal."
}

if (-not (Test-Path -LiteralPath $signaturePath)) {
  throw "Signature artifact belum ada: $signaturePath"
}

$releaseRoot = Join-Path $workspace "release-updates\$ReleaseDate\updates"
$deployRoot = Join-Path $workspace "release-updates\_deploy_desktop"
$releaseWindowsDirectory = Join-Path $releaseRoot "windows-x86_64"
$deployWindowsDirectory = Join-Path $deployRoot "windows-x86_64"

New-Item -ItemType Directory -Force -Path $releaseWindowsDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $deployWindowsDirectory | Out-Null

Copy-Item -LiteralPath $artifactPath -Destination $releaseWindowsDirectory -Force
Copy-Item -LiteralPath $signaturePath -Destination $releaseWindowsDirectory -Force
Copy-Item -LiteralPath $artifactPath -Destination $deployWindowsDirectory -Force
Copy-Item -LiteralPath $signaturePath -Destination $deployWindowsDirectory -Force

$signature = (Get-Content -LiteralPath $signaturePath -Raw).Trim()
$encodedArtifactName = [Uri]::EscapeDataString($artifactName).Replace("%20", "%20")
$manifest = [ordered]@{
  version = $version
  pub_date = $PubDate
  url = "$PagesDomain/windows-x86_64/$encodedArtifactName"
  signature = $signature
  notes = $Notes
}

$releaseManifestPath = Join-Path $releaseRoot "latest.json"
$deployManifestPath = Join-Path $deployRoot "latest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $releaseManifestPath -Encoding UTF8
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $deployManifestPath -Encoding UTF8

Write-Host "Prepared updater release $version"
Write-Host "Release folder: $releaseRoot"
Write-Host "Deploy folder:  $deployRoot"
Write-Host "Manifest:       $deployManifestPath"

if ($Deploy) {
  npx wrangler pages deploy $deployRoot --project-name $ProjectName --branch main
}
