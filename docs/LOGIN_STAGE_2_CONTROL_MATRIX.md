# Zamorin Café ERP — Login Integration Stage 2
# Control Matrix & Postcondition Register

## 1. Summary of Stage-2 Interactive Controls

Total interactive elements introduced across Stage-2 terminal screens: **18 controls** (all verified by `audit_login_stage2_frontend.mjs` and zero-dead-control audit suites).

---

## 2. Interactive Control Mapping

| Screen | Control ID / Selector | Event Type | Intentional State | Postcondition Feedback |
|---|---|---|---|---|
| **Master Sign-In** | `#masterIdentifier` | `input`, `blur` | Required | Validation error banner if empty |
| **Master Sign-In** | `#masterPassword` | `input`, `keydown` | Required | Masked text, Enter triggers submission |
| **Master Sign-In** | `#masterAccessReason` | `input` | Optional | Trimmed string passed to payload |
| **Master Sign-In** | `#masterSignInSubmit` | `click` | Active | Loading spinner displayed, button disabled |
| **Master Sign-In** | `#masterSignInBack` | `click` | Active | Navigates to `#cafe-operator-signin` |
| **Master Sign-In (MFA)**| `#masterMfaCode` | `input`, `keydown` | Required (6 digits) | Auto-focus, numeric filtering |
| **Master Sign-In (MFA)**| `#masterMfaVerify` | `click` | Active | Loading spinner displayed, button disabled |
| **Device Enroll** | `#enrollmentCode` | `input` | Required (8 chars) | Crockford Base32 auto-capitalization |
| **Device Enroll** | `#deviceDisplayName` | `input` | Required | Auto-fill device model/hostname |
| **Device Enroll** | `#deviceEnrollSubmit` | `click` | Active | Submits enrollment token, updates state |
| **Device Enroll** | `#deviceEnrollBack` | `click` | Active | Returns to `#cafe-operator-signin` |
| **Terminal Welcome**| `#welcomeOperatorBtn` | `click` | Active | Navigates to `#cafe-operator-signin` |
| **Terminal Welcome**| `#welcomeMasterBtn` | `click` | Active | Navigates to `#cafe-master-signin` |
| **Terminal Welcome**| `#welcomeEnrollBtn` | `click` | Active | Navigates to `#cafe-device-enroll` |
| **Operator Sign-In** | `.pinpad-digit` (0-9) | `click`, `keydown` | Active | Appends digit, updates dot mask |
| **Operator Sign-In** | `.pinpad-backspace` | `click`, `keydown` | Active | Pops last digit |
| **Operator Sign-In** | `.pinpad-clear` | `click` | Active | Clears all 6 digits |
| **Operator Sign-In** | `#operatorSignInSubmit`| `click` | Active | Dispatches PIN authentication |
