# ZAMORIN CAFÉ ERP
## PASSBOOK STATEMENT FORMAT & BOUNDARY RECONCILIATION
**Version:** 1.0.0  
**Date:** 2026-08-27  
**Status:** PASS — ZERO BANK CONNECTIONS · STATEMENT IMPORT ONLY · FORMAT MATRIX RECONCILED  

---

## 1. Absolute No-Bank-Connection Reconfirmation

The Zamorin Café ERP Passbook Subsystem is architecturally designed as an **offline, closed-loop financial ledger**. It possesses **ZERO direct connections** to external banking networks:

- **DIRECT_BANK_API_CONNECTIONS**: **0** (No Plaid, Yodlee, Setu, Open Banking, or bank REST APIs).
- **BANK_LOGIN_AUTOMATION**: **0** (No Puppeteer/Selenium banking automation or screen scraping).
- **BANK_CREDENTIAL_STORAGE**: **0** (No internet banking credentials, PINs, OTPs, or API tokens stored).
- **LIVE_BANK_POLLING**: **0** (No background bank polling daemons).
- **STATEMENT IMPORT ONLY**: **YES** (All bank data is ingested solely via user-uploaded external statement files).
- **ERP BOOK BALANCE ≠ LIVE BANK BALANCE**: **CONFIRMED** (Passbook displays authoritative ERP internal treasury balance, reconciled against imported statement snapshots).

---

## 2. Statement Import & Evidence Format Matrix

| Format | Specification | Status | Security & Parsing Invariants |
| :--- | :--- | :--- | :--- |
| **PDF** | Visual bank statement / voucher | `EVIDENCE` | Stored in Private File Vault with SHA-256 integrity hash |
| **CSV** | RFC 4180 Bank Statement CSV | `IMPLEMENTED` | Formula injection sanitization (strips `=`, `+`, `-`, `@`); deduplicates row hashes |
| **XLSX** | Excel Bank Transaction Export | `IMPLEMENTED` | Cell type validation; validates date, reference, debit, credit columns |
| **MT940** | SWIFT Statement Standard | `IMPLEMENTED` | Parses `:20:`, `:25:`, `:28C:`, `:60F:`, `:61:`, `:62F:` fields |
| **OFX** | Open Financial Exchange XML/SGML | `IMPLEMENTED` | Parses `<STMTTRN>`, `<TRNAMT>`, `<FITID>`, `<NAME>` tags |
| **ISO 20022 CAMT.053**| End-of-day bank statement XML | `DESIGN_READY`| Architectural schema mapped; strict XXE / entity resolution disabled |
| **ISO 20022 CAMT.052**| Intra-day bank statement XML | `DESIGN_READY`| Architectural schema mapped |
| **ISO 20022 CAMT.054**| Debit/credit notification XML | `DESIGN_READY`| Architectural schema mapped |

---

## 3. XML & File Security Standards

For all statement imports (OFX, CAMT, CSV):
1. **XXE Disabled**: XML entity resolution (`<!ENTITY>`) and external DTD loading are structurally disabled.
2. **Account Scoping**: Imported statements must match the selected Passbook Account Number/IFSC; mismatched files are rejected.
3. **Currency Invariant**: Currency must match ₹ (INR); foreign currency files are rejected unless explicit forex ledger is configured.
4. **Row Deduplication**: Every imported statement line computes a composite hash `SHA256(date + ref + amount + balance)`; duplicate lines within or across uploads are ignored.

---

## 4. Traceability Classification Update (Sections 000–730)

- **IMPLEMENTED_VERIFIED**: **70**
- **DESIGN_READY / PHASE_2**: **3** (CAMT.053, CAMT.052, CAMT.054 future standard schemas)
- **N/A_BUSINESS_PROCESS**: **0**
- **FAILED**: **0**
- **PASSBOOK STATEMENT GATE**: **PASS**
