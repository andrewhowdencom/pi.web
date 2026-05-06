# pi.web Agent Instructions

## Design Principles

### Mobile-First UI/UX

All web UI components must be designed **mobile-first**.

- Default styles and layouts target narrow viewports (≤480px) first.
- Progressive enhancement is used for larger screens via `@media (min-width: …)` queries — never the other way around.
- Every interactive element must have a touch target of at least **44×44px**.
- Layout must account for virtual keyboards and dynamic viewport changes by using `100dvh` and respecting `env(safe-area-inset-bottom)`.
- Content should remain readable and reachable without horizontal scrolling on devices as small as 375px wide.
