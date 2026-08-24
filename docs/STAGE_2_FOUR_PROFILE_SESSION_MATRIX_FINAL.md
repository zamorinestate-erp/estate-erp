# ZAMORIN CAFE ERP — STAGE 2 FOUR-PROFILE SESSION MATRIX
## Profile Request Verification & Authority Boundary Audit

### 1. Four-Profile Representative API Execution Matrix

| Profile | Page / Module | Endpoint Class | Session Attached | Device Context | Scope | HTTP Result | Expected Result | Missing-Session Error | PASS / FAIL |
|---|---|---|:---:|:---:|---|:---:|:---:|:---:|:---:|
| **Primary Master** | Dashboard | Class A (Core Metric) | Yes | Attached | Root Multi-Cafe | 200 OK | 200 OK | None | **PASS** |
| **Primary Master** | Governance / Roles | Class B (Privileged Root) | Yes | Attached | Organisation Root | 200 OK | 200 OK | None | **PASS** |
| **Primary Master** | Revenue Share | Class B (Commercial Root) | Yes | Attached | Global Portfolio | 200 OK | 200 OK | None | **PASS** |
| **Primary Master** | POS Terminal | Class A (Operational) | Yes | Attached | Master Override | 200 OK | 200 OK | None | **PASS** |
| **Normal Master** | Dashboard | Class A (Core Metric) | Yes | Attached | Multi-Cafe Ops | 200 OK | 200 OK | None | **PASS** |
| **Normal Master** | Inventory Master | Class A (Core Master) | Yes | Attached | Multi-Cafe Stock | 200 OK | 200 OK | None | **PASS** |
| **Normal Master** | Governance / Roles | Class B (Privileged Root) | Yes | Attached | Organisation Root | 403 Forbidden | 403 Forbidden | None | **PASS** *(Policy)* |
| **Normal Master** | POS Terminal | Class A (Operational) | Yes | Attached | Multi-Cafe Ops | 200 OK | 200 OK | None | **PASS** |
| **Owner** | Executive Dashboard | Class A (Executive) | Yes | Attached | Global Portfolio | 200 OK | 200 OK | None | **PASS** |
| **Owner** | Finance Summary | Class A (Financial) | Yes | Attached | Multi-Cafe Aggregate | 200 OK | 200 OK | None | **PASS** |
| **Owner** | Tasks & Oversight | Class B (Approval Gate) | Yes | Attached | Portfolio Approvals | 200 OK | 200 OK | None | **PASS** |
| **Owner** | POS Terminal | Class A (Operational) | Yes | Attached | Single-Cafe Read | 200 OK | 200 OK | None | **PASS** |
| **Cafe Operations** | POS Till / Billing | Class A (Terminal Ops) | Yes | Attached | Single-Cafe `ZC-0001` | 200 OK | 200 OK | None | **PASS** |
| **Cafe Operations** | Shift Attendance | Class A (Local Staff) | Yes | Attached | Single-Cafe `ZC-0001` | 200 OK | 200 OK | None | **PASS** |
| **Cafe Operations** | Daily Cash Book | Class A (Till Movement) | Yes | Attached | Register `REG-01` | 200 OK | 200 OK | None | **PASS** |
| **Cafe Operations** | Governance / Roles | Class B (Privileged Root) | Yes | Attached | Organisation Root | 403 Forbidden | 403 Forbidden | None | **PASS** *(Policy)* |

---

### 2. Security & Authority Summary
- **Zero Missing-Session Errors**: None of the 4 profiles produced `"Session ID, refresh token and device ID are required"`.
- **RBAC Policy Integrity**: Normal Master and Cafe Operations attempts to access Primary Master root governance endpoints correctly returned `403 Forbidden` before database query execution.
- **Device Context Attached**: Persistent device identifier (`x-device-id: ZC-DEV-...`) attached across 100% of tested profiles.
