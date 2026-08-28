# Zamorin Café ERP — Login Integration Stage 2
# Route Matrix & Reconciliation

## 1. Canonical Route Counts

- **Previous Canonical Route Count**: 149
- **Routes Added in Stage 2 (Implicit Pre-Session Auth Routes)**: 3
  - `#cafe-master-signin`
  - `#cafe-device-enroll`
  - `#cafe-terminal-welcome`
- **Total Registered Handled Routes**: 152

---

## 2. Stage-2 Terminal Route Details

| Route Hash | Screen Title (H1) | Allowed Roles | Back Destination | Theme Support | Responsive Viewports | Stage-3 Backend Dependency |
|---|---|---|---|---|---|---|
| `#cafe-master-signin` | Master Account Sign-In | `CAFE_ADMIN`, `MASTER` | `#cafe-operator-signin` | Paper, Pearl, Midnight, Noir | 1366x768 to 1920x1080 | `/api/v1/cafe-ops/operator/master-signin/credentials`, `/mfa` |
| `#cafe-device-enroll` | Enroll Cafe Terminal | `CAFE_ADMIN`, `MASTER` | `#cafe-operator-signin` | Paper, Pearl, Midnight, Noir | 1366x768 to 1920x1080 | `/api/v1/cafe-ops/devices/enroll` |
| `#cafe-terminal-welcome` | Cafe Operations Terminal | `CAFE_ADMIN`, `MASTER` | `#cafe-operator-signin` | Paper, Pearl, Midnight, Noir | 1366x768 to 1920x1080 | None (UI Navigation Hub) |

---

## 3. Sidebar & Pre-Auth Isolation

All 3 new routes are registered as **implicit sub-routes** in `navigation.js`:
- They bypass sidebar mount (no management sidebar visible before session creation).
- Direct URL entry is role-gated by the application router.
- Unauthenticated actors cannot access protected cafe operational or financial data.
