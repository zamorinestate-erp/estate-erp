# ZAMORIN CAFE ERP — FINANCIAL OPENING BALANCES TEMPLATE

**PURPOSE**: Validated schema and accounting reconciliation template for setting opening cash, bank balances, outstanding liabilities, and advances under the strict ₹0.00 unexplained variance rule.

---

## 1. Accounting Balancing Rule

> [!IMPORTANT]
> The Zamorin Cafe ERP enforces zero-variance financial integrity.
> The sum of opening cash in drawer + opening bank balance must exactly equal the verified opening equity/reserve balance.

$$\text{Total Opening Assets (Cash + Bank)} = \text{Total Opening Liabilities} + \text{Opening Capital / Reserves}$$

$$\text{Unexplained Financial Variance} = ₹0.00$$

---

## 2. Opening Balance Fields

| Account Head | Type | Required | Description | Example / Currency |
| :--- | :--- | :--- | :--- | :--- |
| `cafeId` | String | **YES** | Target cafe location | `ZC-0001` |
| `businessDate` | String | **YES** | Opening date (`YYYY-MM-DD`) | `2026-09-01` |
| `cashInDrawerOpening` | Number | **YES** | Physical cash in till float | `₹10,000.00` |
| `bankAccountOpening` | Number | **YES** | Current account bank balance | `₹250,000.00` |
| `outstandingSupplierPayables` | Number | **YES** | Unsettled vendor balances | `₹35,000.00` |
| `outstandingStaffAdvances` | Number | **YES** | Unrecovered salary advances | `₹15,000.00` |
| `openingEquityReserve` | Number | **YES** | Net balancing capital amount | `₹240,000.00` |

---

## 3. Onboarding JSON Payload Template

```json
{
  "organisationId": "ZAMORIN",
  "cafeId": "ZC-0001",
  "effectiveBusinessDate": "2026-09-01",
  "balances": {
    "cashInDrawer": 10000.00,
    "bankCurrentAccount": 250000.00,
    "outstandingSupplierPayables": 35000.00,
    "outstandingStaffAdvances": 15000.00,
    "openingReserve": 240000.00
  },
  "verifiedBy": "MU-0001",
  "verificationHash": "SHA256_RECONCILIATION_SEAL"
}
```
