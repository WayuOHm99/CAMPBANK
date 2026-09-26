# Admin setup E2E is flaky on local WebKit

Status: needs-triage

`tests/e2e/admin-camp-setup.spec.ts` intermittently fails on Windows (mostly `mobile-safari`) after an interaction whose state change does not appear:

- After clicking "รีเซ็ต PIN" in the Admin management disclosure, the "PIN ชั่วคราวใหม่ 4 หลัก" field never becomes visible (line ~304/308).
- After filling "เหตุผล" in "ปรับคะแนนโดย Admin", the submitted form still shows an empty reason (line ~405).

Verified pre-existing: with this round's changes stashed, commit `108db57` failed at the reset-PIN step in 3 of 3 local runs. The same commit passed in GitHub Actions (Linux, `--fail-on-flaky-tests`). No console errors or navigations appear in the trace.

Next step: reproduce with a headed WebKit run and check whether a live refresh re-renders `AdminManagement`/`AdjustmentPanel` between the click or fill and React's state update.
