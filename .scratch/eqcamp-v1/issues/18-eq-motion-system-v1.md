# 18 — EQ Motion System V1

**What to build:** add a restrained, accessible motion layer that makes the private EQ-BANK field workflow feel polished while preserving immediate Score feedback, connection safety, and performance on low-powered mobile devices.

**Blocked by:** 08 — Realtime and connection safety; 17 — Consistent semantic Score action buttons.

**Status:** ready-for-agent

## Product intent

- Motion explains continuity, hierarchy, loading, success, warning, and change; it is not continuous decoration.
- Preserve the accepted calm EQ-blue visual system and the existing 160ms/240ms motion tokens.
- Preserve every Camp, Group, Score, Staff, Admin, Quick Undo, Leaderboard, and connection workflow. Animation must never delay, reorder, retry, queue, or conceal an authoritative Score result.
- Treat unsupported motion APIs as progressive enhancement: the workflow must remain fully usable without animation.

## Implementation scope

### Shared motion foundation

- Centralize duration, easing, distance, opacity, and reduced-motion rules in the design system.
- Prefer CSS transitions/keyframes using `transform` and `opacity`; do not animate layout-affecting properties without a measured reason.
- Keep keyboard focus visible throughout every transition and retain 44px minimum interactive targets.
- Remove positional movement and non-essential animation when `prefers-reduced-motion: reduce` is active.

### Component feedback

- Buttons: consistent hover, press, pending, disabled, success, and focus feedback without changing the action timing.
- Disclosures and Dropdowns: animate only the panel that was opened; contain long content and never stretch a neighboring column.
- Dialogs: use a contained bottom-sheet-style entrance on small screens and a restrained fade/scale on wider screens; return focus and support Escape.
- Toasts and notices: add short enter/exit feedback. Quick Undo may show its remaining opportunity visually, but the existing server-authoritative correction rules and text remain primary.
- Loading: use stable-size skeleton/reveal states that avoid content jumping and never imitate data that has not loaded.

### Staff scoring

- Keep the Score value authoritative and immediately readable; do not use a long odometer/count-up animation.
- After a successful local Score action, apply one brief EQ-blue confirmation highlight to the affected Group card and retain the existing supported-device haptic feedback.
- For a Realtime Score from another Staff session, use a distinct one-shot update cue without continuous flashing.
- Pending, offline, degraded, Integrity Failure, and Closed Camp states remain explicit in text and must not be masked by animation.

### Navigation and content changes

- Evaluate the installed Next.js 16.3.2 App Router `<ViewTransition>` support for short crossfades, loading handoffs, and explicit forward/back navigation.
- Keep the application header visually anchored while page content transitions.
- Keep transitions short and prevent the View Transition overlay from blocking rapid field interaction.
- Treat React View Transition support as progressive enhancement and verify Safari behavior before broad use.

### Leaderboard and Closed Camp result

- Animate a Group moving between Leaderboard positions only when identity and ordering remain unambiguous.
- Show the final Score immediately; movement must not imply an intermediate or fabricated Score.
- A Closed Camp winner may receive one restrained celebratory reveal. No looping confetti, sound, particles, glow, or motion that competes with the result.

## Technology policy

- Start with the existing CSS/Tailwind stack; no new runtime dependency is required for the first pass.
- Consider `motion` only for Leaderboard/layout-presence cases that cannot be implemented clearly with CSS or View Transitions. Verify Next.js 16.3.2, React 19.2.8, bundle, and low-powered-device behavior before installation.
- Consider accessible primitives such as Radix only when replacing complex custom Dialog/Popover behavior. Verify compatibility and migration scope before installation.
- Add Playwright visual comparisons in a deterministic environment for critical motion end states; functional assertions remain required.
- External monitoring such as Sentry is a separate privacy, credential, cost, and operational decision and requires owner approval before integration.

## Explicit non-goals

- No Three.js background, large 3D scene, continuous particle system, decorative parallax, heavy blur/glass layer, autoplay sound, site-wide confetti, or AI API for visual effects.
- No Lottie/Rive animation without owner-approved Brand artwork and a concrete workflow purpose.
- No offline Score cache or transaction queue; `public/sw.js` remains network-only for Score writes.
- No Stitch activity until the owner explicitly resumes it.

## Acceptance criteria

- [ ] Motion tokens and component usage are documented in `docs/design-system.md`.
- [ ] Staff Score actions, Group card feedback, Dialogs, Dropdowns/disclosures, Toast/Quick Undo, loading states, navigation, and Leaderboard have one consistent motion language.
- [ ] The selected panel remains independent and long content remains contained at 320, 390, 834, and 1440 CSS pixels.
- [ ] Reduced-motion users receive no positional movement or continuous animation and lose no state information.
- [ ] Animation never blocks a second valid interaction, changes Score sequencing, hides offline/integrity states, or queues a write.
- [ ] Keyboard focus, Escape, focus return, screen-reader names, and 44px targets remain correct.
- [ ] Mobile Safari, Android Chromium, tablet WebKit, and desktop Chromium receive usable fallbacks where an API is unsupported.
- [ ] Visual comparisons cover stable end states without asserting timing-sensitive intermediate frames.
- [ ] Formatting, lint, typecheck, unit, authenticated integration, responsive E2E, concurrency, and production build checks pass.
- [ ] A physical-device Pilot verifies smoothness on at least one lower-powered Android device and one iPhone/iPad before release.

## Verified references

- Installed framework guide: `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`
- React View Transition status and reduced-motion guidance: <https://react.dev/reference/react/ViewTransition>
- Animation performance guidance: <https://motion.dev/docs/performance>
- Accessible primitive animation guidance: <https://www.radix-ui.com/primitives/docs/guides/animation>
- Playwright visual comparisons: <https://playwright.dev/docs/test-snapshots>

## Comments

- 2026-08-24: Owner requested this plan be saved for a later work session. No implementation or dependency installation started. Next.js and Supabase local servers remain stopped.
