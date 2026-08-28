# LOGIN STAGE 2 — DESIGN SYSTEM BINDING REPORT

## Programme Context

**Stage**: 2 — Frontend Placement, Terminal Auth UI & Design-System Integration  
**Branch**: `feature/login-integration`  
**Date**: 2026-08-28

---

## 1. Design System Architecture

Zamorin uses a **single CSS custom property design system** defined in:

| File | Role |
|------|------|
| `frontend/src/styles/tokens.css` | Canonical token definitions (`:root`) |
| `frontend/src/styles/zamorin.css` | Theme variants, layout, component styles |
| `frontend/src/styles/components.css` | Shared UI component classes |

The four themes are applied via `data-theme` attribute on the `<body>` element:

| Theme | `data-theme` value | Character |
|-------|-------------------|-----------|
| Paper | `"paper"` (default) | Warm white — no override needed |
| Pearl | `"pearl"` | Warm parchment |
| Midnight | `"midnight"` | Deep navy dark |
| Noir | `"noir"` | Neutral black dark |

---

## 2. Existing Terminal Auth Design Classes

The Operator Sign-In page (`cafeOperatorSignIn.js`) already uses Zamorin's shared class vocabulary:

| Class | Source | Used by |
|-------|--------|---------|
| `.login-screen` | `components.css` | Outer full-screen wrapper |
| `.login-card` | `components.css` | Centered card container |
| `.login-brand` | `components.css` | Zamorin logo + wordmark |
| `.login-mark` | `components.css` | Estate mark image |
| `.login-wordmark` | `components.css` | "Zamorin" display text |
| `.login-sub` | `components.css` | Scope subtitle |
| `.login-spinner` | `components.css` | Inline spinner |
| `.auth-input` | `components.css` | Text/password/select inputs |
| `.auth-error-banner` | `components.css` | Inline error display |
| `.btn`, `.btn-primary`, `.btn-block` | `components.css` | Action buttons |
| `.ops-key-btn` | inline in `cafeOperatorSignIn.js` | Legacy PIN key buttons |

---

## 3. Stage-2 New Classes — `.cafeops-*`

All Stage-2 new CSS is **scoped under the `.cafeops-` prefix**. Rules are appended to `zamorin.css` in a clearly delimited block (line 1593+). No existing rules were modified.

### 3.1 Class Catalogue

| Class | Purpose |
|-------|---------|
| `.cafeops-logo` | Logo with hover scale, shadow |
| `.cafeops-device-strip` | Café name + device name identity strip |
| `.cafeops-cafe-name` | Café name text inside strip |
| `.cafeops-device-name` | Device name (mono font) inside strip |
| `.cafeops-pin-dots` | 6-dot PIN progress row |
| `.cafeops-pin-dot` | Single PIN dot |
| `.cafeops-pin-dot--filled` | Filled (entered) PIN dot |
| `.cafeops-pin-dots--invalid` | Invalid animation trigger (shake) |
| `.cafeops-keypad` | 3×4 PIN keypad grid |
| `.cafeops-key` | Individual keypad button |
| `.cafeops-key--sub` | Sub-key (Clear, Backspace) smaller text |
| `.cafeops-key--backspace` | Backspace key icon sizing |
| `.cafeops-divider` | "or" divider with lines |
| `.cafeops-textlinks` | Grid of text-link buttons |
| `.cafeops-textlink` | Bronze text-link button |
| `.cafeops-textlink--muted` | Muted grey text-link variant |
| `.cafeops-connection` | Online/offline indicator row |
| `.cafeops-connection-dot` | Status dot |
| `.cafeops-connection--offline` | Offline state modifier |
| `.cafeops-status-icon` | Round status icon |
| `.cafeops-status-icon--danger/warning/success/muted` | Tone modifiers |
| `.cafeops-status-title` | Status screen heading |
| `.cafeops-status-message` | Status screen body |
| `.cafeops-status-actions` | Status action buttons grid |
| `.cafeops-support-ref` | Support reference code display |
| `.cafeops-master-badge` | Bronze gradient master role pill |
| `.cafeops-mfa-hint` | MFA step instructional text |
| `.cafeops-diag-list` | Diagnostic rows container |
| `.cafeops-diag-row` | Single diagnostic row (label + value) |
| `.cafeops-diag-value--mono` | Mono-font diagnostic value |
| `.cafeops-pill` | Status pill (success/muted/danger/warning) |
| `.cafeops-context-bar` | Sticky post-auth context bar |
| `.cafeops-context-operator` | Operator pill button in context bar |
| `.cafeops-context-avatar` | Avatar initials circle |
| `.cafeops-menu` | Session/operator dropdown menu |
| `.cafeops-menu-item` | Menu item button |
| `.cafeops-menu-item--danger` | Danger-tone menu item |
| `.cafeops-menu-divider` | Menu section divider |
| `.cafeops-textarea` | Handover notes textarea |
| `.cafeops-kiosk-clock` | Large mono clock display |

### 3.2 CSS Token Usage

All Stage-2 CSS uses **only tokens already defined** in Zamorin's design system. No raw colour literals are introduced. Selected token usage:

| Token | Used for |
|-------|---------|
| `--bronze-500`, `--bronze-600`, `--bronze-700` | Primary accent: PIN dots filled, text links, badges |
| `--bronze-100`, `--bronze-050` | Hover backgrounds |
| `--ink-900` | High-contrast text |
| `--muted`, `--muted-2` | Secondary and tertiary text |
| `--surface`, `--surface-sunken`, `--surface-raised`, `--surface-hover` | Background layers |
| `--line`, `--line-strong` | Borders |
| `--success`, `--success-soft` | Device registered, online indicator |
| `--danger`, `--danger-soft` | Errors, offline indicator |
| `--warning`, `--warning-soft` | Session expired, rate-limit screens |
| `--font-display` | Fraunces — headings, keypad digits |
| `--font-mono` | IBM Plex Mono — device IDs, time, codes |
| `--font-ui` | Inter — labels, body |
| `--radius-input` | New alias → `var(--radius-control)` |
| `--ease` | All transitions |
| `--shadow-md` | Card and menu shadows |

### 3.3 One New Alias Added

```css
:root { --radius-input: var(--radius-control); }
```

The Claude CSS used `--radius-input` which did not exist in Zamorin's tokens. This alias maps it to the equivalent Zamorin token (`--radius-control: 10px`). It is backward-compatible — no existing CSS used `--radius-input`.

---

## 4. Theme Support — All Four Themes

Theme overrides are appended in the same block in `zamorin.css`:

| Theme | Override approach |
|-------|------------------|
| **Paper** (default) | No override — Zamorin's `:root` values are correct |
| **Pearl** | Key background and hover colours overridden for warm parchment |
| **Midnight** | Full PIN pad, text links, menu colours overridden for dark navy |
| **Noir** | Full PIN pad, text links, menu colours overridden for neutral black |

Dark themes automatically inherit inverted ink, surface, and bronze tokens already defined in `zamorin.css` — no manual colour literals needed for most elements.

---

## 5. Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .cafeops-logo, .cafeops-key, .cafeops-pin-dot,
  .cafeops-menu, .cafeops-toast, .cafeops-qr-ring-progress {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
```

All PIN animations, hover transforms, menu entrance animations, and logo hover scale are suppressed for users who have requested reduced motion at the OS level.

---

## 6. Accessibility Notes

| Feature | Implementation |
|---------|---------------|
| PIN keypad `role="group"` | Groups the keypad for AT navigation |
| MFA code row `role="group"` with `aria-label` | Identifies the 6-digit group |
| MFA digit `aria-label="Digit N of 6"` | Each cell is individually labelled |
| Paste handler on first MFA cell | `autocomplete="one-time-code"` + paste event |
| Password toggle `aria-pressed` | Reflects show/hide state |
| Error banners `role="alert" aria-live="assertive"` | Announced immediately |
| Connection indicator `aria-live="polite"` | Online/offline change announced |
| Focus management on MFA step | First digit focused automatically |
| Escape key cancel | Returns to Operator Sign-In, clears sensitive state |
| `focus-visible` outlines | 2px bronze on all interactive elements |

---

## 7. No Changes to Existing CSS

The following files were **not modified** in Stage 2:

- `frontend/src/styles/tokens.css` — unchanged
- `frontend/src/styles/components.css` — unchanged
- `frontend/src/styles/layout.css` — unchanged

Only `zamorin.css` was extended (append-only).
