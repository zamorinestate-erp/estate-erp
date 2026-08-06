# Zamorin Cafe ERP - Implementation Order

## Basis

This order follows the verified local repository state at commit `9afa26f`. MongoDB Atlas, Render, Vercel and live staging validation remain deferred until the local application build is complete.

## Governing rules

- Complete, test and commit one bounded stage before starting the next.
- Preserve the existing static frontend, Express API and Mongoose/MongoDB architecture.
- Keep identity, organisation, café, record and field permissions backend-enforced.
- Do not classify a module as complete from UI, routes, models or mock data alone.
- Personal Ledger and expense decisions remain Master-only.
- Cloud creation, secret rotation and deployment occur only in the final infrastructure phase.

## Stage 1 - Identity governance and Primary Master protection

1. Add organisation-level Primary Master protection.
2. Preserve permanent user identity across promotion, demotion and rehire.
3. Add role and café-assignment history.
4. Protect high-risk role changes with step-up authentication, reason, impact preview, confirmation, session invalidation and audit.
5. Add positive and negative API tests.
6. Commit as a named checkpoint.

## Stage 2 - Production authentication frontend

1. Preserve the supplied login-page design.
2. Connect login, `/auth/me`, MFA, refresh, logout and session management.
3. Add a stable non-secret device ID.
4. Prevent refresh recursion on unauthenticated authentication endpoints.
5. Remove the development role switcher and local role impersonation.
6. Route authenticated users to the correct role surface.
7. Clear authenticated PWA state safely on logout.
8. Commit after role and session tests pass.

## Stage 3 - Employee search and full employee profile

Implement server-side search, pagination, permanent IDs, complete profile views, field masking, café scope, self-only staff access, Owner read-only access, sensitive-reveal audit and protected deep links.

## Stage 4 - Global Search

Implement permission-aware server search, indexes, grouped results, keyboard launcher, cancellation, recent-search privacy and backend-revalidated deep links.

## Stage 5 - Attendance calendar and control upgrade

Implement monthly calendar views, combined states, detail drawer, automatic absence, correction history, overtime approval, payroll lock, reports and direct role/café permission tests.

## Stage 6 - Global Inventory Master

Implement global item definitions, café configuration, café balances, immutable movements, conversions, atomic operations, duplicate control, negative-stock rules, approval thresholds and audit.

## Stage 7 - Vendors and Procurement

Implement vendor lifecycle, requisitions, purchase orders, receipts, approvals, inventory integration, reports, notifications and tests.

## Stage 8 - Add New Café and extensible business units

Implement controlled café creation, business-unit types, feature flags, conversion impact preview and preserved history. Keep unconfirmed hotel operations disabled.

## Stage 9 - Report branding and watermark

Implement company-logo watermarking, default-on policy, controlled override, PDF/print branding, export metadata, configuration history and output tests.

## Stage 10 - Remaining business modules

Complete Personal Ledger, Customers and Loyalty, Quality and Compliance, Assets and Maintenance, Revenue Share, Department Orders, private files, Trash Bin, Audit, notifications, finance depth, POS integration, reports, settings and all role portals.

## Stage 11 - Remove mocks and production-incompatible behaviour

Remove hard-coded production data, fake actions, placeholder routes, local notifications, role impersonation, sample Personal Ledger entries and incomplete buttons. Replace them with authenticated APIs or honest empty states.

## Stage 12 - Local regression and security testing

Run syntax, service, API, role, café-scope, financial, attendance, payroll, responsive, accessibility, export, retry, idempotency and security tests. Fix all P0 and mandatory P1 defects.

## Stage 13 - Deferred staging infrastructure and lifecycle validation

1. Audit old Atlas, Render, Vercel and GitHub resources.
2. Create the required cloud audit and configuration documents.
3. Create clean Atlas staging resources and fresh credentials.
4. Connect the backend locally to staging.
5. Run controlled seeds and real module lifecycle tests.
6. Create Render staging and verify health/readiness.
7. Create Vercel staging and connect the frontend.
8. Run all-role, security, performance and persistence tests.
9. Rotate previously exposed secrets and invalidate sessions.

## Stage 14 - Production readiness and deployment

Create production resources only after staging approval, complete final readiness reports, deploy, stabilize, verify rollback, and retire old resources only after written approval.

## Immediate next implementation stage

Begin Stage 1 with a bounded Primary Master protection backend batch. Do not start Employee Search, Global Search, Inventory or another business module before Stage 1 is tested and committed.
