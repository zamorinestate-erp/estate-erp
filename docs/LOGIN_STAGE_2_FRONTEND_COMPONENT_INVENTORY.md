# Zamorin Café ERP — Login Integration Stage 2
# Frontend Component Inventory

## 1. Overview
Stage 2 implements the frontend placement of the terminal authentication screens into the Zamorin client runtime. All components strictly adhere to the Zamorin design system (`zamorin.css`), using scoped `.cafeops-*` selectors, maintaining complete visual and behavioral isolation from the personal login screen (`frontend/src/js/pages/login.js`).

---

## 2. Component Register

| Component | File Path | Scope / Class Prefix | Purpose | Interactive Controls |
|---|---|---|---|---|
| **Master Sign-In** | `frontend/src/js/pages/cafeMasterSignIn.js` | `.cafeops-master-*`, `.auth-card` | Master account credential entry and step-up MFA challenge entry | Identifier input, Password input, Access Reason input, MFA OTP input, Submit button, Back button |
| **Device Enrollment** | `frontend/src/js/pages/cafeDeviceEnroll.js` | `.cafeops-enroll-*`, `.auth-card` | 8-character Crockford Base32 enrollment code entry for physical terminal binding | Enrollment code input, Device display name input, Submit button, Back to kiosk button |
| **Terminal Welcome** | `frontend/src/js/pages/cafeTerminalWelcome.js` | `.cafeops-welcome-*`, `.auth-card` | Pre-session landing hub for cafe terminal operations | Operator PIN Sign-In CTA, Master Sign-In CTA, Enroll Terminal CTA |
| **Operator Sign-In** | `frontend/src/js/pages/cafeOperatorSignIn.js` | `.cafeops-pinpad-*`, `.auth-card` | 6-digit masked PIN pad entry for cafe operators | PIN keypad digits (0-9), Backspace, Clear, Submit |
| **Terminal Context Bar** | `frontend/src/js/components/brandHeader.js` | `.cafeops-header-*` | Sticky top context bar displaying active cafe, device ID, and server-synchronized clock | Shift status indicator, device diagnostics badge |

---

## 3. Visual Shell Reusability

All Stage 2 screens reuse the canonical `.auth-page`, `.auth-card`, `.auth-header`, `.auth-title`, and `.auth-subtitle` classes without re-declaring them:
- **Card Styling**: Consistent border radii, subtle bronze glow, elevation tokens (`var(--surface)`, `var(--border-subtle)`).
- **Typography**: Inherited from Outfit / Inter design tokens.
- **Micro-Animations**: Shimmer loaders, pulse indicators on active buttons, and smooth transition keyframes.
