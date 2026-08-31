# ZAMORIN CAFÉ ERP
# POST-DEPLOYMENT PRODUCTION SMOKE CHECKLIST

**Execution Protocol:** Post-Release Execution Only (DO NOT EXECUTE PRIOR TO FORMAL PROMOTION)  
**Safety Rule:** Strict Non-Destructive / Safe Read-Only Queries Only (Zero Mock Data Injected)  
**Target Environments:** Production Vercel (`https://zamorin-cafe-erp.vercel.app`) · Production Render API (`https://zamorin-cafe-erp-backend.onrender.com`)  

---

## 1. PRE-SMOKE VERIFICATION

- [ ] Vercel deployment completed with status `READY`.
- [ ] Render web service deployment finished with status `Live`.
- [ ] Render Health Check `/api/v1/health` responding with HTTP `200 OK`.
- [ ] Atlas Cluster status `HEALTHY` with active primary replica.

---

## 2. PRODUCTION SMOKE TEST MATRIX

| Step # | Focus Area | Verification Action | Expected Result | Checked |
| :---: | :--- | :--- | :--- | :---: |
| **01** | **Homepage & Static Assets** | Navigate to `https://zamorin-cafe-erp.vercel.app` | Login screen loads instantly (< 1.5s), stylesheets apply, zero 404s on assets. | [ ] |
| **02** | **Security Headers** | Inspect network response headers in browser DevTools | `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` present. | [ ] |
| **03** | **API Health Endpoint** | `curl -i https://zamorin-cafe-erp.vercel.app/api/v1/health` | HTTP `200 OK`, JSON body contains `{ success: true, status: "ok" }`. | [ ] |
| **04** | **Database Readiness** | `curl -i https://zamorin-cafe-erp.vercel.app/api/v1/readiness` | HTTP `200 OK`, JSON body contains `{ readyState: 1, database: "connected" }`. | [ ] |
| **05** | **Primary Master Sign-In** | Sign in with Primary Master credentials | MFA prompt appears (if configured); successful authentication routes to `#dashboard`. | [ ] |
| **06** | **Credential Storage Check** | Inspect browser `localStorage` and `sessionStorage` in DevTools | `accessToken` stored in-memory only; `refreshToken` in HttpOnly cookie; **0 tokens in web storage**. | [ ] |
| **07** | **Role Navigation Scope** | Inspect navigation drawer as Master | Governance, Cafes, Employees, Treasury, Passbook, POS, Inventory, Reports visible. | [ ] |
| **08** | **Cafe Owner Scope (Read)** | Log in as Cafe Owner, navigate to `#reports` | Aggregate revenue & P&L summaries load; master-only governance items absent. | [ ] |
| **09** | **Cafe Admin Scope (Read)** | Log in as Cafe Admin, navigate to `#operations` | Assigned cafe operational views load; unassigned cafes forbidden (403). | [ ] |
| **10** | **Staff / Cashier Scope** | Log in as Staff/Cashier | Minimal terminal layout; management & financial configuration inaccessible. | [ ] |
| **11** | **Passbook & Personal Ledger** | Open `#passbook` and `#ledger` tabs | Ledger balance and transaction history render without NaN or undefined errors. | [ ] |
| **12** | **POS & Menu Catalog** | Open `#pos` | Menu categories and active items populate from database. | [ ] |
| **13** | **Inventory Read** | Open `#inventory` | Stock levels, low stock warnings, and unit metrics display accurately. | [ ] |
| **14** | **Session Inactivity Lock** | Wait or trigger manual screen lock | Lock screen overlay activates; requires PIN/password re-entry to resume. | [ ] |
| **15** | **Token Refresh (Single-Flight)**| Trigger API request near token expiration | Background `/auth/refresh` succeeds cleanly with zero UI disruption. | [ ] |
| **16** | **Session Logout** | Click user avatar -> Log Out | In-memory token wiped, session revoked on backend, redirected to login screen. | [ ] |
| **17** | **PWA Manifest & Icons** | Inspect `manifest.json` and service worker registration in Application tab | Manifest recognized, icons loaded (1024/2048/4096), SW registered. | [ ] |
| **18** | **Theme Switcher** | Switch between `Paper`, `Pearl`, `Midnight`, `Noir` | Theme tokens apply instantly with WCAG 2.2 compliant contrast on all views. | [ ] |
| **19** | **Mobile Responsiveness** | Test on mobile device viewport (375px) | Zero horizontal overflow, touch targets >= 38px, off-canvas drawer functions smoothly. | [ ] |
| **20** | **Log Sanitization Check** | Inspect Render runtime logs during smoke test | Zero passwords, tokens, MongoDB URIs, or private keys logged. | [ ] |

---

## 3. POST-DEPLOYMENT MONITORING TIMELINE

- **First 5 Minutes:** Continuous Render log tailing for uncaught exceptions or 500 spikes.
- **First 15 Minutes:** Monitor Atlas connection count, CPU, and replication lag.
- **First Hour:** Verify real user sign-ins across all locations; verify 0 CORS / CSRF rejections.
- **First Business Day:** Confirm automated nightly backups and zero anomalous lockups.

---

## 4. SMOKE TEST SIGN-OFF

| Role | Signee Name | Date / Time | Verdict |
| :--- | :--- | :--- | :---: |
| **Release Lead** | *Pending Release Execution* | *Pending* | `PENDING` |
| **Technical Lead** | *Pending Release Execution* | *Pending* | `PENDING` |
