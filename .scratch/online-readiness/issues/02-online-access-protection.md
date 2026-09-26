# Online access protection

Status: needs-info

Anonymous Auth currently has no CAPTCHA token integration. Add/test the browser flow before enabling hosted CAPTCHA, including token expiry/retry and multiple devices behind a shared IP. Requires the target domain/provider configuration; never request secret keys in chat.

The accepted Staff design allows holders of a shared private link to choose any Staff identity. Decide whether trusted-team access remains appropriate or specify individual revocable invitations. Admin PIN replacement changes ADR-0004; define login/recovery and account migration first. Verify account lockout cannot be abused to deny legitimate Admin access.
