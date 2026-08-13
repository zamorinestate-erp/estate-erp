# ZAMORIN CAFE ERP — FINANCIAL & DATA INTEGRITY (SECTION 141.11)

> **Status**: VERIFIED & RECONCILED

## Core Invariants
1. **Decimal-Safe Minor Units**: Authoritative monetary values represented in integer paise (minor units) to eliminate floating-point rounding errors.
2. **Server-Authoritative Timestamps**: UTC backend timestamps used for all financial transactions, attendance punches, and audit entries (`Asia/Kolkata` display timezone).
3. **Sequential ID Generator**: `SequenceCounter.js` ensures sequential, non-reusable IDs for orders, invoices, expenses, and employee numbers across role prefixes (`MU-0001`, `OW-0002`, `AD-0003`, `ST-0004`).
4. **Immutable Postings**: Finalized orders, cash sessions, and posted payroll runs cannot be edited; reversals and adjustments are required for auditability.
