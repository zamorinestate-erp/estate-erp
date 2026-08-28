# Zamorin Café ERP — Login Integration Programme
# Stage 3 Master MFA Security Report

## 1. Threat Model & Security Invariants

When a Master logs in on a shared cafe terminal, they must not bypass the canonical multi-factor authentication requirements established on their account.

### Verified MFA Invariants
1. **No Session Without MFA**: If an account requires MFA (`requiresMfa: true`), `/operator/master-signin/credentials` returns an ephemeral challenge token and creates **ZERO sessions**.
2. **Challenge Binding**: The `mfaChallengeId` is cryptographically bound to the authenticated user ID and expires after 5 minutes.
3. **Replay Prevention**: Once an MFA challenge token is submitted to `/operator/master-signin/mfa` and verified, it is immediately invalidated. A second request with the same token returns `401 Unauthorized`.
4. **Wrong Code Rejection**: Submitting an incorrect TOTP code returns `401 Unauthorized` without creating a session.
5. **No Parallel Implementation**: The production adapter directly calls `mfaService.verifyTotpCode` against the canonical secret stored in `User.mfaSecret`.
