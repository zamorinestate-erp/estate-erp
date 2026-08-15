# ZAMORIN CAFE ERP — CAFE DEVICE ENROLLMENT & ONBOARDING RUNBOOK

**PURPOSE**: Standard operating procedure for enrolling, binding, and certifying dedicated café-owned tablets/terminals.

---

## 1. Pre-Requisites & Hardware Hygiene

- [ ] Tablet/Terminal is company-owned hardware (not personal employee handset).
- [ ] OS is updated to latest security patch level with PIN/passcode screen lock enabled.
- [ ] Browser storage from previous pilots/testing is completely cleared.
- [ ] Device is connected to secure Café Wi-Fi (WPA3-Enterprise / WPA2-PSK).

---

## 2. Step-by-Step Enrollment Protocol

### Step 1: Open Device Enrollment Portal on Café Tablet
1. Navigate to `https://zamorin-erp.domain/setup/device-enrollment`.
2. The browser automatically generates a non-extractable P-256 signing key pair via WebCrypto and stores it in IndexedDB.
3. The tablet displays a **One-Time Enrollment Request Code** (e.g. `ENR-9842-ZC01`) and a verification QR.

### Step 2: Primary Master Approval & Governance Binding
1. Primary Master (`MU-0001`) logs into the Master Governance Console on their authenticated workstation.
2. Complete Step-Up Re-Authentication (password + TOTP MFA challenge).
3. Navigate to **Device Governance** -> **Pending Enrollments**.
4. Match the Enrollment Request Code (`ENR-9842-ZC01`) with the physical asset tag.
5. Select Target Cafe: `ZC-0001` (Flagship Beach Road Cafe).
6. Click **Approve & Bind Device**.

### Step 3: Cryptographic Handshake & Kiosk Mode Activation
1. The café tablet receives the approval notification and signs a server-issued challenge with its non-extractable private key.
2. The server verifies the cryptographic signature against the registered public key and sets status to `ACTIVE`.
3. The tablet transitions into **Dedicated Attendance Kiosk Display Mode** (rotating QR code every 20 seconds).
4. For POS, inventory, or expense management, a human `CAFE_ADMIN` must log in on the device.

---

## 3. Post-Enrollment Acceptance Verification

- [ ] Device status shows `ACTIVE` in Atlas `device_registrations`.
- [ ] Device is bound strictly to `ZC-0001`.
- [ ] Tablet displays rotating QR attendance challenges.
- [ ] CAFE_ADMIN personal phone login verified as `SELF_ONLY` profile.
- [ ] Kiosk CAFE_ADMIN login verified as `CAFE_OPERATIONS` profile.
