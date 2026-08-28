# ZAMORIN CAFÉ ERP — RECEIPT & DOCUMENT ARCHITECTURE

## 1. Architecture Overview
Receipt and document generation uses a dual-engine architecture:
1. **Client-Side Direct ESC/POS & Canvas Renderer**: Zero-latency printing for high-throughput cafe POS environments.
2. **Server-Side Universal Report Engine (ZURF)**: High-fidelity PDF rendering for audit, payslips, and corporate financial documentation.

```
[POS Till Client] ──> [Format Receipt Data] ──> [Raw ESC/POS Thermal / Browser Print]
[Staff / Finance] ──> [API Request /zurf]   ──> [ZurfService.js] ──> [Signed PDF / HTML Document]
```

## 2. Statutory Fields Enforced
- FSSAI License Number: `11224333000541`
- GST Registration: `29AABCZ9821K1ZX`
- SAC / HSN Codes: 996331 (Restaurant Services)
- Timezone: Indian Standard Time (IST, UTC+05:30)
- Currency: Indian Rupee (INR / ₹) with exact paisa precision.
