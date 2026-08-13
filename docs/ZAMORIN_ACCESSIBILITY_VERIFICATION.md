# ZAMORIN CAFE ERP — ACCESSIBILITY VERIFICATION (SECTION 141.9)

> **Status**: VERIFIED — TARGETING WCAG 2.2 LEVEL AA

## Accessibility Features & Controls
- **Keyboard Navigation**: Universal `Ctrl/Cmd+K` global search shortcut, logical tab index order across all forms and data tables.
- **Focus Indicators**: High-contrast outline focus ring on active interactive elements (`:focus-visible`).
- **Screen Reader Support**: Semantic HTML5 tags (`<main>`, `<nav>`, `<header>`, `<table>`, `<button>`), `aria-label` attributes on icon-only actions.
- **Contrast & Typography**: Curated HSL color palette meeting 4.5:1 contrast ratio for normal text and 3:1 for large text.
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` for smooth transition suppression.
