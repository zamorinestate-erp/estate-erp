# ZAMORIN CAFÉ ERP
## LOGIN STAGE 5 — POST-AUTHENTICATION ROUTE & DEEP-LINK RESTORATION MATRIX

---

### 1. Post-Authentication Routing Scenarios

| Initial Condition | Target Hash / Request | Persona Authenticating | Expected Destination | Rationale |
|---|---|---|---|---|
| **Standard Login** | None (`/`) | Primary Master | `#dashboard` | Default canonical dashboard landing |
| **Standard Login** | None (`/`) | Owner | `#dashboard` | Default Owner executive landing |
| **Standard Login** | None (`/`) | Staff | `#staff-home` | Default Staff self-service portal |
| **Authorized Deep Link** | `#inventory/stock-by-cafe` | Primary Master | `#inventory/stock-by-cafe` | Authorized destination safely restored |
| **Authorized Deep Link** | `#bills` | Owner | `#bills` | Authorized destination safely restored |
| **Authorized Deep Link** | `#staff-leave` | Staff | `#staff-leave` | Authorized destination safely restored |
| **Unauthorized Deep Link** | `#inventory` | Staff | `#staff-home` | Privileged destination replaced with safe default; zero privilege escalation |
| **Unauthorized Deep Link** | `#finance/gl-journals` | Cafe Admin | `#dashboard` | Unauthorized finance route replaced with safe cafe dashboard |
| **Open Redirect Attempt** | `https://evil.example/steal` | Primary Master | `#dashboard` | Hostile external URL stripped; redirected to safe internal dashboard |
| **Open Redirect Attempt** | `//malicious.site` | Owner | `#dashboard` | Protocol-relative external URL stripped |
| **Open Redirect Attempt** | `javascript:alert(1)` | Staff | `#staff-home` | Dangerous URI scheme stripped |
| **Post-Password Reset** | Reset completion | Any Persona | `#login` | Enforces explicit re-authentication after password recovery |
| **Post-Logout** | User click Sign Out | Any Persona | `#login` | Clears all session tokens and returns to login screen |

---

### 2. Deep Link Sanitization Rule
All requested redirect parameters (e.g. `?returnUrl=...` or `?redirect=...`) must pass strict validation:
1. Must begin with `#` or `/` followed by an internal application subroute.
2. Must not contain `://` or start with `//`.
3. Must match a valid route from `ALL_TEST_ROUTES` where `isRouteAllowed(user.role, targetRoute)` evaluates to `true`.
4. If validation fails, fallback immediately to the persona's canonical root destination.
