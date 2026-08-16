# ZAMORIN CAFE ERP — PROJECT STORAGE BASELINE

**Authoritative Project Root**: `D:\Zamorin_Cafe_ERP_Build`  
**Active Working Tree**: `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE`  
**Git Branch**: `main`  
**HEAD Commit**: `4308650` (`perf(attendance): implement true 500-staff arrival storm harness, optimize connection pool, and document ADB-PERF-R4 certification findings`)  
**Frozen Anchor Tag**: `v1.2.0-ht20-release-candidate` -> Anchored to commit `2185069c0fb946c8decc009e19275751832b477c` (Verified intact)  
**Remote**: `https://github.com/zamorinestate-erp/estate-erp.git`  
**Baseline Date**: August 16, 2026

---

## 1. Directory Structure on Authoritative Drive D:

| Directory | Type | Purpose |
|---|---|---|
| `01_BASE_ORIGINAL` | Archive / Historical | Base original codebase snapshot |
| `02_MASTER_WORKSPACE_ORIGINAL` | Archive / Historical | Master account initial modules |
| `03_OWNER_PORTAL_ORIGINAL` | Archive / Historical | Owner portal initial modules |
| `04_CAFE_ADMIN_ORIGINAL` | Archive / Historical | Café Admin initial modules |
| `05_EXPENSE_PERMISSION_ORIGINAL` | Archive / Historical | Expense permissioning initial snapshot |
| `06_DEPARTMENT_ORDERS_ORIGINAL` | Archive / Historical | Department orders initial snapshot |
| `07_REVENUE_SHARE_ORIGINAL` | Archive / Historical | Revenue sharing initial snapshot |
| `08_RESPONSIVE_UI_ORIGINAL` | Archive / Historical | Responsive UI base snapshots |
| `09_AUTH_ORIGINAL` | Archive / Historical | Authentication initial base snapshot |
| `10_BRANDING_ORIGINAL` | Archive / Historical | Brand assets & visual tokens |
| `11_APP_ICON_ORIGINAL` | Archive / Historical | App icon variations & favicon sets |
| `12_REQUIREMENTS_ORIGINAL` | Archive / Historical | Initial PRDs & architectural requirements |
| `13_LEGACY_BASES_ORIGINAL` | Archive / Historical | Legacy delivery base files |
| `14_OTHER_DELIVERIES_ORIGINAL` | Archive / Historical | Miscellaneous delivery artifacts |
| `15_INTEGRATION_WORKSPACE` | **Authoritative Active Workspace** | Active Git repository, REST backend, frontend SPA, tests & documentation |
| `16_STAFF_LOGOUT_FIX_ORIGINAL` | Archive / Historical | Staff logout remediation base |
| `17_ATTENDANCE_ORIGINAL` | Archive / Historical | Attendance module initial base |

---

## 2. Active Workspace Breakdown (`15_INTEGRATION_WORKSPACE`)

- **Backend**: `15_INTEGRATION_WORKSPACE/backend` (Express.js, Mongoose, Auth/MFA/RBAC, 384 tests)
- **Frontend**: `15_INTEGRATION_WORKSPACE/frontend` (Vanilla ES Modules, Design System v2, 36 page controllers)
- **Hard-Testing**: `15_INTEGRATION_WORKSPACE/hard-testing` (`load/`, `network/`, `security/`, `results/`, `scripts/`)
- **Documentation**: `15_INTEGRATION_WORKSPACE/docs` (95 reports, specifications & verification ledgers)
- **Templates**: `15_INTEGRATION_WORKSPACE/docs/templates` (8 onboarding & master templates)
- **Deployment**: `render.yaml`, `Dockerfile`, `docker-compose.yml`

---

## 3. Git Tags Inventory

- `v1.0.1` .. `v1.1.3`
- `v1.2.0`
- `v1.2.0-ht00-baseline`
- `v1.2.0-ht20-release-candidate` -> `2185069` (Production release candidate)
