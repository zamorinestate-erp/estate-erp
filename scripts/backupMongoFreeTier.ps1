<#
.SYNOPSIS
  Zamorin Café ERP — Free-Tier MongoDB Backup Script (EXT-03F)
.DESCRIPTION
  Creates a timestamped mongodump backup for Free-Tier Atlas clusters outside the Git repository,
  safely redacts connection credentials from logs, verifies exit codes, and manages local retention.
#>

[CmdletBinding()]
param(
  [string]$BackupRootDir = 'D:\Zamorin_Backups\EXT03F',
  [int]$RetentionCount = 7,
  [string]$DbName = $env:DATABASE_NAME,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

Write-Host '===================================================='
Write-Host 'ZAMORIN CAFÉ ERP — FREE-TIER MONGODB BACKUP UTILITY'
Write-Host '===================================================='

# 1. Validate MONGODB_URI environment variable
$mongoUri = $env:MONGODB_URI
if (-not $mongoUri) {
  Write-Error 'CRITICAL: MONGODB_URI environment variable is not defined. Refusing to run.'
  exit 1
}

# 2. Mask URI for safe output
$maskedUri = $mongoUri -replace '//[^:]+:[^@]+@', '//***:***@'
$displayDb = if ($DbName) { $DbName } else { '[ALL_DATABASES]' }
Write-Host "Target Cluster: $maskedUri"
Write-Host "Database Name:  $displayDb"

# 3. Ensure BackupRootDir is outside the Git workspace
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = (Resolve-Path (Join-Path $scriptDir '..')).Path
$resolvedBackupRoot = [System.IO.Path]::GetFullPath($BackupRootDir)

if ($resolvedBackupRoot.StartsWith($workspaceDir, [System.StringComparison]::OrdinalIgnoreCase)) {
  Write-Error "CRITICAL: Backup directory '$resolvedBackupRoot' is inside the Git repository workspace! Refusing to store backups in Git tree."
  exit 1
}

Write-Host "Backup Root:    $resolvedBackupRoot (Outside Repository: PASS)"

# 4. Prepare timestamped directory
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$targetDir = Join-Path $resolvedBackupRoot $timestamp

if (-not (Test-Path $resolvedBackupRoot)) {
  New-Item -ItemType Directory -Path $resolvedBackupRoot -Force | Out-Null
}

Write-Host "Target Dir:     $targetDir"
Write-Host "Retention:      Keep last $RetentionCount backups"
Write-Host '----------------------------------------------------'

# 5. Check mongodump presence
$dumpCmd = Get-Command 'mongodump' -ErrorAction SilentlyContinue
if (-not $dumpCmd) {
  Write-Warning 'mongodump command not found in system PATH. Ensure MongoDB Database Tools are installed.'
  if (-not $DryRun) {
    Write-Error 'FAIL: mongodump utility unavailable. Cannot complete live database dump.'
    exit 2
  }
}

if ($DryRun) {
  Write-Host '[DRY_RUN] Verification mode active. Command would execute: mongodump --uri=<MASKED> --out=<TARGET_DIR> --gzip'
  Write-Host 'VERDICT: DRY_RUN_VERIFIED'
  exit 0
}

# 6. Execute mongodump
$startTime = Get-Date
$dumpArgs = @("--uri=$mongoUri", "--out=$targetDir", '--gzip')
if ($DbName) {
  $dumpArgs += "--db=$DbName"
}

try {
  Write-Host 'Starting mongodump execution...'
  & mongodump $dumpArgs 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Error "FAIL: mongodump exited with non-zero status code: $LASTEXITCODE"
    exit 3
  }
} catch {
  $errMsg = $_.Exception.Message
  Write-Error "FAIL: mongodump execution failed: $errMsg"
  exit 3
}

$duration = ((Get-Date) - $startTime).TotalSeconds
Write-Host "Backup successfully completed in $duration seconds."

# 7. Apply retention cleanup
Write-Host 'Auditing local backup retention window...'
$allBackups = Get-ChildItem -Path $resolvedBackupRoot -Directory | Sort-Object Name -Descending
if ($allBackups.Count -gt $RetentionCount) {
  $toPrune = $allBackups | Select-Object -Skip $RetentionCount
  foreach ($item in $toPrune) {
    Write-Host "Pruning expired local backup: $($item.Name)"
    Remove-Item -Path $item.FullName -Recurse -Force
  }
}

Write-Host '===================================================='
Write-Host 'VERDICT: BACKUP_COMPLETE'
exit 0
