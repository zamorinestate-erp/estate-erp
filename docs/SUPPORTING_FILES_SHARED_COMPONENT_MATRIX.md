# ZAMORIN CAFÉ ERP — SHARED COMPONENT & INFRASTRUCTURE MATRIX

## 1. Shared Frontend Runtime Inventory
| Component File | Canonical Exports | Consuming Modules | Description |
| :--- | :--- | :--- | :--- |
| `frontend/src/js/components.js` | `openModal`, `closeModal`, `showToast`, `confirmDialog`, `renderTable`, `renderPagination` | 49 / 49 pages | Universal UI primitive framework |
| `frontend/src/js/apiClient.js` | `apiGet`, `apiPost`, `apiPut`, `apiDelete`, `uploadFile` | 49 / 49 pages | Authenticated REST transport engine |
| `frontend/src/js/navigation.js` | `renderSidebar`, `isRouteAllowed`, `ROLES`, `PER_ROLE_NAV` | `router.js`, `main.js` | Role-based navigation matrix |
| `frontend/src/js/router.js` | `navigate`, `getCurrentRoute`, `initRouter` | `main.js`, All pages | 152-route dynamic dispatcher |
| `frontend/src/js/state.js` | `getState`, `setState`, `subscribe`, `clearState` | All pages | Reactive client state store |
| `frontend/src/js/icons.js` | `getIconSvg`, `ICON_SET` | All pages | SVG icon vector repository |
| `frontend/src/js/ist.js` | `formatIstDateTime`, `getIstDate` | All pages | IST Timezone normalization utility |

## 2. Integrity Verification
- **Broken Imports**: 0
- **Circular Dependencies**: 0
- **Status**: 100% Verified
