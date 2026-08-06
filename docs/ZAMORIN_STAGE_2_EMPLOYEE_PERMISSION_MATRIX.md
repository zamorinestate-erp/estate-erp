# Zamorin Cafe ERP — Stage 2.4 Employee Permission and Field-Visibility Matrix

Status: `STAGE_2_4_PERMISSION_MATRIX_COMPLETE`

Design checkpoint: `cccd65f`

## 1. Purpose

This document defines the backend authorization, record-scope, response-field, masking, audit, and route contracts for Stage 2 employee search and full employee profile reads.

It is authoritative for Stage 2.5 onward. The browser must never decide which employee record or field is visible. Every decision must be derived from `request.auth`, the stored permission rule, and the employee record returned from MongoDB.

## 2. Existing Security Foundation

The current backend already provides:

- authenticated identity from `request.auth.userId`;
- organisation identity from `request.auth.organisationId`;
- role from `request.auth.role`;
- assigned café IDs from `request.auth.assignedCafeIds`;
- database-backed permission rules;
- permission scopes including `ORGANISATION`, `ASSIGNED_CAFES`, `CAFE`, `SELF`, and `RECORD`;
- field-access metadata through `allowedFields`, `deniedFields`, and `maskedFields`;
- secure audit helpers that derive actor identity from the authenticated request;
- employee record scoping through `buildEmployeeScopeFilter`;
- compact response shaping through `buildEmployeeSearchResult`;
- full profile shaping through `buildEmployeeProfile`.

Current generic `/api/v1/users` read handlers return raw User documents and must not be treated as the final Stage 2 employee-read contract.

## 3. Dedicated Employee Read Permissions

Stage 2 employee reads use dedicated permission codes rather than reusing administrative mutation permission `USER:MANAGE`.

| Permission | Roles | Purpose |
|---|---|---|
| `EMPLOYEE:READ` | MASTER, OWNER, CAFE_ADMIN | Read an employee record within the role's backend-enforced scope |
| `EMPLOYEE:READ_SELF` | STAFF | Read only the authenticated employee's own record |

The current seeded `USER:READ` and `USER:READ_SELF` rules are historical user-module rules. Stage 2.5 must add or migrate to the dedicated employee-read permissions without weakening existing protections.

## 4. Record-Scope Matrix

| Role | Search access | Profile access | Authoritative scope |
|---|---|---|---|
| MASTER | Yes | Yes | All employee records in `request.auth.organisationId` |
| OWNER | Yes | Yes, read-only | All employee records in `request.auth.organisationId` |
| CAFE_ADMIN | No organisation-wide directory search in Stage 2.5 | Yes | Active employees whose `assignedCafeIds` intersect the actor's authenticated assigned cafés |
| STAFF | No directory search | Own profile only | `userId === request.auth.userId` and same organisation |

Rules:

1. Cross-organisation records must return a concealed not-found response.
2. Café Admin records must be both active and assigned to at least one café held in the actor's authenticated café scope.
3. Staff target identity must be taken from `request.auth.userId`; a route parameter or request body must never broaden Staff access.
4. MASTER and OWNER scope is organisation-wide, never cross-organisation.
5. Record visibility must be revalidated after the MongoDB query and before serialization.
6. A stale deep link must not bypass the current role, café assignment, account status, or organisation checks.

## 5. Search Endpoint Contract

Planned endpoint:

`GET /api/v1/employees/search`

Allowed roles:

- MASTER with `EMPLOYEE:READ`;
- OWNER with `EMPLOYEE:READ`.

The endpoint must:

- use server-side MongoDB search;
- support exact permanent User/Employee ID;
- support legal name, preferred name, and stored previous names;
- support case-insensitive and accent-insensitive normalized search;
- reject or normalize fragments shorter than the documented minimum;
- use `employeeSearchTerms` and the compound organisation search index;
- apply organisation scope before search terms;
- use bounded pagination;
- return only `buildEmployeeSearchResult` output;
- never load all employees into the browser;
- never return email, phone, address, emergency contact, histories, security metadata, search internals, or salary information.

Approved search-result fields:

- `userId`
- `name`
- `preferredName`
- `role`
- `accountStatus`
- `isPrimaryMaster`
- `primaryCafeId`
- `assignedCafeIds`
- `joiningDate`
- `department`
- `designation`

## 6. Full Employee Profile Route Contract

Planned profile routes:

- `GET /api/v1/employees/:userId`
- `GET /api/v1/employees/me`

`GET /api/v1/employees/:userId` may be used by MASTER, OWNER, and CAFE_ADMIN after permission and record-scope enforcement.

`GET /api/v1/employees/me` derives the target solely from `request.auth.userId` and supports all four employee roles. STAFF must use self scope.

The controller must:

1. authenticate;
2. authorize the dedicated employee permission;
3. derive organisation and actor identity from `request.auth`;
4. build the MongoDB filter with `buildEmployeeScopeFilter`;
5. query with an explicit projection;
6. return not found when no scoped record exists;
7. revalidate record access;
8. serialize through `buildEmployeeProfile`;
9. never return a raw Mongoose User document.

## 7. Field-Visibility Matrix

Legend:

- `VISIBLE` — returned in the normal profile response;
- `SELF_ONLY` — returned only when the employee is the authenticated actor;
- `DENIED` — omitted;
- `NOT_INTEGRATED` — no authoritative source exists yet and no value may be invented.

| Profile area | MASTER | OWNER | CAFE_ADMIN | STAFF |
|---|---|---|---|---|
| Permanent employee ID | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Legal name | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Preferred name | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Role and account status | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Primary/assigned cafés | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Joining date | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Employment type | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Department and designation | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Email and phone | VISIBLE | VISIBLE | VISIBLE | SELF_ONLY |
| Previous names | VISIBLE | DENIED | DENIED | SELF_ONLY |
| Address | VISIBLE | DENIED | DENIED | SELF_ONLY |
| Emergency contact | VISIBLE | DENIED | DENIED | SELF_ONLY |
| Role history | VISIBLE | DENIED | DENIED | DENIED |
| Café-assignment history | VISIBLE | DENIED | DENIED | DENIED |
| Archive/lifecycle details | VISIBLE | DENIED | DENIED | DENIED |
| Attendance calendar | `DEFERRED_STAGE_4` | `DEFERRED_STAGE_4` | `DEFERRED_STAGE_4` | `DEFERRED_STAGE_4` |
| Leave | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED |
| Shifts | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED |
| Tasks | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED |
| Loans and advances | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED |
| Documents | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED | NOT_INTEGRATED |
| Salary summary | Later authorised integration only | DENIED | DENIED | Own-authorised integration only |
| Bank details | Later sensitive reveal only | DENIED | DENIED | Own-authorised reveal only |
| Government IDs | Later sensitive reveal only | DENIED | DENIED | Own-authorised reveal only |
| Private HR notes | Later MASTER-only design | DENIED | DENIED | DENIED |

OWNER is strictly read-only. Visibility does not grant update, reveal, export, or administrative authority.

## 8. Fields That Must Never Be Returned

The following are always denied regardless of role, route, permission-rule configuration, or projection:

- `passwordHash`
- `passwordHistoryHashes`
- MFA secrets or pending MFA secrets
- recovery-code hashes
- access or refresh tokens
- session identifiers embedded in history
- `sessionVersion`
- `permissionsVersion`
- failed-login counters
- lock timestamps
- password-reset and password-expiry metadata
- `employeeSearchTerms`
- internal MongoDB versioning or operational security fields

A database permission rule must never be able to override these permanent exclusions.

## 9. Use of Permission Field Metadata

`allowedFields`, `deniedFields`, and `maskedFields` are defence-in-depth metadata.

The employee response builder remains the primary allowlist. The controller may additionally apply the effective permission rule as follows:

1. start with the role-specific serializer output;
2. remove every `deniedFields` path;
3. mask every `maskedFields` path using a documented non-reversible display mask;
4. when `allowedFields` is non-empty, retain only explicitly allowed paths within the serializer's already-approved output;
5. never use permission metadata to add a field absent from the serializer;
6. never allow a database rule to expose a permanently forbidden security field.

## 10. Sensitive Reveal and Export

Stage 2.5 normal search and profile reads do not reveal bank details, government IDs, private HR notes, or document contents.

Any future sensitive reveal or employee export must require:

- a separate dedicated permission;
- backend authorization;
- recent step-up authentication where required;
- a mandatory reason;
- a backend audit event;
- minimum necessary fields;
- no client-provided actor identity;
- no caching of revealed values in persistent browser storage.

Sensitive reveal and export audit events must include actor, target employee ID, action, reason, result, correlation ID, and authorised field category without writing the secret value into the audit record.

## 11. Audit Policy for Ordinary Reads

Ordinary paginated search and ordinary profile view are low-risk reads and need not create one audit event per rendered row.

The following must be audited:

- sensitive-field reveal;
- employee export;
- denied sensitive reveal or export;
- administrative profile mutation;
- role or café-assignment change;
- status or lifecycle change;
- any future bulk employee download.

Denied cross-organisation and out-of-scope record access may be security-audited without disclosing whether the target exists.

## 12. Deep-Link Revalidation

A frontend route such as `/employees/:userId` is only a navigation hint.

On every load and refresh, the API must re-evaluate:

- authenticated user ID;
- current role;
- current organisation;
- current café assignments;
- current target account status;
- current permission rule;
- current record intersection;
- current response-field policy.

Cached frontend data must not be accepted as authorization evidence.

## 13. Stage 2.5 Implementation Requirements

Stage 2.5 must implement the employee search API without changing this matrix.

Required work:

1. add dedicated employee read permission rules;
2. add employee routes without creating a second backend;
3. add explicit MongoDB projections;
4. add pagination and validated query parameters;
5. use the indexed normalized search terms;
6. authorize MASTER and OWNER for `GET /api/v1/employees/search`;
7. return only `buildEmployeeSearchResult`;
8. add direct positive and negative tests;
9. verify organisation isolation and query bounds;
10. keep current generic user administration routes separate.

Stage 2.5 must not add frontend screens, attendance calendar expansion, sensitive reveal, export, or mutation of the new profile fields.

## 14. Acceptance Conditions

Stage 2.4 is complete when this matrix is committed and the following remain true:

- identity comes only from authenticated backend context;
- organisation and café scope are backend-enforced;
- MASTER and OWNER search is organisation-scoped;
- CAFE_ADMIN profile access is active assigned-café only;
- STAFF is self-only;
- raw User documents are not the Stage 2 response contract;
- response builders use explicit allowlists;
- permanent security exclusions cannot be overridden;
- sensitive reveal and export remain separately authorised and audited;
- Stage 2.5 has a precise, testable route and field contract.
