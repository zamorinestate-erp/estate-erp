# ZAMORIN CAFE ERP — EMPLOYEE ONBOARDING TEMPLATE

**PURPOSE**: Validated schema and template for importing real employees, mapping job titles/personas to canonical application roles (`MASTER`, `OWNER`, `CAFE_ADMIN`, `STAFF`).

---

## 1. Role Architecture & Job Title Mapping Rule

> [!IMPORTANT]
> The Zamorin Cafe ERP system enforces strictly **FOUR** canonical RBAC roles.
> Job titles (e.g. *Cashier*, *Head Chef*, *Barista*, *Shift Lead*, *Store Manager*) are business designations and must map to one of the four application roles.

| Job Title / Persona | Approved Application Role | Operational Scope |
| :--- | :--- | :--- |
| **Managing Director / Founder** | `MASTER` | Organisation-wide governance, Master approvals, Personal Ledger |
| **Director / Investor / Board** | `OWNER` | Organisation-wide strategic visibility, executive reporting |
| **Branch Manager / Cafe Manager** | `CAFE_ADMIN` | Assigned cafe operations, POS billing, inventory, staff attendance |
| **Cashier / Head Barista** | `CAFE_ADMIN` | POS order entry, cash transactions, shift closing |
| **Barista / Waiter / Kitchen Staff** | `STAFF` | Self-service attendance, profile viewing, loan/advance requests |

---

## 2. Employee Data Fields

| Field Name | Type | Required | Description / Format | Example / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `employeeId` | String | **YES** | Format `/^ST-\d{4,}$/` or `/^AD-\d{4,}$/` | `ST-0101` / `AD-0001` |
| `organisationId` | String | **YES** | Organisation ID | `ZAMORIN` |
| `name` | String | **YES** | Full legal name | `Rahul Varma` |
| `designation` | String | **YES** | Business job title | `Senior Barista` / `Cashier` |
| `role` | String | **YES** | Enum: `MASTER`, `OWNER`, `CAFE_ADMIN`, `STAFF` | `STAFF` |
| `primaryCafeId` | String | **YES** (for Cafe Admin/Staff) | Bound cafe ID | `ZC-0001` |
| `assignedCafeIds` | Array | **YES** | Authorized cafes | `["ZC-0001"]` |
| `email` | String | **YES** | Corporate / login email | `rahul.varma@zamorincafe.com` |
| `phone` | String | **YES** | 10-digit mobile number | `+91 98461 11222` |
| `joiningDate` | Date | **YES** | Date of joining | `2026-08-01` |
| `monthlyBaseSalary` | Number | **YES** | Safe integer monthly base salary (INR) | `24000` |
| `accountStatus` | String | **YES** | Enum: `ACTIVE`, `PENDING_ACTIVATION` | `PENDING_ACTIVATION` |

---

## 3. Onboarding JSON Payload Template

```json
[
  {
    "employeeId": "AD-0001",
    "organisationId": "ZAMORIN",
    "name": "Ananya Menon",
    "designation": "Cafe General Manager & Head Cashier",
    "role": "CAFE_ADMIN",
    "primaryCafeId": "ZC-0001",
    "assignedCafeIds": ["ZC-0001"],
    "email": "ananya.menon@zamorincafe.com",
    "phone": "+919846100001",
    "joiningDate": "2026-08-01",
    "monthlyBaseSalary": 45000,
    "accountStatus": "ACTIVE"
  },
  {
    "employeeId": "ST-0101",
    "organisationId": "ZAMORIN",
    "name": "Kiran Kumar",
    "designation": "Lead Barista",
    "role": "STAFF",
    "primaryCafeId": "ZC-0001",
    "assignedCafeIds": ["ZC-0001"],
    "email": "kiran.kumar@zamorincafe.com",
    "phone": "+919846100101",
    "joiningDate": "2026-08-15",
    "monthlyBaseSalary": 22000,
    "accountStatus": "ACTIVE"
  }
]
```
