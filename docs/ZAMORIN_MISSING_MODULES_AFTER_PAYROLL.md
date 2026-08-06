# Zamorin Cafe ERP - Missing Modules After Payroll

## Audit basis

This report is based on the integrated repository at commit `9afa26f`. Live MongoDB Atlas staging validation and cloud deployment remain intentionally deferred until the local application build is complete.

## Critical security and identity gaps

1. Organisation-level Primary Master protection is missing.
2. Role promotion, demotion and role-history preservation are incomplete.
3. High-risk role changes do not yet have a complete protected workflow with impact preview, step-up authentication, mandatory reason and immutable audit.
4. The frontend still mounts the development-only role switcher and trusts local role state.
5. The frontend does not yet bootstrap identity from `/auth/me`.
6. Production login, logout, MFA, session management and role-based redirection are not connected to the frontend.
7. Owner navigation incorrectly exposes Personal Ledger.
8. The frontend API client may attempt refresh on authentication endpoints and requires an unauthenticated-route safeguard.

## Missing canonical business modules

| Module | Current state | Required completion |
|---|---|---|
| Global Search | `MISSING` | Permission-aware server search, indexes, grouped results, keyboard launcher and protected deep links |
| Global Inventory Master | `UI_ONLY_OR_MOCK` | Global definitions, café configuration, café balances, stock movements, atomic updates and audit |
| Vendors | `MISSING` | Vendor model, API, café scope, approvals, lifecycle, reports and tests |
| Procurement | `MISSING` | Requisitions, purchase orders, receipts, approvals, vendor linkage, inventory integration and audit |
| Customers and Loyalty | `MISSING` | Customer identity, points ledger, rewards, consent, reports and access rules |
| Quality and Compliance | `MISSING` | Checklists, inspections, incidents, corrective actions, evidence and reports |
| Assets and Maintenance | `MISSING` | Asset register, assignment, maintenance schedules, service history and audit |
| Private files and object storage | `MISSING` | File metadata, private storage, permission-checked access, validation and persistent storage |
| Trash Bin | `MISSING` | Recoverable archive lifecycle, retention controls, restore and permanent-deletion governance |
| Revenue Share | `STANDALONE_NOT_INTEGRATED` | Port compatible logic into Mongoose architecture and connect UI, API, audit and reports |
| Department Orders | `STANDALONE_NOT_INTEGRATED` | Port compatible logic into the canonical backend without Prisma or PostgreSQL |
| Add New Café | `PARTIAL` | Controlled café creation, business-unit type, feature flags, conversion impact preview and audit |
| Report branding and watermark | `MISSING` | Company-logo watermark, default-on policy, PDF/print branding and configuration history |

## Partial modules requiring completion

| Module | Remaining work |
|---|---|
| Employees and HR | Server-side search, permanent identity, full profile, field masking, role history and lifecycle tests |
| Attendance and Shifts | Monthly calendar, combined states, correction history, absence automation, payroll lock and reports |
| Payroll and Payslips | Real staging persistence, valid generated payslip, attendance-to-payroll test and complete loans/advances lifecycle |
| Expenses | Remove sample frontend behaviour and verify full decision, payment, reversal, audit and notification flows |
| Personal Ledger | Build Master-only backend, remove demo entry action and enforce undiscoverability for all other roles |
| Notifications | Replace local simulation with authenticated backend data and real delivery state |
| Reports and Analytics | Complete exports, branding, watermark, permission controls and asynchronous large-report handling |
| Audit | Complete Master audit surface, protected queries, exports and tamper-resistance validation |
| Cash Book and Finance | Verify persistence, reconciliation, INR calculations, permissions and reports |
| POS and Billing | Verify authenticated persistence, stock and cash integration, numbering and reports |

## Mock or production-incompatible frontend behaviour

- Development `DEV - ACT AS` role switcher.
- Local role names, avatars and café labels.
- Locally simulated notifications and popups.
- Hard-coded sample records across multiple pages.
- Personal Ledger action that inserts a fake sample transaction.
- Placeholder and not-built pages.
- No production authentication shell or protected route bootstrap.

## Deferred validation blockers

The following are not classified as implemented until the final staging phase:

- MongoDB Atlas persistence tests.
- Payroll attendance-to-payment lifecycle validation.
- Render backend health and readiness validation.
- Vercel frontend-to-Render connection.
- Persistent private-file restart testing.
- Full role, café-scope, security and concurrency testing.

## Completion rule

A module remains incomplete until its responsive UI, validation, authenticated API, backend permissions, business rules, MongoDB persistence, status transitions, audit, notifications, reports or exports and tests operate as one verified workflow.
