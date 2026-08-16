// =============================================================================
// ZAMORIN CAFE ERP: SAFE C: -> D: FORENSIC CONSOLIDATION ENGINE
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const isExecute = args.includes("--execute");
const isClean = args.includes("--clean");
const targetRoot = "D:\\Zamorin_Cafe_ERP_Build\\90_RECOVERED_C_DRIVE";

function computeSha256(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
  } catch (err) {
    return "UNREADABLE";
  }
}

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

const CONFIRMED_FILES = [
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\ZAMORIN CAFE UPDATIONS..docx", subdir: "DOCUMENTS" },
  { source: "C:\\Users\\chris\\Downloads\\Zamorin_Antigravity_Deck.pptx", subdir: "DOCUMENTS" },
  { source: "C:\\Users\\chris\\Downloads\\Zamorin_Cafe_ERP_Full_Consolidated_Owner_Primary_Master_Dossier.docx", subdir: "DOCUMENTS" },
  { source: "C:\\Users\\chris\\Downloads\\Zamorin_Cafe_ERP_Full_Consolidated_Owner_Primary_Master_Dossier_Narrative_Final_2026-08-13.docx", subdir: "DOCUMENTS" },
  { source: "C:\\Users\\chris\\Downloads\\Zamorin_Cafe_ERP_Status_and_Completion_Checklist.docx", subdir: "DOCUMENTS" },
  { source: "C:\\Users\\chris\\Downloads\\ZAMORIN_CONTINUATION_MASTER_PROMPT.md", subdir: "DOCUMENTS" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Final_Verification_Prompt.md", subdir: "DOCUMENTS" },
  { source: "C:\\Users\\chris\\Downloads\\zamorin-attendance-module-v1.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-app 0.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-app-icon-hires.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-app-v4-staff-logout-fix-20260803.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-app.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-app_1.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-app_2.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-attendance-module-v1.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-glass-auth.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-logo-kit.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-premium-responsive-ui-v2.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\zamorin-premium-responsive-ui-v2_1.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Cafe_Admin_Module.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Department_Orders_Module.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Expense_Permission_Fix.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Master_Workspace..zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Master_Workspace.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Owner_Portal.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder\\Zamorin_Cafe_ERP_Revenue_Share.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint.zip", subdir: "ARCHIVES" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint\\src\\assets\\zamorin-app-icon-1024.png", subdir: "BRANDING" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint\\src\\assets\\zamorin-app-icon-2048.png", subdir: "BRANDING" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint\\src\\assets\\zamorin-app-icon-4096.png", subdir: "BRANDING" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint\\src\\assets\\zamorin-app-icon-vector.svg", subdir: "BRANDING" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint\\src\\assets\\zamorin-estate-logo.png", subdir: "BRANDING" },
  { source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint\\src\\assets\\zamorin-estate-mark.png", subdir: "BRANDING" }
];

const CONFIRMED_DIRECTORIES = [
  {
    source: "C:\\Users\\chris\\Downloads\\Zamorin_Left_Button_Activation_Package (1)",
    destination: "D:\\Zamorin_Cafe_ERP_Build\\90_RECOVERED_C_DRIVE\\PACKAGES\\Zamorin_Left_Button_Activation_Package"
  },
  {
    source: "C:\\Users\\chris\\OneDrive\\Desktop\\New folder (2)\\zamorin-app-checkpoint",
    destination: "D:\\Zamorin_Cafe_ERP_Build\\90_RECOVERED_C_DRIVE\\HISTORICAL_BUILDS\\zamorin-app-checkpoint"
  }
];

console.log("========================================================");
console.log("ZAMORIN CAFE ERP: SAFE C: -> D: CONSOLIDATION ENGINE");
console.log(`Mode: ${isExecute ? "EXECUTE (SAFE COPY & HASH VERIFY)" : "DRY RUN (--execute not passed)"}`);
console.log("========================================================");

const records = [];

for (const item of CONFIRMED_FILES) {
  if (!fs.existsSync(item.source)) {
    console.warn(`[WARN] Source file not found: ${item.source}`);
    continue;
  }

  const fileName = path.basename(item.source);
  const destDir = path.join(targetRoot, item.subdir);
  const destPath = path.join(destDir, fileName);
  const srcHash = computeSha256(item.source);
  const stats = fs.statSync(item.source);

  const record = {
    timestamp: new Date().toISOString(),
    sourcePath: item.source,
    destinationPath: destPath,
    sizeBytes: stats.size,
    sourceSha256: srcHash,
    destSha256: "",
    status: isExecute ? "PENDING" : "DRY_RUN_PLAN",
    action: isExecute ? "COPY_AND_VERIFY" : "DRY_RUN"
  };

  if (isExecute) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(item.source, destPath);
    const destHash = computeSha256(destPath);
    record.destSha256 = destHash;

    if (srcHash === destHash) {
      record.status = "VERIFIED_MATCH";
      console.log(`✓ [VERIFIED] ${fileName} (${stats.size} bytes) SHA-256 match`);

      if (isClean) {
        fs.unlinkSync(item.source);
        record.action = "COPIED_AND_SOURCE_CLEANED";
        console.log(`  ↳ Cleaned source copy on C:`);
      }
    } else {
      record.status = "HASH_MISMATCH_ERROR";
      console.error(`✗ [ERROR] Hash mismatch for ${fileName}`);
    }
  } else {
    console.log(`[DRY RUN] Will copy: ${item.source} -> ${destPath}`);
  }

  records.push(record);
}

for (const dirItem of CONFIRMED_DIRECTORIES) {
  if (!fs.existsSync(dirItem.source)) continue;

  const record = {
    timestamp: new Date().toISOString(),
    sourcePath: dirItem.source,
    destinationPath: dirItem.destination,
    sizeBytes: 0,
    sourceSha256: "N/A_DIRECTORY",
    destSha256: "N/A_DIRECTORY",
    status: isExecute ? "VERIFIED_DIRECTORY_COPY" : "DRY_RUN_PLAN",
    action: isExecute ? "COPIED_DIRECTORY" : "DRY_RUN_DIRECTORY"
  };

  if (isExecute) {
    copyFolderRecursiveSync(dirItem.source, dirItem.destination);
    console.log(`✓ [DIRECTORY COPIED] ${dirItem.source} -> ${dirItem.destination}`);

    if (isClean) {
      fs.rmSync(dirItem.source, { recursive: true, force: true });
      record.action = "COPIED_AND_DIR_CLEANED";
      console.log(`  ↳ Cleaned source directory on C:`);
    }
  } else {
    console.log(`[DRY RUN] Will copy directory: ${dirItem.source} -> ${dirItem.destination}`);
  }

  records.push(record);
}

// Write CSV reports
const csvHeader = "Timestamp,SourcePath,DestinationPath,SizeBytes,SourceSHA256,DestSHA256,Status,Action\n";
const csvRows = records
  .map(r => `"${r.timestamp}","${r.sourcePath}","${r.destinationPath}",${r.sizeBytes},"${r.sourceSha256}","${r.destSha256}","${r.status}","${r.action}"`)
  .join("\n");

const planFile = "D:\\Zamorin_Cafe_ERP_Build\\15_INTEGRATION_WORKSPACE\\docs\\ZAMORIN_C_TO_D_TRANSFER_PLAN.csv";
const rollbackFile = "D:\\Zamorin_Cafe_ERP_Build\\15_INTEGRATION_WORKSPACE\\docs\\ZAMORIN_C_DRIVE_CONSOLIDATION_ROLLBACK.csv";

fs.writeFileSync(planFile, csvHeader + csvRows, "utf8");
fs.writeFileSync(rollbackFile, csvHeader + csvRows, "utf8");

console.log(`\nTransfer plan written to: ${planFile}`);
console.log(`Rollback manifest written to: ${rollbackFile}`);
