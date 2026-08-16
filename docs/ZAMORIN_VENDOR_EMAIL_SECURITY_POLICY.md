# ZAMORIN CAFE ERP — VENDOR EMAIL SECURITY & BEC DEFENSE POLICY
**Document ID**: `ZAM-POL-VENDOR-SECURITY-007`  
**Version**: `1.0.0`  
**Status**: `AUTHORITATIVE`

---

## 1. Vendor Sender Registry
All commercial communications arriving from vendors must match the approved sender registry in `Vendor.js`:
- `email`: Primary business email
- `primaryContactEmail`: Verified primary liaison
- `accountsEmail`: Official billing / invoice source
- `salesEmail`: Official quotation source
- `approvedEmailAddresses`: Whitelisted employee emails
- `approvedDomains`: Authenticated corporate domain

If an email claims to be a vendor but arrives from an unrecognized domain, it is marked with `VENDOR_MISMATCH` and elevated risk score.

## 2. Business Email Compromise (BEC) Defense
Any email requesting changes to:
- Bank account number
- IFSC code
- Beneficiary name
- UPI ID
- Payment routing instructions

is automatically intercepted, assigned `riskScore: 'CRITICAL'`, flagged with `isBecSuspected: true`, quarantined, and alerted to Primary Master (`MU-0001`).

**Absolute Rule**: Vendor bank information is NEVER updated automatically via email. Changes require out-of-band phone/signed verification and authenticated ERP execution by MASTER.
