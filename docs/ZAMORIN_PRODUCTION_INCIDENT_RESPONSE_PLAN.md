# ZAMORIN CAFÉ ERP
# PRODUCTION INCIDENT RESPONSE PLAN & ESCALATION PROTOCOL

**Document Version:** 1.0.0-PROD  
**Applicability:** Production Release & Post-Deployment Operations  
**Architecture:** Frontend (Vercel) · Backend (Render) · Database (MongoDB Atlas)  

---

## 1. PURPOSE & OBJECTIVES

This Incident Response Plan defines the authoritative operational protocol, severity classifications, escalation paths, roles, communication channels, and emergency containment/rollback procedures for Zamorin Café ERP in production.

---

## 2. INCIDENT SEVERITY MATRIX

| Severity Level | Definition | Impact Examples | Response SLA | Decision Authority |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical Emergency)** | Security breach, active data leakage, financial balance corruption, complete application outage, or database write loss. | • Cross-café or cross-user data leakage<br>• Authentication bypass or persistent 5xx on core auth<br>• Total Vercel / Render / MongoDB outage<br>• Unrecoverable transaction calculation defects | **< 15 minutes** | Release Lead & Tech Lead (Rollback Authorized) |
| **SEV-2 (Major Disruption)** | Major workflow failure with no immediate workaround, high 5xx error rate (>5%), or core POS/ordering blocker. | • POS order placement failing for multiple cafes<br>• Attendance / Shift clock-in blocked<br>• Token refresh failure loop for active sessions<br>• High-rate 429 throttling on legitimate user flows | **< 30 minutes** | Technical Lead |
| **SEV-3 (Moderate Issue)** | Partial feature degradation with viable temporary operational workaround. | • Report export to CSV failing (on-screen view works)<br>• Non-blocking theme rendering glitch<br>• Secondary notification delivery delay | **< 2 hours** | Engineering Team |
| **SEV-4 (Minor)** | Minor cosmetic, non-blocking UI alignment, or documentation typo. | • Icon alignment offset on obscure viewport<br>• Non-critical label clarification | **Next Standard Sprint** | Product / QA Lead |

---

## 3. INCIDENT COMMAND & RELEASE ROLES

| Role | Primary Responsibility | Contact Channel | Authority Scope |
| :--- | :--- | :--- | :--- |
| **Incident Commander (IC)** | Directs triage, coordinates communications, and enforces escalation timelines. | `#ops-incident-room` | Overall incident command |
| **Technical Lead** | Leads root cause investigation, log analysis, and formulates remediation/rollback plan. | `#dev-incident-bridge` | Technical remediation & code rollback |
| **Database Administrator (DBA)** | Monitors Atlas telemetry, manages point-in-time recovery, connection pool adjustments. | `#dba-escalation` | Atlas snapshot restore |
| **Release Lead** | Executes Vercel / Render deployment rollbacks and platform configuration checks. | Direct Emergency Line | Rollback trigger authority |
| **Operations / Business Lead** | Coordinates cafe staff communication, customer notifications, and offline POS protocols. | `#operations-lead` | Cafe-floor communication |

---

## 4. INCIDENT ESCALATION & WORKFLOW

```text
[Detection / Alert Trigger]
       │
       ▼
[Triage & Severity Classification (Within 10 min)]
       │
   ┌───┴───────────────────────────────┐
   ▼                                   ▼
[SEV-1 / SEV-2]                     [SEV-3 / SEV-4]
   │                                   │
   ├─► Open Incident Bridge            └─► Log Ticket in Backlog
   ├─► Notify Executive Stakeholders
   ├─► Evaluate Rollback Criteria
   │
   ▼
[Root Cause Containment]
   │
   ├─► Option A: Instant Rollback (Vercel / Render / Atlas PITR)
   └─► Option B: Hotfix Release (If root cause is isolated & validated)
   │
   ▼
[Post-Incident Review (PIR) within 48 Hours]
```

---

## 5. EMERGENCY ROLLBACK PROCEDURES

### 5.1 Vercel Frontend Instant Rollback
1. **Trigger:** Incident Commander or Release Lead.
2. **Action:**
   - Open Vercel Dashboard -> Project `zamorin-cafe-erp` -> **Deployments**.
   - Locate the previous designated Last Known-Good Deployment (`v1.0.0-GOLD-LOCKED` baseline).
   - Click `...` -> **Instant Rollback** (or run `vercel rollback <deployment-url>`).
3. **Verification:** Verify `https://zamorin-cafe-erp.vercel.app` serves the previous immutable deployment artifact within < 60 seconds.

### 5.2 Render Backend Instant Rollback
1. **Trigger:** Release Lead / Tech Lead.
2. **Action:**
   - Open Render Dashboard -> Web Service `zamorin-cafe-erp-backend` -> **Events / Deploys**.
   - Select the previous successful deployment commit.
   - Click **Rollback to this deploy**.
3. **Verification:** Inspect Render runtime logs and confirm `/api/v1/health` returns `200 OK`.

### 5.3 MongoDB Atlas Point-in-Time Restore (PITR)
1. **Trigger:** DBA / Incident Commander (Authorized under SEV-1 Data Corruption).
2. **Action:**
   - Open MongoDB Atlas -> Cluster -> **Backup** -> **Restore**.
   - Select Point-in-Time Recovery to timestamp immediately preceding the release deployment.
   - Restore to isolated staging cluster first to verify data integrity, or execute cluster rollback under emergency protocol.
3. **Target SLA:** RTO < 30 minutes, RPO < 5 minutes.

---

## 6. DATA LOSS & SECURITY INCIDENT ESCALATION

If an active security vulnerability or data exposure is detected:
1. **Immediate Quarantine:** Rotate `JWT_ACCESS_SECRET` and `MFA_ENCRYPTION_KEY` in Render environment to instantly invalidate all active JWT tokens and sessions.
2. **Network Isolation:** Temporarily restrict Atlas IP allowlist to authorized maintenance IPs.
3. **Audit Log Preservation:** Export Render and Atlas audit logs for forensic timeline reconstruction.
4. **Regulatory & Stakeholder Notification:** Comply with enterprise data breach notification guidelines within the designated statutory window.

---

## 7. POST-INCIDENT REVIEW (PIR) REQUIREMENT

For all SEV-1 and SEV-2 incidents, a formal Post-Incident Review must be conducted within 48 hours:
- Exact chronological incident timeline.
- Root Cause Analysis (5 Whys).
- Impact assessment (users affected, financial transactions, downtime duration).
- Preventative action items assigned with deadlines.
