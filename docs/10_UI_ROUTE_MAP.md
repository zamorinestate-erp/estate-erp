# 10 — UI Route Map & Authorization Policy

> [!IMPORTANT]
> **Single Source of Truth**: UI routes defined in `navigation.js` and enforced by `router.js` and `authorize.js`.

---

## 1. Route Registry & Access Matrix

| Route ID | Hash Path | Display Label | MASTER | OWNER | CAFE_ADMIN | STAFF | EXTERNAL_VENDOR | Backend API Family |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `dashboard` | `#dashboard` | Command Centre / Overview | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/dashboard/*` |
| `admin` | `#admin` | Administration | `ALL` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/users`, `/api/v1/roles` |
| `assets` | `#assets` | Assets & Maintenance | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/assets/*` |
| `attendance` | `#attendance` | Attendance & Shifts | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/attendance/*` |
| `bills` | `#bills` | Bills & Receipts | `ALL` | `ALL` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/bills/*` |
| `customers` | `#customers` | Customers & Loyalty | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/customers/*` |
| `dept-orders` | `#dept-orders` | Department Orders | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/department-orders/*` |
| `employees` | `#employees` | Employees | `ALL` | `ALL` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/employees/*` |
| `expenses` | `#expenses` | Expenses | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/expenses/*` |
| `finance` | `#finance` | Finance & Accounts | `ALL` | `ALL` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/cash-transactions/*` |
| `inventory` | `#inventory` | Inventory | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/inventory/*` |
| `menu` | `#menu` | Menu Management | `ALL` | `ALL` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/menu/*` |
| `pos` | `#pos` | POS & Billing | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/bills/*` |
| `procurement` | `#procurement` | Procurement | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/procurement/*` |
| `quality` | `#quality` | Quality & Compliance | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/quality/*` |
| `reports` | `#reports` | Reports & Analytics | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/reports/*` |
| `settings` | `#settings` | Settings & Preferences | `ALL` | `ALL` | `ASSIGNED` | `DENIED` | `DENIED` | `/api/v1/users/me` |
| `trash` | `#trash` | Trash Bin | `ALL` | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/trash/*` |
| `vendors` | `#vendors` | Vendors | `ALL` | `ALL` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/vendors/*` |
| `ledger` | `#ledger` | Personal Ledger | `OWN` | `OWN` | `DENIED` | `DENIED` | `DENIED` | `/api/v1/personal-ledger/*` |
| `staff-home` | `#staff-home` | Home | `DENIED` | `DENIED` | `DENIED` | `SELF` | `DENIED` | `/api/v1/employees/me` |
| `staff-attendance`| `#staff-attendance`| My Attendance | `DENIED` | `DENIED` | `DENIED` | `SELF` | `DENIED` | `/api/v1/attendance/me` |
| `employee-profile`| `#employee-profile`| My Profile | `ALL` | `ALL` | `ASSIGNED` | `SELF` | `DENIED` | `/api/v1/employees/me` |
| `staff-leave` | `#staff-leave` | My Leave | `DENIED` | `DENIED` | `DENIED` | `SELF` | `DENIED` | `/api/v1/tasks` |
| `staff-payslips` | `#staff-payslips` | My Payslips | `ALL` | `ALL` | `ASSIGNED` | `SELF` | `DENIED` | `/api/v1/payroll/me` |
| `staff-loans-advances`| `#staff-loans-advances`| My Loans & Advances | `ALL` | `ALL` | `ASSIGNED` | `SELF` | `DENIED` | `/api/v1/loans-advances/me` |
| `announcements` | `#announcements` | Announcements | `ALL` | `ALL` | `ASSIGNED` | `SELF` | `DENIED` | `/api/v1/notifications` |
| `staff-settings` | `#staff-settings` | Settings | `DENIED` | `DENIED` | `DENIED` | `SELF` | `DENIED` | `/api/v1/users/me` |
| `vendor-portal` | `#vendor-portal` | Vendor Portal | `DENIED` | `DENIED` | `DENIED` | `DENIED` | `VENDOR` | `/api/v1/vendor-portal/*` |

---

## 2. Route Guard Enforcement Logic

```javascript
// router.js enforces three-layer defense:
// Layer 1: Client Hash Change Listener
// Layer 2: Role Permission Guard (isRouteAllowed)
// Layer 3: Backend REST API Authorization Middleware (authorize.js)
```
