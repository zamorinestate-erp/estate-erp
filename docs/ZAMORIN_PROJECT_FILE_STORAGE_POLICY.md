# ZAMORIN CAFE ERP — PROJECT FILE STORAGE & ANTI-SCATTER POLICY

**Policy ID**: `ZAM-GOV-STORAGE-001`  
**Effective Date**: August 16, 2026  
**Status**: Active & Mandatory

---

## 1. Principle of Authoritative Locality

1. **Sole Project Root**: All code, assets, builds, documents, test evidence, configuration, and scripts relating to Zamorin Cafe ERP must reside strictly under `D:\Zamorin_Cafe_ERP_Build`.
2. **Prohibition of C: Drive Scatter**:
   - Never write source files, temporary staging files, or build artifacts to `C:\Users\...` (`Desktop`, `Downloads`, `Documents`, etc.).
   - If downloads are received on `C:`, they must be moved immediately to `D:\Zamorin_Cafe_ERP_Build\` and verified.

---

## 2. Directory Governance

| Purpose | Approved Location |
|---|---|
| Active Development & Testing | `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE` |
| Historical Builds & Snapshots | `D:\Zamorin_Cafe_ERP_Build\01_BASE_ORIGINAL` through `17_ATTENDANCE_ORIGINAL` |
| Recovered Documents & Archives | `D:\Zamorin_Cafe_ERP_Build\90_RECOVERED_C_DRIVE` |
| Project Logs & Evidence | `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\logs\` (Git-ignored) |
| Hard-Testing Results | `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE\hard-testing\results\` |

---

## 3. Automated Scatter Auditing

Developers and agents must periodically run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\audit_project_scatter.ps1
```
Any discovered candidate file on `C:` must be reconciled using `scripts\consolidate_project_files.js`.
