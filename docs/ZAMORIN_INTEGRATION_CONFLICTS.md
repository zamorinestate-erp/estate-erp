# Zamorin Cafe ERP - Integration Conflicts

## Scope

This report records confirmed conflicts in the integrated local repository at commit `9afa26f`. It does not claim cloud deployment or live Atlas validation.

## Architecture conflicts

| Conflict | Current evidence | Required resolution |
|---|---|---|
| Frontend framework description | Some external instructions describe React, Next.js or Vite | Preserve the actual static HTML, CSS and JavaScript frontend unless a separate approved migration is undertaken |
| Database architecture | Legacy documentation references Prisma and PostgreSQL | Keep Express, Mongoose and MongoDB Atlas; do not introduce Prisma, PostgreSQL or a second backend |
| Cloud validation timing | Cloud setup documents expect staging infrastructure | Defer Atlas, Render and Vercel changes until the local build is complete, then validate the fixed Vercel to Render to Atlas architecture |
| Environment naming | Generic prompts mention `JWT_SECRET`, `CLIENT_ORIGINS` and `NODE_ENV=staging` | Use the actual contract: `JWT_ACCESS_SECRET`, `ALLOWED_ORIGINS` and supported NODE_ENV values |

## Authentication and identity conflicts

1. Backend authentication, MFA, refresh, logout and session APIs exist, but the frontend has no production authentication shell.
2. The frontend boots directly into an ERP role instead of resolving identity through `/auth/me`.
3. The development role switcher mutates local role state and bypasses real authentication identity.
4. The API client refreshes every 401 response and requires safeguards for login, refresh and MFA endpoints.
5. Stable device identity is required for login and refresh, but no frontend device-ID integration exists.
6. Primary Master protection and protected Master-role governance are absent.
7. Role history, café-assignment history and protected promotion or demotion workflows are incomplete.

## Role and permission conflicts

| Conflict | Current state | Required rule |
|---|---|---|
| Personal Ledger exposure | Owner navigation includes Personal Ledger | Personal Ledger must be Master-only and undiscoverable to Owner, Café Admin and Staff |
| Frontend role trust | Sidebar and routes use local `state.role` | Backend-authenticated user identity must determine visible routes and all API permissions |
| Owner portal separation | Owner shares parts of the general shell | Owner must remain in the separate Owner Portal and must not enter Master Administration, Trash, technical Audit or Personal Ledger |
| Café Admin scope | Backend café checks exist, but frontend data is largely sample-based | Every API query and mutation must enforce active assigned-café scope |
| Staff privacy | Staff pages exist | Staff must receive only the staff member’s own records from the backend |
| Expense decisions | Backend absolute restriction exists | Approval, rejection, return, mark-paid and reversal must remain Master-only throughout UI and API |

## Data and module conflicts

1. Many frontend screens contain hard-coded sample records while corresponding backend models or APIs are absent.
2. Personal Ledger inserts a fake transaction locally and has no canonical backend model or route.
3. Inventory has a frontend page but no global-item, café-balance or stock-movement backend architecture.
4. Notifications are partly backend-based but the frontend still simulates local notifications and popups.
5. Revenue Share and Department Orders are documentation or standalone-package references, not integrated MongoDB modules.
6. Vendors, Procurement, Customers, Loyalty, Quality, Compliance, Assets, Maintenance and private object storage have no complete canonical implementation.
7. Reports exist partially but company-logo watermarking, complete exports and asynchronous large-report handling are absent.
8. Trash lifecycle and complete technical Audit surfaces are not integrated.

## Payroll and attendance conflicts

1. Payroll code and frontend workflows are locally implemented but have not persisted real staging records.
2. A full attendance-to-payroll-to-payslip-to-payment lifecycle has not been executed against staging MongoDB.
3. Loans and advances are referenced but do not yet form a complete independent employee lifecycle.
4. Attendance calendar, automatic absence, correction history, overtime approval and payroll-lock controls remain incomplete.
5. Payroll must not be classified as fully verified until the deferred staging lifecycle succeeds.

## Files and deployment conflicts

1. No Git remote is configured in the local repository.
2. No Vercel or Render deployment configuration is present.
3. Permanent files cannot be stored on Render temporary storage.
4. Private object-storage metadata, signed access and persistence testing are absent.
5. No cloud resource has yet been audited or approved for reuse, replacement or retirement.
6. Previously exposed credentials must be rotated during the final security and deployment phase.

## Conflict-resolution rule

Resolve conflicts by preserving the canonical Express and Mongoose backend, the existing static frontend design, backend-enforced identity and permissions, organisation and café scoping, Master-only restrictions, secure sessions and the fixed Vercel to Render to MongoDB Atlas runtime architecture.
