# ZAMORIN CAFE ERP — CAFÉ ONBOARDING TEMPLATE

**PURPOSE**: Validated schema and template for registering individual cafe branches in Zamorin Cafe ERP.

---

## 1. Café Master Fields

| Field Name | Type | Required | Description / Format | Example / Business Rule |
| :--- | :--- | :--- | :--- | :--- |
| `cafeId` | String | **YES** | Format `/^ZC-\d{4,}$/` (immutable) | `ZC-0001` |
| `organisationId` | String | **YES** | Matching organisation identifier | `ZAMORIN` |
| `name` | String | **YES** | Internal branch name | `Zamorin Cafe — Flagship Beach Road` |
| `displayName` | String | **YES** | Customer-facing display name | `Zamorin Cafe Beach` |
| `code` | String | **YES** | 3-6 char uppercase identifier | `ZCK01` |
| `cafeType` | String | **YES** | Enum: `STANDARD_CAFE`, `KIOSK`, `FOOD_COURT`, `CAMPUS_CAFE`, `INSTITUTIONAL_CAFE`, `OTHER` | `STANDARD_CAFE` |
| `status` | String | **YES** | Enum: `ACTIVE`, `PENDING_OPENING`, `DRAFT`, `CLOSED` | `ACTIVE` |
| `address` | Object | **YES** | Physical location address | Street, City, State, PIN, Country |
| `geoFence` | Object | OPTIONAL | Geo-fencing for attendance validation | `latitude: 11.2588, longitude: 75.7804, radiusMeters: 100` |
| `operatingHours` | Object | **YES** | Daily opening/closing schedule (`HH:mm`) | Mon-Sun `07:00` to `23:00` |
| `assignedCafeAdminIds`| Array | **YES** | Array of valid User IDs (`AD-XXXX`) | `["AD-0001"]` |
| `openingDate` | Date | **YES** | Commercial opening date | `2026-09-01` |

---

## 2. Onboarding JSON Payload Template

```json
[
  {
    "cafeId": "ZC-0001",
    "organisationId": "ZAMORIN",
    "name": "Zamorin Cafe — Flagship Beach Road",
    "displayName": "Zamorin Cafe Beach",
    "code": "ZCK01",
    "cafeType": "STANDARD_CAFE",
    "status": "ACTIVE",
    "address": {
      "line1": "Beach Road, Near Old Pier",
      "city": "Kozhikode",
      "state": "Kerala",
      "postalCode": "673032",
      "country": "India"
    },
    "geoFence": {
      "latitude": 11.258753,
      "longitude": 75.780412,
      "radiusMeters": 150
    },
    "schedule": {
      "monday": { "isOpen": true, "openingTime": "07:00", "closingTime": "23:00" },
      "tuesday": { "isOpen": true, "openingTime": "07:00", "closingTime": "23:00" },
      "wednesday": { "isOpen": true, "openingTime": "07:00", "closingTime": "23:00" },
      "thursday": { "isOpen": true, "openingTime": "07:00", "closingTime": "23:00" },
      "friday": { "isOpen": true, "openingTime": "07:00", "closingTime": "23:00" },
      "saturday": { "isOpen": true, "openingTime": "07:00", "closingTime": "23:30" },
      "sunday": { "isOpen": true, "openingTime": "07:00", "closingTime": "23:30" }
    },
    "assignedCafeAdminIds": ["AD-0001"],
    "openingDate": "2026-09-01"
  }
]
```
