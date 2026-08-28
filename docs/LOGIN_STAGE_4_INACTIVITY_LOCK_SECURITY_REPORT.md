# Zamorin Café ERP — Login Integration Programme
# Stage 4 Inactivity Lock & Session Security Report

## 1. Dual-Layer Inactivity Enforcement Architecture

```
[User Idle Event Stream] ──(5 min no input)──> [Client UI Timer] ──> Render Lock Screen & Purge Sensitive DOM
                                                     │
                                                     ▼
[Any Protected API Request] ──> [Server Middleware (cafeOpsSessionContext)]
                                                     │
                                                     ├── Check `now > lastActivityAt + 5 min`
                                                     │     └─► If true: Mark status 'LOCKED', return 423 LOCKED
                                                     │
                                                     └── Check `now > startedAt + 12 hrs`
                                                           └─► If true: Mark status 'ENDED', return 401 EXPIRED
```

### Key Security Invariants

1. **Server Authority**: The 5-minute inactivity limit is enforced on every incoming HTTP request by `cafeOpsSessionContext.js` and `evaluateSessionLiveness`. Client timer manipulation (e.g. tampering with `Date.now()` or JavaScript variables) cannot bypass server lock.
2. **Absolute Session Lifetime**: An absolute maximum shift lifetime of 12 hours from `startedAt` is enforced regardless of continuous user activity.
3. **DOM Confidentiality on Lock**: When a terminal enters `LOCKED` state, business DOM (customer names, sales figures, cash balances) is removed or unrendered from the active view.
4. **Browser Navigation & History Integrity**:
   - `Browser Back / Forward`: Cannot resurrect previous unlocked screens.
   - `F5 Reload`: Authoritative server session status (`status: 'LOCKED'`) renders the lock screen.
   - `Deep Linking`: Protected subroutes require an `ACTIVE` (unlocked) session.
5. **Tab Backgrounding & Sleep/Resume**:
   - When a tablet or computer resumes from sleep beyond the 5-minute window, the very next server interaction verifies `lastActivityAt` and triggers immediate lock.
6. **Multi-Tab Sync**: All browser tabs sharing a terminal identity reflect the server's single active session state.
