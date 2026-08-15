# ZAMORIN CAFE ERP — VENDOR MASTER ONBOARDING TEMPLATE

**PURPOSE**: Validated schema and template for onboarding suppliers, roasters, dairy farms, packaging vendors, and service contractors.

---

## 1. Vendor Data Fields

| Field Name | Type | Required | Description / Format | Example / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `vendorId` | String | **YES** | Format `/^VND-\d{4,}$/` | `VND-0001` |
| `organisationId` | String | **YES** | Matching organisation identifier | `ZAMORIN` |
| `legalName` | String | **YES** | Vendor registered legal business name | `Wayanad Organic Coffee Planters Co.` |
| `tradeName` | String | **YES** | Trading / Brand name | `Wayanad Estates` |
| `category` | String | **YES** | Enum: `COFFEE_SUPPLIER`, `DAIRY`, `BAKERY`, `PACKAGING`, `EQUIPMENT_MAINTENANCE`, `UTILITIES` | `COFFEE_SUPPLIER` |
| `gstin` | String | **YES** | 15-character GSTIN | `32AAACW1234K1Z5` |
| `pan` | String | **YES** | 10-character PAN | `AAACW1234K` |
| `contactPerson` | String | **YES** | Vendor representative name | `Venu Gopalan` |
| `email` | String | **YES** | Vendor order email | `orders@wayanadcoffee.com` |
| `phone` | String | **YES** | 10-digit phone number | `+91 94471 22334` |
| `paymentTermsDays` | Number | **YES** | Credit days (e.g. 0, 7, 15, 30) | `15` |
| `status` | String | **YES** | Enum: `ACTIVE`, `PENDING_VERIFICATION`, `BLOCKED` | `ACTIVE` |

---

## 2. Onboarding JSON Payload Template

```json
[
  {
    "vendorId": "VND-0001",
    "organisationId": "ZAMORIN",
    "legalName": "Wayanad Organic Coffee Planters Co-Op",
    "tradeName": "Wayanad Estates",
    "category": "COFFEE_SUPPLIER",
    "gstin": "32AAACW1234K1Z5",
    "pan": "AAACW1234K",
    "contactPerson": "Venu Gopalan",
    "email": "orders@wayanadcoffee.com",
    "phone": "+919447122334",
    "paymentTermsDays": 15,
    "status": "ACTIVE"
  }
]
```
