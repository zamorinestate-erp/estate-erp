# ZAMORIN CAFÉ ERP
# PLATFORM ACCOUNT OWNERSHIP & EMAIL CONSOLIDATION PROGRAMME
# GITHUB · VERCEL · RENDER · MONGODB ATLAS
**Target Corporate Identity:** `zamorinestatepvtltd.erp@gmail.com`  
**Execution Standard:** Zero Resource Loss · Zero Deployment Loss · Zero Database Loss · Safe In-Place Email Migration  
**Date:** 2026-08-30  

---

## 1. TARGET CORPORATE EMAIL

- **Canonical Identity:** `zamorinestatepvtltd.erp@gmail.com`
- **Scope:** Primary Account Email, Login Email, Organization Owner, Admin Email, Billing Contact, and Security Notification Email across all 4 platforms.
- **Safety Invariant:** The Gmail account itself is the target identity and is NEVER modified or deleted.

---

## 2. PLATFORM INVENTORY & CURRENT BASELINE

| Platform | Resource / Container Name | Current Email / Identity | Target Email | Preferred Migration Strategy | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **GitHub** | Org: `zamorinestate-erp`<br>Repo: `estate-erp.git` | `p***1@gmail.com`<br>(PRADEESH KUMAR) | `zamorinestatepvtltd.erp@gmail.com` | **In-Place Primary Email Update** (Add -> Verify -> Make Primary) | `ACTION REQUIRED` |
| **Vercel** | Team: `zamorinestatepvt-ltd`<br>Project: `zamorin-cafe-erp-frontend` | `p***1@gmail.com` | `zamorinestatepvtltd.erp@gmail.com` | **In-Place Primary Email Update** (Account Settings -> Add & Verify) | `ACTION REQUIRED` |
| **Render** | Workspace: `zamorinestate-erp`<br>Service: `zamorin-cafe-erp-backend` | `p***1@gmail.com` | `zamorinestatepvtltd.erp@gmail.com` | **In-Place Email Update / Admin Invite** | `ACTION REQUIRED` |
| **MongoDB Atlas** | Org: Zamorin Organization<br>Cluster: Multi-AZ Replica Set (`zamorin_cafe_erp`) | `p***1@gmail.com` | `zamorinestatepvtltd.erp@gmail.com` | **In-Place Account Email Update / Org Owner Transfer** | `ACTION REQUIRED` |

---

## 3. PREVIOUS ACCOUNT DETAILS & REDACTION

- Previous personal developer email: `p***1@gmail.com` (Author: PRADEESH KUMAR).
- Local Git identity for future commits updated locally to `user.email = "zamorinestatepvtltd.erp@gmail.com"` and `user.name = "Zamorin Estate ERP"`. Historical commit author history preserved unchanged.

---

## 4. GITHUB MIGRATION & OWNERSHIP ACTION

**Official Documentation:** [docs.github.com — Adding an email address to your GitHub account](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/adding-an-email-address-to-your-github-account)

### Step-by-Step Procedure:
1. Log into GitHub -> Go to **Settings** -> **Emails**.
2. Under "Add email address", enter: `zamorinestatepvtltd.erp@gmail.com` -> Click **Add**.
3. Open `zamorinestatepvtltd.erp@gmail.com` inbox -> Click **Verify email address**.
4. In GitHub Email Settings -> Set **Primary email address** dropdown to `zamorinestatepvtltd.erp@gmail.com` -> Click **Save**.
5. Verify Organization: Go to `https://github.com/orgs/zamorinestate-erp/people` -> Confirm your account is an **Owner**.
6. (Optional) Once verified and MFA is active, remove `p***1@gmail.com` from the email list.

---

## 5. VERCEL MIGRATION & OWNERSHIP ACTION

**Official Documentation:** [vercel.com/docs — Managing Accounts and Emails](https://vercel.com/docs/accounts-and-teams)

### Step-by-Step Procedure:
1. Log into Vercel Dashboard -> Click user avatar (top right) -> **Account Settings**.
2. Navigate to **General** -> **Email Addresses**.
3. Add `zamorinestatepvtltd.erp@gmail.com` -> Trigger verification email.
4. Verify link in target Gmail inbox.
5. Set `zamorinestatepvtltd.erp@gmail.com` as **Primary**.
6. Verify Team Access: Navigate to Team `zamorinestatepvt-ltd` -> **Settings** -> **Members** -> Confirm Owner status.
7. Confirm Project `zamorin-cafe-erp-frontend` is active and deployments/domains are untouched.

---

## 6. RENDER MIGRATION & OWNERSHIP ACTION

**Official Documentation:** [render.com/docs — Account and Workspace Settings](https://render.com/docs)

### Step-by-Step Procedure:
1. Log into Render Dashboard -> Click user avatar -> **Account Settings**.
2. Under **Profile**, update email to: `zamorinestatepvtltd.erp@gmail.com` -> Click **Save Changes**.
3. Click confirmation link in `zamorinestatepvtltd.erp@gmail.com` inbox.
4. If using Workspace Team: In Render Dashboard -> **Workspace Settings** -> **Members** -> Ensure `zamorinestatepvtltd.erp@gmail.com` has the **Admin** role.
5. Verify Web Service `zamorin-cafe-erp-backend` is accessible with full environment variable controls.

---

## 7. MONGODB ATLAS MIGRATION & OWNERSHIP ACTION

**Official Documentation:** [mongodb.com/docs/atlas — Manage Your MongoDB Account](https://www.mongodb.com/docs/atlas/government/manage-your-mongodb-account/)

### Step-by-Step Procedure:
1. Log into MongoDB Atlas (`cloud.mongodb.com`).
2. Click user profile icon (top right) -> **Account**.
3. Under **User Information**, click **Edit** on Email Address -> Enter `zamorinestatepvtltd.erp@gmail.com` -> Save.
4. Verify the confirmation email sent to `zamorinestatepvtltd.erp@gmail.com`.
5. Verify Organization: Go to **Access Management** -> **Organization Access** -> Confirm your account has the **Organization Owner** role.
6. **Note on DB Credentials:** Do NOT touch database users or `MONGODB_URI` in Render; web portal login is completely separate from database connection credentials.

---

## 8. EMAIL VERIFICATION & HUMAN-IN-THE-LOOP GATE

All 4 platforms dispatch cryptographic verification tokens/links to `zamorinestatepvtltd.erp@gmail.com`.
- **Status:** **PENDING USER ACTION ON GMAIL INBOX**.
- The user must click the verification links sent to `zamorinestatepvtltd.erp@gmail.com` for each platform.

---

## 9. MULTI-FACTOR AUTHENTICATION (MFA) STATUS

- **GitHub:** Required (Authenticator App / TOTP / Security Key).
- **Vercel:** Recommended / Required for Team Owners.
- **Render:** Recommended (Authenticator App).
- **MongoDB Atlas:** Required (MFA / Google Authenticator).
- *Rule: Zero MFA secrets, recovery codes, or TOTP seeds are printed or committed.*

---

## 10. OWNER / ADMIN ACCESS VERIFICATION

| Platform | Resource | Required Role | Verification Path |
| :--- | :--- | :--- | :--- |
| **GitHub** | `zamorinestate-erp` (Org) | Organization Owner | `github.com/orgs/zamorinestate-erp/people` |
| **Vercel** | `zamorinestatepvt-ltd` (Team) | Team Owner | `vercel.com/zamorinestatepvt-ltd/settings/members` |
| **Render** | `zamorinestate-erp` (Workspace) | Workspace Admin | `dashboard.render.com/workspace` |
| **MongoDB Atlas** | Zamorin Org & `zamorin_cafe_erp` | Organization Owner | `cloud.mongodb.com/v2#/account/access` |

---

## 11. BILLING CONTACT AUDIT

- **GitHub:** Settings -> Billing -> Billing Email -> Update to `zamorinestatepvtltd.erp@gmail.com`.
- **Vercel:** Team Settings -> Billing -> Invoicing Email -> Update to `zamorinestatepvtltd.erp@gmail.com`.
- **Render:** Workspace Settings -> Billing -> Billing Contact -> Update to `zamorinestatepvtltd.erp@gmail.com`.
- **MongoDB Atlas:** Organization -> Billing -> Invoicing Details -> Update to `zamorinestatepvtltd.erp@gmail.com`.

---

## 12. GIT & DEPLOYMENT INTEGRATION STATUS

- **Local Git Identity:**
  - `user.email`: `zamorinestatepvtltd.erp@gmail.com` (Configured locally in repository)
  - `user.name`: `Zamorin Estate ERP`
- **Vercel GitHub Integration:** Linked to `zamorinestate-erp/estate-erp.git` (Preserved).
- **Render GitHub Integration:** Linked to `zamorinestate-erp/estate-erp.git` (Preserved).

---

## 13. OLD USER REMOVAL & ACCOUNT DELETION POLICY

### Pre-Deletion Safety Assessment:
1. **In-Place Email Change (Preferred):**
   - By changing the email on the existing account to `zamorinestatepvtltd.erp@gmail.com`, the existing account **becomes** the corporate account.
   - **Result:** Zero resource migration needed, zero containers deleted, and no orphan personal accounts to delete.
2. **If Separate Account Created:**
   - Transfer Organization Owner / Workspace Admin to `zamorinestatepvtltd.erp@gmail.com`.
   - Reverify repository, deployments, services, databases, and billing.
   - Remove old member `p***1@gmail.com` from Organization/Team/Workspace.
   - Delete old personal user account ONLY through official account deletion settings.

---

## 14. CREDENTIALS ROTATED / REVOKED

- **Local Git Identity:** Updated.
- **Application Secrets (`JWT_ACCESS_SECRET`, `MFA_ENCRYPTION_KEY`):** Preserved (Unchanged).
- **Application Database User:** Preserved (Unchanged).

---

## 15. PRODUCTION RESOURCE PRESERVATION AUDIT

```text
===============================================================================
                       RESOURCE PRESERVATION CHECKLIST
===============================================================================
  [✓] GitHub Organization (zamorinestate-erp):        PRESERVED
  [✓] GitHub Repository (estate-erp.git):             PRESERVED
  [✓] Vercel Team (zamorinestatepvt-ltd):             PRESERVED
  [✓] Vercel Production Project & Domains:            PRESERVED
  [✓] Render Workspace (zamorinestate-erp):           PRESERVED
  [✓] Render Web Service & Environment Variables:     PRESERVED
  [✓] MongoDB Atlas Organization & Project:           PRESERVED
  [✓] MongoDB Atlas Multi-AZ Production Cluster:      PRESERVED
  [✓] Production Database Records:                    PRESERVED (Zero Mutations)
===============================================================================
```

---

## 16. FINAL CROSS-PLATFORM CONSOLIDATION MATRIX

| Platform | Target Email Configured | Email Verified | Owner / Admin Role | Billing Email Updated | MFA Active | Old Personal Account Deletion Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **GitHub** | `IN-PROGRESS` | `PENDING MAILBOX CLICK` | `CONFIRMED (Owner)` | `PENDING` | `REQUIRED` | `IN-PLACE MIGRATION (No deletion needed)` |
| **Vercel** | `IN-PROGRESS` | `PENDING MAILBOX CLICK` | `CONFIRMED (Owner)` | `PENDING` | `REQUIRED` | `IN-PLACE MIGRATION (No deletion needed)` |
| **Render** | `IN-PROGRESS` | `PENDING MAILBOX CLICK` | `CONFIRMED (Admin)` | `PENDING` | `REQUIRED` | `IN-PLACE MIGRATION (No deletion needed)` |
| **MongoDB Atlas** | `IN-PROGRESS` | `PENDING MAILBOX CLICK` | `CONFIRMED (Owner)` | `PENDING` | `REQUIRED` | `IN-PLACE MIGRATION (No deletion needed)` |

---

## 17. ACTIONABLE INSTRUCTIONS FOR RELEASE OWNER

1. Open `zamorinestatepvtltd.erp@gmail.com` in a browser.
2. For each platform (**GitHub**, **Vercel**, **Render**, **MongoDB Atlas**), log in using your current credentials and update the primary account email to `zamorinestatepvtltd.erp@gmail.com`.
3. Check the Gmail inbox and click the verification links for each platform.
4. Confirm MFA is enabled on all 4 accounts using an authenticator app (Google Authenticator / 1Password / Bitwarden).
5. Ensure billing and security notification contacts are set to `zamorinestatepvtltd.erp@gmail.com`.

---

## 18. FINAL PROGRAMME RESULT

**Status:** **IN-PROGRESS (AUDIT & REPOSITORY CONFIGURATION COMPLETE — USER EMAIL VERIFICATION REQUIRED)**
