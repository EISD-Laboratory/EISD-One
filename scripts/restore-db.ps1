<#
.SYNOPSIS
  Restore database PostgreSQL EISD One dari file SQL hasil backup.
.EXAMPLE
  .\scripts\restore-db.ps1 -BackupFile .\backups\eisd_one_20261123_220000.sql
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DbUser = "eisd",
  [string]$DbName = "eisd_one",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  throw "File backup tidak ditemukan: $BackupFile"
}

if (-not $Force) {
  $confirm = Read-Host "PERINGATAN: Restore akan menimpa data di database '$DbName'. Ketik 'YA' untuk melanjutkan"
  if ($confirm -ne "YA") {
    Write-Host "Restore dibatalkan."
    exit 0
  }
}

Write-Host "Merestore '$BackupFile' ke database '$DbName' ..."
Get-Content -Raw -Path $BackupFile | docker compose exec -T postgres psql -U $DbUser -d $DbName
if ($LASTEXITCODE -ne 0) {
  throw "Restore gagal (exit code $LASTEXITCODE)."
}

Write-Host "Restore selesai."
