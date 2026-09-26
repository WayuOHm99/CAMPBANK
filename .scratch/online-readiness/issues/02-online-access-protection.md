# Online access protection

Status: needs-info

Anonymous Auth currently has no CAPTCHA token integration. Add/test the browser flow before enabling hosted CAPTCHA, including token expiry/retry and multiple devices behind a shared IP. Requires the target domain/provider configuration; never request secret keys in chat.

The user selected individual revocable Staff invitations, now implemented and covered by integration and core desktop browser tests. Admin PIN replacement changes ADR-0004; define login/recovery and account migration first. Verify account lockout cannot be abused to deny legitimate Admin access.

## Comments

2026-09-26: User authorized opening existing name + PIN login and Anonymous Auth. Created first online Admin with an owner-entered PIN, verified live login form and deployed access-enabled production. CAPTCHA and account-lockout abuse hardening remain open; do not interpret passing functional tests as resolution of these risks.
