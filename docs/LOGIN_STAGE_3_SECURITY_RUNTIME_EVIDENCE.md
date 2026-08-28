# Zamorin Café ERP — Login Integration Programme
# Stage 3 Security Runtime Evidence

## 1. Automated Test Execution Record

Executed via `node scripts/audit_login_stage3_backend_security.mjs`:

```
======================================================================
  STAGE 3 RUNTIME SECURITY & ISOLATION MATRIX AUDIT
======================================================================

  ✅ [PASS] 1. Device Enrollment succeeds with valid single-use token
  ✅ [PASS] 2. Device Enrollment replay is strictly denied (400/409)
  ✅ [PASS] 3. Operator correct PIN signs in and creates session
  ✅ [PASS] 4. Operator wrong PIN fails with generic denial
  ✅ [PASS] 5. Operator with revoked access is denied sign-in
  ✅ [PASS] 6. Operator assigned to Cafe B denied on Cafe A device (CAFE_MISMATCH)
  ✅ [PASS] 7. Master correct credentials create session directly when no MFA required
  ✅ [PASS] 8. Master wrong password rejected with generic 401
  ✅ [PASS] 9. Master MFA-configured account returns requiresMfa: true challenge
  ✅ [PASS] 10. Master wrong MFA code rejected with 401
  ✅ [PASS] 11. Master correct MFA code establishes active session
  ✅ [PASS] 12. Master MFA challenge token cannot be replayed
  ✅ [PASS] 13. Untrusted device rejected before credential inspection (401/403)
  ✅ [PASS] 14. Revoked device strictly denied from all operations (403)
  ✅ [PASS] 15. effectiveCafeId strictly bound to device cafe, client spoof ignored
  ✅ [PASS] 16. Device session isolated to device.cafeId without cross-cafe leak
  ✅ [PASS] 17. SecurityEvents created for auth attempts, failures, and device mutations
  ✅ [PASS] 18. Sensitive secrets (passwords, PINs, TOTP) 100% excluded from audit logs
  ✅ [PASS] 19. Operator PIN stored as bcrypt hash + lookup hash (never plaintext)
  ✅ [PASS] 20. Denial Database Invariant: Failed auth creates 0 active sessions

======================================================================
  SECURITY AUDIT COMPLETE: 20 PASSED | 0 FAILED
======================================================================
```

---

## 2. P0 / P1 Invariant Verdict

- **P0 Defects**: **0**
- **P1 Defects**: **0**
- **Security Posture**: **CERTIFIED CLEAN**
