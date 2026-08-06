# Zamorin Cafe ERP — Current Module Status

## Audit basis

This report records the verified local repository state at commit `9afa26f`. Cloud resources and live MongoDB staging persistence remain deferred until the final deployment phase.

Allowed status values: `COMPLETE_AND_VERIFIED`, `PARTIAL`, `STANDALONE_NOT_INTEGRATED`, `UI_ONLY_OR_MOCK`, `BACKEND_ONLY`, `MISSING`, `BROKEN`, `BLOCKED`.

## Current module matrix

| Module | UI | API | MongoDB | Permissions | Audit | Notifications | Reports/Exports | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Authentication and sessions | Missing production login UI | Login, refresh, logout, MFA and sessions exist | User and Session models | Backend authentication exists | Partial | Partial | No | Not fully verified | `PARTIAL` | Backend auth routes exist; frontend has no real login flow |
| Primary Master protection | No | No protected workflow | No Primary Master field | Missing | Missing | Missing | No | No | `MISSING` | No `isPrimaryMaster` or equivalent protection found |
| Production role identity and redirection | Development role switcher | No frontend session bootstrap | No | Frontend trusts local role state | No | Demo notifications | No | No | `BROKEN` | `main.js` mounts DEV ACT AS switcher |
| Employees and HR lifecycle | Sample UI | User routes exist | User model | Partial organisation and café scope | Partial | No | Partial | Not verified | `PARTIAL` | Search, role history and complete employee profile are absent |
| Attendance and shifts | UI exists | Attendance routes exist | Attendance model | Partial | Partial | Partial | Attendance report route exists | Not staging-tested | `PARTIAL` | Calendar upgrade and payroll end-to-end validation remain |
| Payroll and payslips | Management and self-service UI exist | Full payroll lifecycle routes exist | PayrollRun and Payslip models | MASTER and OWNER management; self-view paths implemented | Audit logic exists | Partial | Payslip output present | Local checks passed; staging lifecycle deferred | `PARTIAL` | Real staging persistence and attendance-to-payroll test remain deferred |
| Expenses | UI exists | Expense API exists | Expense model | Master-only decisions enforced in backend | Partial | Partial | Partial | Not fully verified | `PARTIAL` | Frontend still contains sample-style behaviour |
| Personal Ledger | Demo UI exists | No backend API | No model | Backend absolute restriction exists but no module | No | No | No | No | `BROKEN` | Owner navigation incorrectly exposes Personal Ledger and page adds demo entry |
| Inventory | Sample UI exists | No inventory API | No inventory models | Missing | Missing | Missing | Missing | No | `UI_ONLY_OR_MOCK` | Global item and café stock architecture absent |
| Vendors and Procurement | No complete UI | No API | No models | Missing | Missing | Missing | Missing | No | `MISSING` | No canonical implementation found |
| Global Search | No | No | No indexes | Missing | Missing | Missing | No | No | `MISSING` | Only documentation reference found |
| Notifications | Demo frontend store | Notification API exists | Notification model | Partial | Partial | Backend model present | No | Not fully verified | `PARTIAL` | Frontend notifications are locally simulated |
| Reports and Analytics | UI exists | Report routes exist | Uses current models | Partial | Partial | No | Partial | Not fully verified | `PARTIAL` | Branding, watermark and complete exports remain |
| Revenue Share | No integrated UI | No API | No model | Missing | Missing | Missing | Missing | No | `STANDALONE_NOT_INTEGRATED` | Mentioned only in integration documentation |
| Department Orders | No integrated UI | No API | No model | Missing | Missing | Missing | Missing | No | `STANDALONE_NOT_INTEGRATED` | Mentioned only in integration documentation |
| Customers and Loyalty | No | No | No | Missing | Missing | Missing | Missing | No | `MISSING` | No repository implementation found |
| Quality and Compliance | No | No | No | Missing | Missing | Missing | Missing | No | `MISSING` | No repository implementation found |
| Assets and Maintenance | Limited references | No API | No models | Missing | Missing | Missing | Missing | No | `MISSING` | No canonical implementation found |
| Private files and object storage | No | No | No metadata model | Missing | Missing | Missing | Missing | No | `MISSING` | Persistent private object storage is absent |
| Trash Bin | Navigation references only | No complete API | No canonical trash model | Master restriction exists | Partial | No | No | No | `MISSING` | No complete lifecycle implementation found |
| Audit | Limited UI references | Audit API exists | AuditEvent model | Master restriction available | Backend service exists | No | Partial | Not fully verified | `PARTIAL` | Technical audit surface is incomplete |

## Confirmed conflicts

1. The frontend mounts a development-only role switcher and stores role identity locally.
2. Owner navigation currently exposes Personal Ledger although it must be Master-only.
3. The current frontend has no production login, session bootstrap, logout or MFA interface.
4. Primary Master protection, role history and protected role-governance workflows are missing.
5. Many frontend pages still use hard-coded or sample data.
6. Several required modules have no canonical backend model, route or service.

## Immediate conclusion

The application is not ready for release. The next implementation stage must begin with identity governance and Primary Master protection before employee search, Global Search and the remaining business modules.
