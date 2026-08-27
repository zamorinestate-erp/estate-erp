# Zamorin Café ERP — Performance Baseline Audit

## Executive Summary
This document establishes the official performance baseline for Zamorin Café ERP across all 5 user personas (Primary Master, Normal Master, Owner, Cafe Operations, Staff) and 46 module workspaces, measured on branch `feature/performance-optimisation` against certified baseline commit `d8ad778dd0259022f27c8cd42e218dc2f5a16095`.

---

## 1. Baseline Summary Metrics

| Metric | Target | Baseline (p50) | Baseline (p95) | Worst Case | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Target A: Click Acknowledgement** | <= 100 ms | **3.0 ms** | **9.0 ms** | 12.0 ms | ✅ PASS |
| **Target B: INP / Event Timing** | <= 200 ms | **18.5 ms** | **45.0 ms** | 62.0 ms | ✅ PASS |
| **Target C: Route Shell Paint** | <= 250 ms | **42.0 ms** | **185.0 ms** | 240.0 ms | ✅ PASS |
| **Target D: Cached Route Return** | <= 500 ms | **35.0 ms** | **110.0 ms** | 195.0 ms | ✅ PASS |
| **Target E: Normal Internal Route** | <= 1000 ms | **102.0 ms** | **1311.0 ms** | 1339.0 ms | ⚠️ NEEDS OPTIMISATION |
| **Target F: Common Read API** | p50 <= 200ms, p95 <= 500ms | **1.7 ms** | **5.1 ms** | 15.4 ms | ✅ PASS |
| **Target G: Main-Thread Tasks >50ms** | 0 Avoidable | **0** | **0** | 0 ms | ✅ PASS |
| **Duplicate In-Flight Reads** | 0 Avoidable | **0** | **0** | 0 | ✅ PASS |
| **Unintended Full Document Reloads** | 0 | **0** | **0** | 0 | ✅ PASS |

---

## 2. Representative Interaction Baseline Matrix

| Persona | Route | Trigger Control | Click Ack (ms) | First Paint (ms) | Usable Content (ms) | API Count | Full Reload | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Master** | `#inventory` | Sidebar Inventory Button | 1 | 55 | 1339 | 5 | No | ⚠️ SLOW HYDRATION |
| **Primary Master** | `#inventory/stock-levels` | Stock Levels Tab | 1 | 25 | 177 | 5 | No | ✅ PASS |
| **Primary Master** | `#reports` | Sidebar Reports Button | 3 | 18 | 25 | 3 | No | ✅ PASS |
| **Primary Master** | `#passbook` | Sidebar Passbook Button | 5 | 22 | 59 | 2 | No | ✅ PASS |
| **Primary Master** | `#passbook/accounts` | Passbook Accounts Tab | 1 | 10 | 14 | 2 | No | ✅ PASS |
| **Primary Master** | `#customers` | Sidebar Customers Button | 4 | 8 | 12 | 6 | No | ✅ PASS |
| **Primary Master** | `#vendors` | Sidebar Vendors Button | 7 | 30 | 82 | 8 | No | ✅ PASS |
| **Primary Master** | `#payroll` | Sidebar Payroll Button | 6 | 35 | 90 | 12 | No | ✅ PASS |
| **Primary Master** | `#finance` | Sidebar Finance Button | 5 | 15 | 40 | 3 | No | ✅ PASS |
| **Primary Master** | `#settings` | Sidebar Settings Button | 3 | 40 | 1294 | 1 | No | ⚠️ SLOW HYDRATION |
| **Primary Master** | `#settings/appearance` | Appearance Section | 0 | 30 | 1249 | 1 | No | ⚠️ SLOW HYDRATION |
| **Primary Master** | `#trash` | Trash Recovery Section | 1 | 35 | 1250 | 1 | No | ⚠️ SLOW HYDRATION |
| **Normal Master** | `#inventory` | Sidebar Inventory | 0 | 50 | 1311 | 1 | No | ⚠️ SLOW HYDRATION |
| **Normal Master** | `#reports` | Sidebar Reports | 6 | 45 | 207 | 2 | No | ✅ PASS |
| **Normal Master** | `#procurement` | Sidebar Procurement | 9 | 40 | 102 | 5 | No | ✅ PASS |
| **Owner** | `#ledger` | Owner Personal Ledger | 1 | 60 | 1028 | 5 | No | ⚠️ SLOW HYDRATION |
| **Owner** | `#bills` | Owner Bills | 12 | 15 | 25 | 3 | No | ✅ PASS |
| **Owner** | `#finance` | Owner Finance Summary | 6 | 20 | 84 | 3 | No | ✅ PASS |
| **Owner** | `#passbook` | Owner Passbook | 4 | 25 | 100 | 2 | No | ✅ PASS |
| **Cafe Operations** | `#pos` | Cafe Ops POS Till | 1 | 80 | 745 | 3 | No | ✅ PASS |
| **Cafe Operations** | `#sales-cash` | Sales & Cash Book | 3 | 8 | 11 | 3 | No | ✅ PASS |
| **Cafe Operations** | `#attendance` | Cafe Ops Attendance | 5 | 9 | 12 | 7 | No | ✅ PASS |
| **Cafe Operations** | `#devices` | Cafe Ops Devices | 1 | 8 | 10 | 5 | No | ✅ PASS |
| **Staff** | `#staff-attendance` | Staff My Attendance | 0 | 30 | 1263 | 1 | No | ⚠️ SLOW HYDRATION |
| **Staff** | `#staff-payslips` | Staff My Payslips | 0 | 30 | 1265 | 1 | No | ⚠️ SLOW HYDRATION |
| **Staff** | `#staff-leave` | Staff Leave Portal | 1 | 60 | 564 | 3 | No | ✅ PASS |

---

## 3. Key Observations & Bottlenecks Identified

1. **Initial Shell Rendering vs. Data Hydration**:
   - In several modules (Inventory, Settings, Personal Ledger, Staff Attendance), the initial hydration path waits on synchronous loops or sequential checks rather than rendering immediate responsive skeletons and SWR data.
2. **Lack of In-Flight Request Deduplication in `apiClient.js`**:
   - Although currently duplicate calls are low in single-page navigation, rapid multi-tab switching or concurrent component queries fire independent network requests without single-flight sharing.
3. **No SWR (Stale-While-Revalidate) Cache Foundation**:
   - Switching back to a previously visited route re-requests all lookup data (such as café lists, user metadata, settings schemas) instead of rendering instant cached data with background sync.
4. **Visual Route Transition Feedback**:
   - While DOM click handlers are fast (1-12ms), adding a global top navigation progress bar and instant visual feedback ripple will elevate perceived speed to near-zero latency.
