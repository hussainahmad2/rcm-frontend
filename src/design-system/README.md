# Design system — CSS convention

Velora Revenue OS keeps global foundations separate from page- and component-scoped styles.

## Layers

1. **`src/styles/tokens.css`** — Design tokens only  
   Color HSL channels, font stacks (DM Sans / Bricolage Grotesque / Space Mono), radii, shadows, and Tailwind `@theme` bridges. No layout rules.

2. **`src/styles/base.css`** — Global resets + shared marketing utilities  
   Box model, body typography, selection, and utilities reused across marketing pages (`.container`, `.eyebrow`, `.button-primary`).

3. **`src/styles/index.css`** — Entry barrel  
   Fonts, Tailwind, then `@import` of tokens + base. Loaded once from `main.tsx`.

4. **Page CSS (co-located)** — `src/pages/<name>/<Name>Page.css`  
   Imported at the top of the matching page component. Owns all visual classes for that route (e.g. `.site-shell`, `.hero`, `.axiom-workspace`, `.ax-*`).

5. **Component CSS (co-located)** — `src/components/<name>/<Name>.css`  
   Imported inside the component (e.g. `Brand.tsx` → `Brand.css`).

## Rules

- Prefer co-location: if a class is only used by one page/component, put it next to that file.
- Keep existing class names when refactoring so markup and tests stay stable.
- Do not put page-specific rules in `tokens.css` or `base.css`.
- App shell stays slim: `App.tsx` is routing only; `App.css` stays empty or app-wide chrome only.
