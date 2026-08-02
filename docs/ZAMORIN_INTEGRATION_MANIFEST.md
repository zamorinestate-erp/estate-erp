# Zamorin Cafe ERP — Integration Manifest

## Preserved Source Deliveries

- `01_BASE_ORIGINAL/zamorin-app_2.zip` — Preserved untouched. Dependency-free frontend starter; not the final ERP backend.
- `02_MASTER_WORKSPACE_ORIGINAL/Zamorin_Cafe_ERP_Master_Workspace.zip` — Preserved untouched. Standalone Master module built for Next.js, NestJS, PostgreSQL and Prisma; reference only until adapted to MongoDB Atlas.
- `03_OWNER_PORTAL_ORIGINAL/Zamorin_Cafe_ERP_Owner_Portal.zip` — Preserved untouched. Standalone Owner Portal module built for Next.js, NestJS, PostgreSQL and Prisma; reference only until adapted to MongoDB Atlas.
- `04_CAFE_ADMIN_ORIGINAL/Zamorin_Cafe_ERP_Cafe_Admin_Module.zip` — Preserved untouched. Standalone Café Admin reference implementation built for Next.js, PostgreSQL and Prisma; not yet integrated with the MongoDB Atlas production architecture.
- `05_EXPENSE_PERMISSION_ORIGINAL/Zamorin_Cafe_ERP_Expense_Permission_Fix.zip` — Preserved untouched. Permission-fix module for the Expenses workflow; must be reviewed and adapted before integration with the final MongoDB backend and role enforcement.
- `06_DEPARTMENT_ORDERS_ORIGINAL/Zamorin_Cafe_ERP_Department_Orders_Module.zip` — Preserved untouched. Department Orders module with backend, frontend and database components; must be adapted from Prisma/PostgreSQL assumptions to the final MongoDB Atlas architecture before integration.
- `07_REVENUE_SHARE_ORIGINAL/Zamorin_Cafe_ERP_Revenue_Share.zip` — Preserved untouched. Revenue Share module with frontend, backend and database components; must be reviewed for permission scope and adapted from Prisma/PostgreSQL assumptions to MongoDB Atlas before integration.
- `08_RESPONSIVE_UI_ORIGINAL/zamorin-premium-responsive-ui-v2.zip` — Preserved untouched. Dependency-free responsive demonstration frontend with four role routes and sample data; visual reference only until connected to the final frontend and MongoDB-backed API.
- `09_AUTH_ORIGINAL/zamorin-glass-auth.zip` — Preserved untouched. Frontend-only Next.js authentication module intended to connect to a Render-hosted API and MongoDB Atlas backend; backend authentication, session security and MFA still require full implementation and verification.
- `10_BRANDING_ORIGINAL/zamorin-logo-kit.zip` — Preserved untouched. Finalized Zamorin branding assets, logo variants, icon files, colour specifications and usage guidance for application, reports, invoices and authentication screens.
- `11_APP_ICON_ORIGINAL/zamorin-app-icon-hires.zip` — Preserved untouched. High-resolution Zamorin application icons in PNG and SVG formats for favicon, PWA, mobile, desktop and deployment branding.
- `12_REQUIREMENTS_ORIGINAL/Zamorin_Cafe_ERP_Final_Verification_Prompt.md` — Authoritative full-system requirements, verification checklist, remediation scope and release-readiness standard for the Zamorin Cafe ERP.
- `13_LEGACY_BASES_ORIGINAL/` — Preserved untouched. Contains older `zamorin-app`, `zamorin-app 0` and `zamorin-app_1` frontend deliveries for comparison and recovery only; these must not overwrite newer integrated files.
- `14_OTHER_DELIVERIES_ORIGINAL/` — Preserved untouched. Contains the older Master Workspace delivery and duplicate responsive UI delivery for comparison only; neither may overwrite newer source files without a documented file-by-file review.
