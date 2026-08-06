# Zamorin Cafe ERP — Stage 2.1 Employee Module Audit

## 1. Audit identity

- **Stage**: Stage 2.1 — Current Employee Module Audit
- **Protected starting checkpoint**: `bb3f0e3`
- **Branch**: `main`
- **Architecture**: Vercel frontend → Render Express API → MongoDB Atlas through Mongoose
- **Audit scope**: Employee search, employee read access, full employee profile, related attendance and payroll data, frontend identity integration, permissions, tests and mock-data conflicts
- **Audit decision**: `STAGE_2_1_AUDIT_COMPLETE`
- **Implementation status**: No Stage 2 production implementation started during this audit

## 2. Existing employee identity

The existing `User` model is the permanent employee identity and must remain the single source of identity for Master, Owner, Café Admin and Staff users.

Existing usable fields include permanent `userId`, `organisationId`, `name`, `preferredName`, `email`, `phone`, `role`, `accountStatus`, café assignments, Primary Master metadata, role history, café-assignment history, archive metadata and timestamps.

A separate Employee identity or duplicate employee collection must not be introduced.

## 3. Existing backend read behaviour

The authenticated user router currently provides `GET /api/v1/users` (`GET /users` within the API router) and `GET /api/v1/users/:userId`. There is no dedicated employee-search endpoint and no dedicated full employee-profile endpoint.

The current `listUsers` controller scopes records by organisation, Café Admin café assignment and Staff self-access. It supports role, account-status and café filters, but searches using unescaped regular expressions, has no pagination, loads all matches, does not search `preferredName`, has no previous-name field and returns User documents directly.

The current `getUser` controller applies organisation and basic record access, but also returns the User document directly. Stage 2 requires dedicated projected response contracts with backend field-level visibility.

## 4. Current frontend Employees page

`frontend/src/js/pages/employees.js` is mock-only.

Confirmed conflicts:

- hard-coded `EMPLOYEES` data;
- fake employee names, cafés, phone and bank values;
- fixed `Dawn Roast` Café Admin scope;
- no backend API;
- no search or pagination;
- complete bank values already delivered to the browser;
- browser-only reveal;
- a toast falsely claims an audit event.

The mock array and fake reveal workflow must be removed rather than adapted.

## 5. Frontend authentication conflict

The backend exposes authenticated identity through `GET /api/v1/auth/me`, `request.auth` and `request.authenticatedUser`. The frontend does not consume `/auth/me`.

Current conflicts:

- `state.role` defaults to Master;
- a visible development role switcher changes frontend role;
- navigation and routing rely on mutable browser role;
- there is no authenticated-current-user bootstrap.

Required bounded prerequisite:

1. Load `/api/v1/auth/me`.
2. Map backend roles to frontend navigation keys.
3. Store authenticated User ID, organisation, role and café scope.
4. Remove the visible role switcher from normal boot.
5. Treat the backend as final authority for all employee search and profile access.
6. Show a safe authentication-required state when no session exists until the later login-page stage.

This prerequisite does not replace the later complete login-page integration stage.

## 6. Existing related data

### Attendance

The `Attendance` model provides genuine employee-linked records using organisation, café, User ID and business date. Existing indexes and list pagination can support a bounded profile summary. The full calendar upgrade remains Stage 4.

### Payroll and payslips

The `Payslip` model provides employee, period, attendance, earnings, deductions, net-pay and payment snapshots. Existing payroll rules remain unchanged: only Master and Owner manage payroll, while all four roles view only their own issued payslips through self-service.

Stage 2 must not expose another employee's payslip. Any administrative salary summary requires a separate authorised contract consistent with current payroll policy.

## 7. Missing integrated profile data

The current MongoDB app has no integrated models for previous names, joining date, employment type, department, current designation, address, emergency contacts, documents, government identifiers, bank details, leave, shifts, tasks, loans/advances, private HR notes or profile-image storage.

Stage 2 must not invent unavailable records. Profile sections must use genuine integrated data and omit or honestly mark unavailable sections.

## 8. Sensitive-data findings

`User.toJSON()` removes password and MFA secret material, but direct User responses may still include operational metadata not required for employee display, including session and permission versions and security timestamps.

Stage 2 requires explicit projections and response builders. Sensitive fields must be excluded by the backend, never sent and hidden by CSS. Future sensitive reveal/export actions must create backend audits without storing secret values.

## 9. Search and indexing gaps

Existing indexes support organisation, User ID, email, role/status and café/status queries.

Missing capabilities:

- server-side, safely bounded case-insensitive name search;
- preferred-name search;
- previous-name search;
- exact User ID priority;
- pagination and safe limits;
- stable sorting;
- escaped input;
- projected response fields;
- query-plan evidence.

The implementation must not load all employees into the browser.

## 10. Permission matrix

### Master
Organisation-wide authorised search and profile access. Stage 1 and Primary Master protections remain active.

### Owner
Organisation-wide read-only access according to policy, with bank, government-ID, security and private HR fields masked or excluded.

### Café Admin
Only employees actively assigned to cafés assigned to the authenticated Admin. Backend intersection is mandatory on search and deep links.

### Staff
Self-profile only. Identity comes from `request.auth.userId`; a browser-supplied alternative ID cannot grant access.

## 11. Test gaps

No dedicated tests currently cover employee search, exact/full/partial/case-insensitive/preferred/previous-name matching, pagination, response projection, Owner masking, Café Admin scope, Staff self-only access, deep-link revalidation, cross-organisation protection, sensitive audits or Employees-page API integration.

## 12. Stage 2 boundaries

Stage 2 will implement authenticated identity bootstrap required by Employees, necessary User schema additions, indexes, permission and field-visibility policy, paginated search API, projected result contract, protected profile API, genuine available profile sections, masking/audit foundations, API-backed Employees UI, profile UI, tests and completion documentation.

Stage 2 will not prematurely implement Stage 3 global search, the full Stage 4 attendance calendar, future leave/tasks/loans modules, full document storage, the later complete login-page integration or Atlas staging validation.

## 13. Immediate next step

Proceed to **Stage 2.2 — Employee schema and response-contract design** after committing this audit.

The first production batch must be limited to required User schema additions, safe employee response builders, search indexes and tests for schema normalisation and sensitive-field exclusion.

Do not begin the frontend Employees replacement until the backend read contract and tests are complete.
