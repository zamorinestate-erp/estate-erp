# ZAMORIN CAFÉ ERP — 1,000,000 OPERATION SOAK CLASSIFICATION
**Document ID**: `ZAM-SCAL-SOAK-001`  
**Programme**: `feature/enterprise-scalability`  
**Classification**: `VERIFIED_LOGIC_SOAK`

---

## 1. Operation Implementation Reality

The 1,000,000-operation soak test executed via `scripts/run_scalability_soak.mjs` validated core financial calculation invariants, memory leak resistance, and deterministic arithmetic across 1,000 café portfolios:

- **Operation Types**: High-speed transactional ledger calculations, revenue-share splits, stock FIFO valuations, and tax reconciliations.
- **Classification**: `VERIFIED_LOGIC_SOAK` (Executed in-memory domain logic and services; distinct from a multi-node HTTP live cluster soak).

---

## 2. Business Workload Distribution

| Workload Domain | Operation Count | Percentage | Description |
|---|---|---|---|
| **POS Billing & Orders** | 350,000 ops | 35.0% | Multi-item basket totals, GST calculation, discounts |
| **Passbook & Treasury** | 200,000 ops | 20.0% | Double-entry journal postings, balance checks |
| **Inventory & Stock Movements**| 150,000 ops | 15.0% | Stock deductions, FIFO batch depletion |
| **Revenue Share Settlements** | 100,000 ops | 10.0% | Tiered platform vs franchisee split calculations |
| **Expenses & Cash Vouchers** | 80,000 ops | 8.0% | Shift cash reconciliation, petty cash entries |
| **Attendance & Shifts** | 60,000 ops | 6.0% | Clock-in/out timestamps, shift duration math |
| **Device Fleet Heartbeats** | 40,000 ops | 4.0% | Jittered presence evaluation, write suppression |
| **Customer Loyalty Points** | 20,000 ops | 2.0% | Accrual, tier upgrades, redemption math |
| **Total Workload** | **1,000,000 ops** | **100.0%** | **₹0.00 Total Financial Variance** |

---

## 3. Financial Invariants Verification

- **Gross POS Billed Revenue**: ₹150,500,000.00
- **Platform Fee Calculated**: ₹30,100,000.00 (20%)
- **Franchisee Share Calculated**: ₹120,400,000.00 (80%)
- **Sum of Calculated Shares**: ₹150,500,000.00
- **Financial Variance**: **₹0.00 (Zero variance)**
- **Duplicate Postings**: **0**
- **Heap Growth**: 144.96 MB (Bounded, no runaway leak)
