# ZAMORIN CAFE ERP — LOST / STOLEN CAFE DEVICE INCIDENT PLAYBOOK

**PURPOSE**: Immediate incident response runbook for revoking compromised or lost café-owned tablets.

---

## 1. Immediate Threat Containment (Within 5 Minutes)

When a café tablet or POS terminal is reported lost or stolen:

1. **Trigger Emergency Device Revocation**:
   * Primary Master (`MU-0001`) logs into Master Governance Console -> **Device Governance**.
   * Locate the compromised Device ID (e.g. `DV_ZC0001_KIOSK_01`).
   * Click **Immediate Revoke & Terminate All Sessions**.
   * Enter revocation reason: `REPORTED_STOLEN_PHYSICAL_BREACH`.
2. **Backend Automated Actions**:
   * Sets `DeviceRegistration.status = 'REVOKED'`.
   * Increments `deviceVersion` and `devicePolicyVersion`.
   * Revokes all active sessions bound to `deviceId`.
   * Invalidates all outstanding online QR challenges and offline signing leases.
   * Generates a `CRITICAL` audit event `DEVICE_REVOKED_EMERGENCY`.

---

## 2. Forensic Review & Offline Attendance Quarantine

1. Any offline attendance envelopes signed by the revoked device after the revocation timestamp are quarantined for manual supervisor review.
2. Legitimate attendance recorded prior to the theft is reconciled and retained.

---

## 3. Replacement Provisioning

1. Obtain a replacement hardware tablet.
2. Execute [docs/CAFE_DEVICE_ONBOARDING_RUNBOOK.md](file:///d:/Zamorin_Cafe_ERP_Build/15_INTEGRATION_WORKSPACE/docs/CAFE_DEVICE_ONBOARDING_RUNBOOK.md).
3. Do **NOT** attempt to restore the old device's browser profile. A fresh cryptographic key pair must be generated on the new physical hardware.
