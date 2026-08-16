<#
.SYNOPSIS
  Consolidation and Safe Transfer Script for Zamorin Cafe ERP C: -> D: Migration.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$TargetRoot = "D:\Zamorin_Cafe_ERP_Build\90_RECOVERED_C_DRIVE",
  [switch]$Execute,
  [switch]$CleanVerifiedSource
)

$ErrorActionPreference = "Stop"

$CONFIRMED_FILES = @(
  @{ Source = "C:\Users\chris\OneDrive\Desktop\ZAMORIN CAFE UPDATIONS..docx"; Category = "DOCUMENTS"; Subdir = "DOCUMENTS" },
  @{ Source = "C:\Users\chris\Downloads\Zamorin_Antigravity_Deck.pptx"; Category = "DOCUMENTS"; Subdir = "DOCUMENTS" },
  @{ Source = "C:\Users\chris\Downloads\Zamorin_Cafe_ERP_Full_Consolidated_Owner_Primary_Master_Dossier.docx"; Category = "DOCUMENTS"; Subdir = "DOCUMENTS" },
  @{ Source = "C:\Users\chris\Downloads\Zamorin_Cafe_ERP_Full_Consolidated_Owner_Primary_Master_Dossier_Narrative_Final_2026-08-13.docx"; Category = "DOCUMENTS"; Subdir = "DOCUMENTS" },
  @{ Source = "C:\Users\chris\Downloads\Zamorin_Cafe_ERP_Status_and_Completion_Checklist.docx"; Category = "DOCUMENTS"; Subdir = "DOCUMENTS" },
  @{ Source = "C:\Users\chris\Downloads\ZAMORIN_CONTINUATION_MASTER_PROMPT.md"; Category = "DOCUMENTS"; Subdir = "DOCUMENTS" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Final_Verification_Prompt.md"; Category = "DOCUMENTS"; Subdir = "DOCUMENTS" },
  @{ Source = "C:\Users\chris\Downloads\zamorin-attendance-module-v1.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-app 0.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-app-icon-hires.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-app-v4-staff-logout-fix-20260803.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-app.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-app_1.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-app_2.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-attendance-module-v1.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-glass-auth.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-logo-kit.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-premium-responsive-ui-v2.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\zamorin-premium-responsive-ui-v2_1.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Cafe_Admin_Module.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Department_Orders_Module.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Expense_Permission_Fix.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Master_Workspace..zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Master_Workspace.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Owner_Portal.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder\Zamorin_Cafe_ERP_Revenue_Share.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint.zip"; Category = "ARCHIVES"; Subdir = "ARCHIVES" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint\src\assets\zamorin-app-icon-1024.png"; Category = "BRANDING"; Subdir = "BRANDING" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint\src\assets\zamorin-app-icon-2048.png"; Category = "BRANDING"; Subdir = "BRANDING" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint\src\assets\zamorin-app-icon-4096.png"; Category = "BRANDING"; Subdir = "BRANDING" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint\src\assets\zamorin-app-icon-vector.svg"; Category = "BRANDING"; Subdir = "BRANDING" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint\src\assets\zamorin-estate-logo.png"; Category = "BRANDING"; Subdir = "BRANDING" },
  @{ Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint\src\assets\zamorin-estate-mark.png"; Category = "BRANDING"; Subdir = "BRANDING" }
)

$CONFIRMED_DIRECTORIES = @(
  @{
    Source = "C:\Users\chris\Downloads\Zamorin_Left_Button_Activation_Package (1)"
    Destination = "D:\Zamorin_Cafe_ERP_Build\90_RECOVERED_C_DRIVE\PACKAGES\Zamorin_Left_Button_Activation_Package"
  },
  @{
    Source = "C:\Users\chris\OneDrive\Desktop\New folder (2)\zamorin-app-checkpoint"
    Destination = "D:\Zamorin_Cafe_ERP_Build\90_RECOVERED_C_DRIVE\HISTORICAL_BUILDS\zamorin-app-checkpoint"
  }
)

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "ZAMORIN CAFE ERP: SAFE C: -> D: CONSOLIDATION ENGINE" -ForegroundColor Cyan
Write-Host "Mode: $(if ($Execute) { 'EXECUTE' } else { 'DRY RUN (-WhatIf)' })" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

$results = [System.Collections.Generic.List[PSObject]]::new()
$logDir = "D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\logs\project-consolidation"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

foreach ($item in $CONFIRMED_FILES) {
  $src = $item.Source
  if (-not (Test-Path $src)) {
    Write-Warning "Source file not found: $src"
    continue
  }

  $fileName = Split-Path $src -Leaf
  $destFolder = Join-Path $TargetRoot $item.Subdir
  $destPath = Join-Path $destFolder $fileName
  $srcHash = (Get-FileHash -Path $src -Algorithm SHA256).Hash
  $size = (Get-Item $src).Length

  $record = [PSCustomObject]@{
    Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    SourcePath = $src
    DestinationPath = $destPath
    SizeBytes = $size
    SourceSHA256 = $srcHash
    DestSHA256 = ""
    Status = if ($Execute) { "PENDING" } else { "DRY_RUN_PLAN" }
    Action = if ($Execute) { "COPY_AND_VERIFY" } else { "DRY_RUN" }
  }

  if ($Execute) {
    if (-not (Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder -Force | Out-Null }
    Copy-Item -Path $src -Destination $destPath -Force
    $destHash = (Get-FileHash -Path $destPath -Algorithm SHA256).Hash
    $record.DestSHA256 = $destHash

    if ($srcHash -eq $destHash) {
      $record.Status = "VERIFIED_MATCH"
      Write-Host "✓ [VERIFIED] $fileName (SHA-256 Match)" -ForegroundColor Green

      if ($CleanVerifiedSource) {
        Remove-Item -Path $src -Force
        $record.Action = "COPIED_AND_SOURCE_CLEANED"
        Write-Host "  ↳ Cleaned source copy on C:" -ForegroundColor DarkGray
      }
    } else {
      $record.Status = "HASH_MISMATCH_ERROR"
      Write-Error "✗ [MISMATCH] Hash discrepancy for $fileName"
    }
  } else {
    Write-Host "[DRY RUN] Will copy: $src -> $destPath" -ForegroundColor Gray
  }

  $results.Add($record)
}

foreach ($dirItem in $CONFIRMED_DIRECTORIES) {
  $srcDir = $dirItem.Source
  $destDir = $dirItem.Destination

  if (-not (Test-Path $srcDir)) { continue }

  $record = [PSCustomObject]@{
    Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    SourcePath = $srcDir
    DestinationPath = $destDir
    SizeBytes = (Get-ChildItem $srcDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
    SourceSHA256 = "N/A_DIRECTORY"
    DestSHA256 = "N/A_DIRECTORY"
    Status = if ($Execute) { "VERIFIED_DIRECTORY_COPY" } else { "DRY_RUN_PLAN" }
    Action = if ($Execute) { "COPIED_DIRECTORY" } else { "DRY_RUN_DIRECTORY" }
  }

  if ($Execute) {
    $parentDest = Split-Path $destDir -Parent
    if (-not (Test-Path $parentDest)) { New-Item -ItemType Directory -Path $parentDest -Force | Out-Null }
    Copy-Item -Path $srcDir -Destination $destDir -Recurse -Force
    Write-Host "✓ [DIRECTORY COPIED] $srcDir -> $destDir" -ForegroundColor Green

    if ($CleanVerifiedSource) {
      Remove-Item -Path $srcDir -Recurse -Force
      $record.Action = "COPIED_AND_DIR_CLEANED"
      Write-Host "  ↳ Cleaned source folder on C:" -ForegroundColor DarkGray
    }
  } else {
    Write-Host "[DRY RUN] Will copy folder: $srcDir -> $destDir" -ForegroundColor Gray
  }

  $results.Add($record)
}

$planFile = "D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\docs\ZAMORIN_C_TO_D_TRANSFER_PLAN.csv"
$rollbackFile = "D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\docs\ZAMORIN_C_DRIVE_CONSOLIDATION_ROLLBACK.csv"

$results | Export-Csv -Path $planFile -NoTypeInformation -Encoding UTF8
$results | Export-Csv -Path $rollbackFile -NoTypeInformation -Encoding UTF8

Write-Host "`nTransfer plan recorded: $planFile" -ForegroundColor Cyan
Write-Host "Rollback manifest recorded: $rollbackFile" -ForegroundColor Cyan
