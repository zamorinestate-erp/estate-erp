# ZAMORIN CAFE ERP — AUTHORITATIVE PROJECT STORAGE MAP

**Canonical Root**: `D:\Zamorin_Cafe_ERP_Build`  
**Active Production Working Tree**: `D:\Zamorin_Cafe_ERP_Build\15_INTEGRATION_WORKSPACE`  
**Date**: August 16, 2026

---

## Complete Drive D: Folder Hierarchy

```
D:\Zamorin_Cafe_ERP_Build\
├── 01_BASE_ORIGINAL\                     # Initial base workspace baseline
├── 02_MASTER_WORKSPACE_ORIGINAL\         # Master role initial workspace baseline
├── 03_OWNER_PORTAL_ORIGINAL\             # Owner portal baseline modules
├── 04_CAFE_ADMIN_ORIGINAL\               # Café Admin baseline modules
├── 05_EXPENSE_PERMISSION_ORIGINAL\       # Expense permissioning initial baseline
├── 06_DEPARTMENT_ORDERS_ORIGINAL\        # Department orders initial baseline
├── 07_REVENUE_SHARE_ORIGINAL\            # Revenue share baseline
├── 08_RESPONSIVE_UI_ORIGINAL\            # Responsive UI baseline
├── 09_AUTH_ORIGINAL\                     # Authentication baseline
├── 10_BRANDING_ORIGINAL\                 # Branding visual tokens baseline
├── 11_APP_ICON_ORIGINAL\                 # App icons baseline
├── 12_REQUIREMENTS_ORIGINAL\             # Original requirements
├── 13_LEGACY_BASES_ORIGINAL\             # Legacy bases
├── 14_OTHER_DELIVERIES_ORIGINAL\         # Historical delivery drops
├── 15_INTEGRATION_WORKSPACE\             # >>> AUTHORITATIVE ACTIVE WORKSPACE <<<
│   ├── backend\                          # Express.js REST API, Mongoose Models, 384 tests
│   │   ├── src\                          # App controllers, middlewares, routes, services
│   │   └── test\                         # Full automated test suites (100% passing)
│   ├── frontend\                         # Production SPA (Vanilla ES Modules, CSS design tokens)
│   │   ├── src\
│   │   │   ├── js\                       # 36 Page controllers, router, components, icons
│   │   │   └── styles\                   # zamorin.css, layout.css, tokens.css
│   │   └── index.html                    # Single Page Entrypoint
│   ├── hard-testing\                     # Capacity, storm & security suites (HT-00 -> HT-20)
│   ├── docs\                             # 100+ Architecture specs, test reports, matrices
│   │   └── templates\                    # 8 Master onboarding templates
│   ├── scripts\                          # Maintenance, consolidation & scatter audit scripts
│   ├── Dockerfile                        # Production container spec
│   ├── docker-compose.yml                # Multi-container local stack spec
│   └── render.yaml                       # Cloud infrastructure blueprint
├── 16_STAFF_LOGOUT_FIX_ORIGINAL\         # Historical staff logout patch
├── 17_ATTENDANCE_ORIGINAL\               # Historical attendance base
└── 90_RECOVERED_C_DRIVE\                 # >>> CONSOLIDATED C: DRIVE ARTIFACTS <<<
    ├── ARCHIVES\                         # 19 Historic module ZIP releases
    ├── BRANDING\                         # High-res master icons (1024 to 4096px) & SVG logos
    ├── DOCUMENTS\                        # Master dossiers, presentations, requirements, prompts
    ├── HISTORICAL_BUILDS\                # Historic checkpoints
    └── PACKAGES\                         # Navigation macros & Excel packages
```
