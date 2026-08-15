# ZAMORIN CAFE ERP — MENU & CATALOG ONBOARDING TEMPLATE

**PURPOSE**: Validated schema and template for importing menu items, categories, pricing, and GST tax slabs.

---

## 1. Menu Item Data Fields

| Field Name | Type | Required | Description / Format | Example / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `itemId` | String | **YES** | Format `/^ITM-\d{4,}$/` | `ITM-0001` |
| `organisationId` | String | **YES** | Matching organisation identifier | `ZAMORIN` |
| `name` | String | **YES** | Menu item name | `Malabar Roast Cold Brew` |
| `category` | String | **YES** | Enum: `HOT_COFFEE`, `COLD_COFFEE`, `TEA_INFUSIONS`, `SNACKS`, `DESSERTS`, `MAIN_COURSE`, `BEVERAGES` | `COLD_COFFEE` |
| `basePrice` | Number | **YES** | Base price in INR | `180.00` |
| `taxRatePercent`| Number | **YES** | GST tax percentage (0, 5, 12, 18) | `5.00` |
| `finalPrice` | Number | **YES** | Customer billing price | `189.00` |
| `isAvailable` | Boolean | **YES** | Instant availability toggle | `true` |
| `applicableCafeIds` | Array | **YES** | Specific cafes or `["*"]` for all | `["*"]` |

---

## 2. Onboarding JSON Payload Template

```json
[
  {
    "itemId": "ITM-0001",
    "organisationId": "ZAMORIN",
    "name": "Malabar Roast Cold Brew",
    "category": "COLD_COFFEE",
    "basePrice": 180.00,
    "taxRatePercent": 5.0,
    "finalPrice": 189.00,
    "isAvailable": true,
    "applicableCafeIds": ["*"]
  },
  {
    "itemId": "ITM-0002",
    "organisationId": "ZAMORIN",
    "name": "Kozhikode Halwa Crumble Cheesecake",
    "category": "DESSERTS",
    "basePrice": 220.00,
    "taxRatePercent": 5.0,
    "finalPrice": 231.00,
    "isAvailable": true,
    "applicableCafeIds": ["*"]
  }
]
```
