# Physical-device Pilot rehearsal

Status: **CLOSED BY OWNER — owner-reported pass**. On 2026-09-27, the owner confirmed in this Codex conversation that testing was completed on a lower-powered physical Android device, a physical iPhone/iPad, and at least five Safari sessions, with acceptable results. The owner then explicitly directed closure with the available record. Device models, OS/browser versions, session-by-session observations, tested commit, test date, and evidence locations were not supplied. This records the owner's attestation and closure decision; it is not an independently observed device test or proof that the current commit was tested. Automated WebKit/Chromium runs are browser emulation, not evidence of physical-device smoothness.

## Prepare

Use a disposable Local Camp and the verified local setup in [README](../README.md). Start Docker Desktop, `npm run db:start`, then `npm run dev`. Open the Network URL printed by Next.js from devices on the same Wi-Fi. The local Supabase hostname is adapted to that Network host; both ports 3000 and 54321 must be reachable. Do not reset the database while testing sessions are open. Use the seeded Demo only for local rehearsal; its temporary Admin PIN must be changed at first login.

Run `bash scripts/pilot-rehearsal.sh` from Git Bash, WSL, macOS or Linux to record observations. The script saves non-secret answers in the ignored `.scratch/eqcamp-v1/.env.pilot-rehearsal`; it never marks a ticket complete. Copy the reviewed outcome and evidence references below. Do not record PINs, session tokens or private join links.

## Safari: at least five actual devices or sessions

Record each session separately, including model, OS/browser version, Staff identity and evidence reference. If sessions share a physical device, identify that explicitly.

1. Open a Staff member's individual invitation link from the Admin "ลิงก์" section (local Demo Staff A: `/join/TEST-30000000-0000-4000-8000-000000000001`), and verify the Camp, activity/round, Budget and connection status are readable.
2. Award +500 to a Group. Confirm exactly one History entry, Group +500 and Budget -500. A second Staff session must receive the authoritative total and a distinct update cue.
3. Submit a second valid action while feedback is visible. Confirm each action appears exactly once. Undo the latest action within 15 seconds and confirm a linked opposite entry with the original retained. After 15 seconds, confirm Undo is unavailable/rejected.
4. Switch Group layouts, scroll the rail, rename a Group and inspect History. Only the selected editor opens; the page must not scroll horizontally outside the rail.
5. Disconnect a device. Verify explicit offline text, disabled scoring and no queued action after reconnect. Verify fresh totals before scoring resumes.
6. In Admin, create/configure a disposable Camp, activate it, inspect Budget, reveal/hide Leaderboard and make an Adjustment with a reason. Verify totals and History from Staff and Admin.
7. Close that disposable Camp while another session remains open. Confirm scoring is disabled, final totals remain readable, and the Camp cannot be reopened. Do this last.

## Physical motion: Android and Apple

Use at least one lower-powered Android device and one iPhone/iPad. Record model and browser version. Repeat with default motion and the OS reduced-motion setting enabled.

- Navigate Staff, History and Leaderboard; verify readable immediate results, usable header links and responsive input during transitions.
- Scroll the Group rail, expand one editor/disclosure and open the color dialog. Check contained content, focus visibility, Escape with a keyboard, and focus return.
- Submit rapid valid actions and inspect local/remote cues. Check there is no continuous flashing, delayed Score, or hidden connection warning.
- Reorder the Leaderboard through real Score changes and inspect the Closed Camp winner. Verify exact final values and stable identity. Safari may use the documented non-ViewTransition fallback.
- With reduced motion, verify no positional/continuous animation and no loss of text, state or action availability.

## Evidence and decision

| Evidence                            | Recorded result |
| ----------------------------------- | --------------- |
| Tested commit, date, tester         | Owner confirmed completion on 2026-09-27; actual test date, tester, and tested commit not supplied |
| Safari session 1                    | Owner reports five sessions completed; per-session detail not supplied |
| Safari session 2                    | Owner reports five sessions completed; per-session detail not supplied |
| Safari session 3                    | Owner reports five sessions completed; per-session detail not supplied |
| Safari session 4                    | Owner reports five sessions completed; per-session detail not supplied |
| Safari session 5                    | Owner reports five sessions completed; per-session detail not supplied |
| Lower-powered Android motion        | Owner reports an acceptable physical-device result; model, browser, and evidence not supplied |
| iPhone/iPad motion                  | Owner reports an acceptable physical-device result; model, browser, and evidence not supplied |
| Failures, fixes and retest evidence | No per-session failure or retest record supplied |
| Owner release decision              | Close the Pilot gate based on owner-reported pass, accepting that the missing details remain unverified |

The owner's attestation addresses the device classes and Safari session count. The gate is closed by the owner with the evidence limitations above explicitly retained. The exact tested revision and per-device/session observations cannot be verified from this record; any later release that needs revision-specific device proof should repeat and document the rehearsal.
