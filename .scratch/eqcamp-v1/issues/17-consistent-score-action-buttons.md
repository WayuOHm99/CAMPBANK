# 17 — Consistent semantic Score action buttons

**What to build:** every Staff-facing Score card and Admin representation of its Score Buttons uses one accessible visual language that distinguishes Add from Subtract without relying on color alone.

**Blocked by:** 06 — Atomic Score actions.

**Status:** complete — EQ-blue Score actions are shared across Staff and Admin, with automated and responsive verification complete

- [x] Add uses the exact EQCAMP deep-blue fill while Subtract uses the soft sky-blue surface plus exact sky-blue border/glyph without creating another palette family.
- [x] Every action shows explicit Thai Add/Subtract text, a plus/minus glyph, and a signed tabular value.
- [x] Staff cards, Admin previews, Admin direction controls, amount sign cues, and confirmation dialogs share the same semantic pair.
- [x] Touch targets remain at least 44px, focus remains visible, pending/disabled states remain explicit, and reduced motion is respected.
- [x] Unit, E2E, and responsive visual checks prove both directions remain clear on mobile, tablet, and desktop.
