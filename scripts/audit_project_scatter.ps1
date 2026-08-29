<#
.SYNOPSIS
  Non-destructive forensic scanner for Zamorin Cafe ERP project scatter on C: drive.
.DESCRIPTION
  Safely scans priority locations on C: for strong project markers, calculates SHA-256 hashes,
  and classifies candidates without deleting or moving any files.
#>
[CmdletBinding()]
param(
  [string[]]$ScanRoots = @(
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Documents",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Pictures",
    "$env:USERPROFILE\Videos",
    "$env:USERPROFILE\OneDrive",
    "$env:USERPROFILE\.gemini\antigravity-ide",
    "$env:USERPROFILE\.vscode",
    "$env:USERPROFILE\AppData\Roaming",
    "$env:USERPROFILE\AppData\Local",
    "C:\"
  ),
  [string]$OutputFile = "docs\ZAMORIN_C_DRIVE_DISCOVERY_MANIFEST.csv",
  [switch]$ReportOnly
)

$ErrorActionPreference = "SilentlyContinue"

$STRONG_NAME_PATTERNS = @(
  "*zamorin*",
  "*Zamorin*",
  "*ZAMORIN*",
  "*estate-erp*",
  "*cafe-erp*",
  "*zamorin-app*",
  "*zamorin-attendance*",
  "*zamorin-premium*",
  "*ZC-0001*",
  "*MU-0001*"
)

$EXCLUDED_DIRS = @(
  "C:\Windows",
  "C:\Program Files",
  "C:\Program Files (x86)",
  "C:\ProgramData",
  "C:\System Volume Information",
  "C:\`$Recycle.Bin",
  "C:\Recovery",
  "C:\Users\Default",
  "C:\Users\All Users"
)

$candidates = [System.Collections.Generic.List[PSObject]]::new()

function Get-FileSha256($filePath) {
  try {
    $hash = Get-FileHash -Path $filePath -Algorithm SHA256 -ErrorAction Stop
    return $hash.Hash
  } catch {
    return "UNREADABLE"
  }
}

function Get-ItemClassification($path, $isDir, $size, $evidence) {
  if ($path -like "*\.gemini\antigravity-ide\builtin\*" -or $path -like "*\.gemini\antigravity-ide\cache\*") {
    return "GLOBAL_APPLICATION_STATE"
  }
  if ($path -like "*\npm-cache\*" -or $path -like "*\AppData\Local\npm-cache\*") {
    return "GLOBAL_CACHE"
  }
  if ($path -like "*\.env*" -or $path -like "*credential*" -or $path -like "*secret*") {
    return "SECRET_OR_CREDENTIAL"
  }
  if ($evidence -match "CONFIRMED_NAME" -or $evidence -match "CONTENT_MARKER") {
    return "CONFIRMED_PROJECT"
  }
  if ($evidence -match "WEAK_NAME") {
    return "PROBABLE_PROJECT"
  }
  return "AMBIGUOUS"
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "ZAMORIN CAFE ERP: FORENSIC C: DRIVE SCATTER SCANNER" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

foreach ($root in $ScanRoots) {
  if (-not (Test-Path $root)) { continue }
  
  $isSysExcluded = $false
  foreach ($exc in $EXCLUDED_DIRS) {
    if ($root.StartsWith($exc, [System.StringComparison]::OrdinalIgnoreCase)) {
      $isSysExcluded = $true
      break
    }
  }
  if ($isSysExcluded) { continue }

  Write-Host "Scanning root: $root ..." -ForegroundColor Yellow

  # 1. Search by strong folder and file names
  foreach ($pat in $STRONG_NAME_PATTERNS) {
    try {
      $depth = if ($root -eq "C:\") { 2 } else { 6 }
      $items = Get-ChildItem -Path $root -Filter $pat -Recurse -Depth $depth -Force -ErrorAction SilentlyContinue |
        Where-Object {
          $p = $_.FullName
          $skip = $false
          foreach ($exc in $EXCLUDED_DIRS) {
            if ($p.StartsWith($exc, [System.StringComparison]::OrdinalIgnoreCase)) { $skip = $true; break }
          }
          -not $skip
        }

      foreach ($item in $items) {
        $p = $item.FullName
        if ($candidates | Where-Object { $_.SourcePath -eq $p }) { continue }

        $isDir = $item.PSIsContainer
        $size = if ($isDir) { 0 } else { $item.Length }
        $hash = if ($isDir) { "N/A_DIRECTORY" } else { Get-FileSha256 $p }
        $evidence = "CONFIRMED_NAME_MATCH ($pat)"
        $classification = Get-ItemClassification $p $isDir $size $evidence

        $record = [PSCustomObject]@{
          SourcePath          = $p
          ItemName            = $item.Name
          ItemType            = if ($isDir) { "DIRECTORY" } else { "FILE" }
          SizeBytes           = $size
          LastModified        = $item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
          Classification      = $classification
          Evidence            = $evidence
          SHA256              = $hash
          DestinationProposal = if ($isDir) { "D:\Zamorin_Cafe_ERP_Build\90_RECOVERED_C_DRIVE\FOLDERS\" } else { "D:\Zamorin_Cafe_ERP_Build\90_RECOVERED_C_DRIVE\FILES\" }
          ContainsSecrets     = if ($p -like "*\.env*" -or $p -like "*secret*") { "YES" } else { "NO" }
          Action              = if ($classification -eq "CONFIRMED_PROJECT") { "COPY_AND_VERIFY" } else { "LEAVE" }
          Reason              = "Forensically classified based on strong name pattern match"
        }
        $candidates.Add($record)
      }
    } catch {}
  }
}

Write-Host "`nScan complete. Total candidates discovered on C:: $($candidates.Count)" -ForegroundColor Green

# Export Manifest CSV
$outDir = Split-Path -Path $OutputFile -Parent
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$candidates | Export-Csv -Path $OutputFile -NoTypeInformation -Encoding UTF8
Write-Host "Manifest exported to: $OutputFile" -ForegroundColor Cyan

# Summary Table
$candidates | Group-Object Classification | Select-Object Name, Count | Format-Table -AutoSize
