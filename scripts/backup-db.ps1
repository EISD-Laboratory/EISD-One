<#
.SYNOPSIS
  Backup database PostgreSQL EISD One ke folder backups/.
.EXAMPLE
  .\scripts\backup-db.ps1
#>
param(
  [string]$OutDir = "backups",
  [string]$DbUser = "eisd",
  [string]$DbName = "eisd_one"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $OutDir "${DbName}_${timestamp}.sql"

Write-Host "Membuat backup database '$DbName' ke $outFile ..."
$dump = docker compose exec -T postgres pg_dump -U $DbUser -d $DbName --clean --if-exists
if ($LASTEXITCODE -ne 0) {
  throw "Backup gagal (exit code $LASTEXITCODE). Pastikan container postgres berjalan (docker compose up -d postgres)."
}

[System.IO.File]::WriteAllLines((Resolve-Path $OutDir).Path + "\" + "${DbName}_${timestamp}.sql", $dump, (New-Object System.Text.UTF8Encoding($false)))

$sizeKb = [math]::Round((Get-Item $outFile).Length / 1KB, 2)
Write-Host "Backup selesai: $outFile ($sizeKb KB)"
