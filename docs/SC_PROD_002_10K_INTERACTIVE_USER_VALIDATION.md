# ZAMORIN CAFÉ ERP
## SC-PROD-002: 10,000 CONCURRENT INTERACTIVE USER VALIDATION SPECIFICATION

**Programme**: Enterprise Cluster Capacity Validation  
**Gate**: `SC-PROD-002`  
**Target Metric**: `10,000+ Simultaneous Active Virtual Users`  
**Cluster Status**: `BLOCKED_INFRASTRUCTURE_ACCESS` (Pending Authorized Cloud Infrastructure Provisioning)  

---

### Workload & Persona Distribution Model

The 10,000 active virtual users execute the representative authenticated workload defined in `scripts/scale/k6-interactive-users.js`:

1. **Persona Mix**:
   - Staff: 5,500 VUs (55%)
   - Cafe Operations: 2,500 VUs (25%)
   - Owner: 1,200 VUs (12%)
   - Normal Master: 600 VUs (6%)
   - Primary Master: 200 VUs (2%)

2. **Workflow Distribution**:
   - Dashboard & KPI Summary: 35%
   - Global / Indexed Employee Search: 15%
   - Attendance & Time Tracking: 15%
   - POS / Order Submissions: 15%
   - Inventory & Stock Inquiries: 8%
   - Tasks & Customer Profiles: 7%
   - Finance, Bills & Reports: 5%

3. **Latency & Reliability SLAs**:
   - Normal Read API $p95 \le 750\text{ ms}$
   - Normal Business Write API $p95 \le 1,000\text{ ms}$
   - Interactive Operations $p99 \le 2,000\text{ ms}$
   - Unexpected HTTP $5\text{xx} < 0.1\%$
   - Security / Data Leaks: **0**
   - Financial Duplicate Postings: **0**
