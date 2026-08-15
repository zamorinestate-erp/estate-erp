# ZAMORIN CAFE ERP — OPENING INVENTORY TEMPLATE

**PURPOSE**: Validated schema and template for recording opening raw materials, stock batches, unit costs, and reorder levels.

---

## 1. Inventory Item Fields

| Field Name | Type | Required | Description / Format | Example / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `stockItemId` | String | **YES** | Format `/^STK-\d{4,}$/` | `STK-0001` |
| `organisationId`| String | **YES** | Matching organisation identifier | `ZAMORIN` |
| `name` | String | **YES** | Raw material name | `Single-Origin Arabica Beans (Wayanad)` |
| `category` | String | **YES** | Enum: `COFFEE_BEANS`, `DAIRY`, `SYRUPS`, `PACKAGING`, `BAKERY_RAW`, `CLEANING_SUPPLIES` | `COFFEE_BEANS` |
| `unitOfMeasure` | String | **YES** | Unit code: `KG`, `LITER`, `PACKET`, `PIECE`, `BOX` | `KG` |
| `reorderLevel` | Number | **YES** | Low stock trigger threshold | `10.0` |
| `cafeId` | String | **YES** | Assigned branch location | `ZC-0001` |
| `openingStock` | Number | **YES** | Verified opening physical quantity | `50.0` |
| `unitCost` | Number | **YES** | Cost per unit (INR) | `650.00` |
| `batchNumber` | String | OPTIONAL | Supplier batch number | `WAY-2026-AUG-04` |
| `expiryDate` | Date | OPTIONAL | Expiry date | `2027-02-15` |

---

## 2. Onboarding JSON Payload Template

```json
[
  {
    "stockItemId": "STK-0001",
    "organisationId": "ZAMORIN",
    "cafeId": "ZC-0001",
    "name": "Single-Origin Arabica Beans (Wayanad)",
    "category": "COFFEE_BEANS",
    "unitOfMeasure": "KG",
    "openingStock": 50.0,
    "unitCost": 650.00,
    "reorderLevel": 10.0,
    "batchNumber": "WAY-2026-AUG-04",
    "expiryDate": "2027-02-15"
  },
  {
    "stockItemId": "STK-0002",
    "organisationId": "ZAMORIN",
    "name": "Full Cream Farm Fresh Milk",
    "cafeId": "ZC-0001",
    "category": "DAIRY",
    "unitOfMeasure": "LITER",
    "openingStock": 100.0,
    "unitCost": 58.00,
    "reorderLevel": 25.0,
    "batchNumber": "MILK-20260815",
    "expiryDate": "2026-08-18"
  }
]
```
