# ZAMORIN CAFE ERP — ORGANISATION ONBOARDING TEMPLATE

**PURPOSE**: Validated data structure for onboarding the legal and operational organization master into Zamorin Cafe ERP.

---

## 1. Organisation Master Fields

| Field Name | Type | Required | Description / Format | Example / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `organisationId` | String | **YES** | Unique uppercase alphanumeric code (immutable) | `ZAMORIN` |
| `legalName` | String | **YES** | Full legal registered business name | `Zamorin Estate Private Limited` |
| `tradingName` | String | **YES** | Public trading brand name | `Zamorin Cafe` |
| `gstin` | String | **YES** | 15-character Indian Goods & Services Tax Number | `32AABCU9603R1ZM` (Kerala GSTIN) |
| `pan` | String | **YES** | 10-character Permanent Account Number | `AABCU9603R` |
| `registeredAddress` | Object | **YES** | Official registered address | Street, City, State, PIN (`673001`), Country (`India`) |
| `timezone` | String | **YES** | Standard IANA timezone | `Asia/Kolkata` (Default) |
| `currency` | String | **YES** | ISO 4217 Currency Code | `INR` (₹) |
| `fiscalYearStart` | String | **YES** | Month/Day fiscal start | `04-01` (1st April) |
| `primaryContactName`| String | **YES** | Authorized organizational representative | `Managing Director / Owner` |
| `primaryContactEmail`| String | **YES** | Official governance email | `admin@zamorincafe.com` |
| `primaryContactPhone`| String | **YES** | 10-digit primary phone | `+91 98460 00000` |

---

## 2. Onboarding JSON Payload Template

```json
{
  "organisationId": "ZAMORIN",
  "legalName": "Zamorin Estate Private Limited",
  "tradingName": "Zamorin Cafe",
  "gstin": "32AABCU9603R1ZM",
  "pan": "AABCU9603R",
  "registeredAddress": {
    "line1": "Zamorin Heritage Building, Beach Road",
    "line2": "Near Old Lighthouse",
    "city": "Kozhikode",
    "state": "Kerala",
    "postalCode": "673001",
    "country": "India"
  },
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "fiscalYearStart": "04-01",
  "primaryContact": {
    "name": "Managing Director",
    "email": "director@zamorin.in",
    "phone": "+919846000000"
  },
  "settings": {
    "multiCafeEnabled": true,
    "requireMfaForMaster": true,
    "sessionIdleTimeoutMinutes": 30
  }
}
```
