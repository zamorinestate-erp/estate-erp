# Zamorin Café ERP — Login Integration Stage 2
# Design System Adaptation & CSS Scoping

## 1. Principles
1. **Zero Contamination**: The global design tokens in `tokens.css` and the personal login styling in `components.css` remain untouched.
2. **Strict Namespacing**: All new styles added for the terminal authentication screens are strictly prefixed with `.cafeops-*` and appended to `frontend/src/styles/zamorin.css`.
3. **No ad-hoc styles**: All colors, radii, shadows, and spacing derive from existing CSS custom properties:
   - Surface: `var(--surface)`, `var(--surface-raised)`
   - Accents: `var(--accent-bronze)`, `var(--accent-gold)`
   - Borders: `var(--border-subtle)`, `var(--border-strong)`
   - Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`

---

## 2. Scoped Rules Summary

- `.cafeops-master-form`: Flexbox column layout with 16px gap, centered inside `.auth-card`.
- `.cafeops-pinpad`: 3x4 CSS Grid with 64px minimum touch targets and active scale transforms.
- `.cafeops-enroll-input`: Monospace, wide letter-spacing (`0.2em`) for high readability of 8-character codes.
- `.cafeops-mfa-badge`: Subtle bronze tag indicating required step-up verification.
