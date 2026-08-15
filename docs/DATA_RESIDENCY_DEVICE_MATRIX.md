# ZAMORIN CAFE ERP — DATA RESIDENCY & DEVICE DELIVERY MATRIX

**PURPOSE**: Complete matrix defining the strict delivery, storage, and persistence rules for every data domain across Personal vs Cafe-Owned hardware.

---

## 1. Data Residency & Delivery Matrix

| Data Domain / Entity | Personal Mobile (including CAFE_ADMIN Personal Phone) | Registered Active CAFE_OWNED Kiosk | Storage & Persistence Invariant |
| :--- | :--- | :--- | :--- |
| **Personal Profile** | **OWN ONLY** (`request.auth.userId`) | Operator's own profile only | Transient memory only; zero employee directory caching |
| **Staff Attendance** | **OWN ONLY** (Check-in/out records) | Full shift roster for bound café (`ZC-0001`) | Personal: minimal pending outbox in IndexedDB |
| **Employee Directory / Rosters** | **HARD DENIED (403)** | Allowed for bound café (`ZC-0001`) | Blocked at query level on backend |
| **POS Billing & Orders** | **HARD DENIED (403)** | Allowed to authenticated `CAFE_ADMIN` | Zero POS payload delivered to personal sessions |
| **Cash Drawer / CashBook** | **HARD DENIED (403)** | Allowed for bound café shift close | No service-worker caching of `/api/*` responses |
| **Raw Material Stock Levels** | **HARD DENIED (403)** | Allowed for bound café (`ZC-0001`) | Blocked at query level on backend |
| **Inventory Intake & Movements** | **HARD DENIED (403)** | Allowed for bound café (`ZC-0001`) | Blocked at query level on backend |
| **Vendor Payables & Contacts** | **HARD DENIED (403)** | Allowed to authorized operational roles | Blocked at query level on backend |
| **Cafe Operational Expenses** | **HARD DENIED (403)** | Allowed for submission (`CAFE_ADMIN`) | Blocked on personal mobile |
| **Personal Ledger** | **MASTER ONLY** (Denied to all others) | **MASTER ONLY** (Denied to all others) | Immutable zero-trust boundary |
| **QR Attendance Scanner** | **ALLOWED** (Personal mobile scanner) | Optional | Scanner holds no employee directory |
| **QR Challenge Issuer** | **HARD DENIED (403)** | **ALLOWED** (Active bound kiosk only) | Private signing key resides strictly on kiosk |
| **Offline Pending Attendance** | Own signed compact envelope only | Active device challenge/lease only | IndexedDB; purged upon server acknowledgment |
