# Admin setup E2E is flaky on local WebKit

Status: resolved

`tests/e2e/admin-camp-setup.spec.ts` intermittently failed locally and in CI (run 36259733117, `--fail-on-flaky-tests`). Both causes were in the test, not the app.

## Answer

- **Reset PIN form never appeared (line ~308).** The Admin disclosure animates open; the trace showed "element is not stable" and WebKit's tap landed while the button was still moving. The test now waits for the disclosure's animations to finish (`settleAnimations`) before clicking.
- **Adjustment reason arrived empty (line ~405/419).** The reason `<textarea>` sits inside its `<label>`, so its accessible name includes the typed value. `getByLabel("เหตุผล", { exact: true })` stopped matching once text existed, and a re-resolution could send keystrokes to the previously focused amount field (the failure snapshot showed amount `"500E2"`). The test now targets `#adjustment-amount` / `#adjustment-reason`, asserts both values, and brings the Admin page to the front after Staff-page steps.

Verified: 10 consecutive isolated runs (6 Chromium, 4 WebKit) passed, then the full E2E suite passed 40/40 with `--fail-on-flaky-tests`.
