// =============================================================================
// PAGE: Tasks & Approvals — Operational Task Oversight (OWN-SCR-002)
// Governance, Exception Management, Multi-Café Scoping & Verification
// =============================================================================

import { showToast, openModal } from "../components.js";
import { apiGet, apiPost } from "../apiClient.js";
import { state } from "../state.js";
import { ROLES } from "../navigation.js";

let liveTasks = null;
let summaryMetrics = null;
let activeTaskTab = state.role === ROLES.OWNER ? "EXCEPTIONS" : "ALL";
let selectedCafeFilter = "ALL";
let selectedStatusFilter = "ALL";
let selectedCategoryFilter = "ALL";
let selectedPriorityFilter = "ALL";
let selectedSortBy = "CRITICAL_OVERDUE";
let criticalOnlyFilter = false;
let blockedOnlyFilter = false;
let recurringOnlyFilter = false;
let searchQuery = "";
let lastRefreshedTime = new Date();

const CAFE_NAMES = {
  "ZC-0001": "Kozhikode Beach Main",
  "ZC-0002": "Calicut Cyberpark Outpost",
  "ZC-0003": "Wayanad Heritage Roastery",
};

const SAMPLE_TASKS = [
  {
    taskId: "TSK-0001",
    title: "Espresso Machine Group 1 & 2 Deep Descaling & Backflush",
    description: "Perform 15-minute chemical backflush on groups 1 and 2, replace shower screens if clogged, check steam wand pressure.",
    category: "EQUIPMENT_MAINTENANCE",
    risk: "HIGH",
    isCriticalControl: true,
    assignedUserId: "Priya Nair",
    responsibleUserId: "Ravi Kumar",
    cafeId: "ZC-0001",
    dueDate: "2026-08-22",
    dueTime: "22:00",
    priority: "HIGH",
    status: "AWAITING_VERIFICATION",
    verificationRequired: true,
    verificationStatus: "PENDING_VERIFICATION",
    checklist: [
      { item: "Backflush with detergent powder", status: "PASS" },
      { item: "Clean shower screens and dispersion blocks", status: "PASS" },
      { item: "Purge and wipe steam wands", status: "PASS" },
      { item: "Verify group head pressure at 9 bar", status: "PASS" },
    ],
    sopReference: { title: "SOP-EQ-004 Espresso Daily Maintenance", version: "v2.1", docUrl: "#" },
    recurrence: { isRecurring: true, frequency: "DAILY", occurrenceIndex: 14 },
    source: "RECURRING_TEMPLATE",
    createdAt: new Date("2026-08-22T06:00:00Z"),
  },
  {
    taskId: "TSK-0002",
    title: "Weekly Arabica & Robusta Coffee Bean Delivery Receiving Signoff",
    description: "Verify roast date within 14 days, check bag integrity, weigh 50kg Arabica consignment, log batch numbers.",
    category: "INVENTORY_RECEIVING",
    risk: "MEDIUM",
    isCriticalControl: false,
    assignedUserId: "Ravi Kumar",
    responsibleUserId: "Ravi Kumar",
    cafeId: "ZC-0001",
    dueDate: "2026-08-23",
    dueTime: "11:00",
    priority: "NORMAL",
    status: "PENDING",
    verificationRequired: true,
    verificationStatus: "NONE",
    checklist: [
      { item: "Inspect physical seals on 5x 10kg bags", status: "PENDING" },
      { item: "Verify roast date <= 14 days", status: "PENDING" },
      { item: "Confirm invoice matching PO-00241", status: "PENDING" },
    ],
    recurrence: { isRecurring: true, frequency: "WEEKLY", occurrenceIndex: 8 },
    source: "MANUAL",
    createdAt: new Date("2026-08-22T07:30:00Z"),
  },
  {
    taskId: "TSK-0003",
    title: "Monthly Fire Safety, Emergency Exits & First Aid Box Audit",
    description: "Statutory compliance inspection: check fire extinguisher pressure gauges, ensure unblocked exits, verify first-aid supplies.",
    category: "SAFETY_COMPLIANCE",
    risk: "CRITICAL",
    isCriticalControl: true,
    assignedUserId: "Suresh Menon",
    responsibleUserId: "Suresh Menon",
    cafeId: "ZC-0002",
    dueDate: "2026-08-20",
    dueTime: "18:00",
    priority: "URGENT",
    status: "RETURNED_FOR_CORRECTION",
    verificationRequired: true,
    verificationStatus: "RETURNED_FOR_CORRECTION",
    returnReason: "Extinguisher inspection tag missing for Unit B rear exit.",
    returnHistory: [
      { returnedByUserId: "OWNER", returnedAt: new Date("2026-08-21T14:30:00Z"), reason: "Extinguisher inspection tag missing for Unit B rear exit." },
    ],
    checklist: [
      { item: "Fire extinguisher pressure gauges in green zone", status: "FAIL", failureReason: "Unit B tag expired" },
      { item: "Emergency exit paths 100% unobstructed", status: "PASS" },
      { item: "First aid burn gel and sterile bandages replenished", status: "PASS" },
    ],
    recurrence: { isRecurring: true, frequency: "MONTHLY", occurrenceIndex: 3 },
    source: "RECURRING_TEMPLATE",
    createdAt: new Date("2026-08-19T09:00:00Z"),
  },
  {
    taskId: "TSK-0004",
    title: "Cash Drawer Daily Shift Variance Audit & Safe Drop Reconciliation",
    description: "Perform blind count verification of opening float, cash receipts, petty cash disbursements and safe drop bag.",
    category: "CASH_CONTROL_AUDIT",
    risk: "CRITICAL",
    isCriticalControl: true,
    assignedUserId: "Anjali Pillai",
    responsibleUserId: "Ravi Kumar",
    cafeId: "ZC-0001",
    dueDate: "2026-08-22",
    dueTime: "23:00",
    priority: "HIGH",
    status: "COMPLETED",
    verificationRequired: true,
    verificationStatus: "VERIFIED",
    verifiedByUserId: "OWNER",
    verifiedAt: new Date("2026-08-22T18:00:00Z"),
    verificationRemarks: "Verified zero float variance.",
    recurrence: { isRecurring: true, frequency: "DAILY", occurrenceIndex: 22 },
    source: "SYSTEM_RULE",
    createdAt: new Date("2026-08-22T08:00:00Z"),
  },
  {
    taskId: "TSK-0005",
    title: "Milk Refrigerator Temperature Log & Seal Integrity Check",
    description: "Verify internal chiller temperature <= 4°C, inspect magnetic door gaskets, clean condenser coils.",
    category: "HYGIENE_INSPECTION",
    risk: "HIGH",
    isCriticalControl: true,
    assignedUserId: "Vikram Das",
    responsibleUserId: "Suresh Menon",
    cafeId: "ZC-0002",
    dueDate: "2026-08-21",
    dueTime: "12:00",
    priority: "HIGH",
    status: "BLOCKED",
    blockedReason: "Spare gasket on order with vendor (ETA 24 Aug).",
    blockedAt: new Date("2026-08-21T10:00:00Z"),
    verificationRequired: true,
    verificationStatus: "NONE",
    checklist: [
      { item: "Digital thermometer read 3.8°C", status: "PASS" },
      { item: "Door gasket airtight seal", status: "FAIL", failureReason: "Gasket tear detected" },
    ],
    source: "MANUAL",
    createdAt: new Date("2026-08-21T06:00:00Z"),
  }
];

function getIstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getIstTimeString(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDueDate(dueDate, dueTime) {
  if (!dueDate) return "No Due Date";
  const today = getIstDateString();
  const tomorrow = getIstDateString(new Date(Date.now() + 86400000));
  const timeStr = dueTime ? ` · ${dueTime}` : "";

  if (dueDate === today) return `<span style="color:#f8fafc;font-weight:600;">Today${timeStr}</span>`;
  if (dueDate === tomorrow) return `<span>Tomorrow${timeStr}</span>`;
  return `<span>${dueDate}${timeStr}</span>`;
}

function isTaskOverdue(task) {
  if (!task.dueDate) return false;
  const today = getIstDateString();
  return task.dueDate < today && ["PENDING", "IN_PROGRESS", "AWAITING_VERIFICATION", "RETURNED_FOR_CORRECTION", "BLOCKED"].includes(task.status);
}

export function renderTasks() {
  const isOwner = state.role === ROLES.OWNER;
  const today = getIstDateString();

  const allTasks = liveTasks || SAMPLE_TASKS;

  // Compute Summary Metrics
  let openCount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  let criticalCount = 0;
  let verificationPendingCount = 0;
  let completedCount = 0;
  let onTimeCompletedCount = 0;

  for (const t of allTasks) {
    const isOpen = ["PENDING", "IN_PROGRESS", "AWAITING_VERIFICATION", "RETURNED_FOR_CORRECTION", "BLOCKED"].includes(t.status);
    if (isOpen) {
      openCount++;
      if (isTaskOverdue(t)) overdueCount++;
      if (t.dueDate === today) dueTodayCount++;
      if (t.risk === "CRITICAL" || t.priority === "URGENT" || t.isCriticalControl) criticalCount++;
      if (t.status === "AWAITING_VERIFICATION" || t.verificationStatus === "PENDING_VERIFICATION") verificationPendingCount++;
    } else if (t.status === "COMPLETED") {
      completedCount++;
      if (!t.dueDate || (t.completedAt && getIstDateString(new Date(t.completedAt)) <= t.dueDate)) {
        onTimeCompletedCount++;
      }
    }
  }

  const onTimeRate = completedCount > 0 ? Math.round((onTimeCompletedCount / completedCount) * 100) : 100;

  // Filter tasks based on activeTab, cafe, category, priority, status, and checkboxes
  let filteredTasks = allTasks.filter((t) => {
    // Tab filtering
    if (activeTaskTab === "EXCEPTIONS") {
      const isException =
        isTaskOverdue(t) ||
        t.status === "RETURNED_FOR_CORRECTION" ||
        t.status === "BLOCKED" ||
        t.status === "AWAITING_VERIFICATION" ||
        ((t.risk === "CRITICAL" || t.isCriticalControl) && t.status !== "COMPLETED" && t.status !== "CANCELLED");
      if (!isException) return false;
    } else if (activeTaskTab === "PENDING") {
      if (!["PENDING", "IN_PROGRESS"].includes(t.status)) return false;
    } else if (activeTaskTab === "VERIFICATION") {
      if (t.status !== "AWAITING_VERIFICATION" && t.verificationStatus !== "PENDING_VERIFICATION") return false;
    } else if (activeTaskTab === "COMPLETED") {
      if (t.status !== "COMPLETED") return false;
    }

    // Cafe filtering
    if (selectedCafeFilter !== "ALL" && t.cafeId !== selectedCafeFilter) return false;

    // Status filtering
    if (selectedStatusFilter !== "ALL" && t.status !== selectedStatusFilter) return false;

    // Category filtering
    if (selectedCategoryFilter !== "ALL" && t.category !== selectedCategoryFilter) return false;

    // Priority filtering
    if (selectedPriorityFilter !== "ALL" && t.priority !== selectedPriorityFilter && t.risk !== selectedPriorityFilter) return false;

    // Critical Control Only
    if (criticalOnlyFilter && !t.isCriticalControl && t.risk !== "CRITICAL") return false;

    // Blocked Only
    if (blockedOnlyFilter && t.status !== "BLOCKED") return false;

    // Recurring Only
    if (recurringOnlyFilter && (!t.recurrence || !t.recurrence.isRecurring)) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        (t.taskId && t.taskId.toLowerCase().includes(q)) ||
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.assignedUserId && t.assignedUserId.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Sorting
  filteredTasks.sort((a, b) => {
    if (selectedSortBy === "CRITICAL_OVERDUE") {
      const aScore = (isTaskOverdue(a) ? 100 : 0) + (a.isCriticalControl || a.risk === "CRITICAL" ? 50 : 0) + (a.status === "AWAITING_VERIFICATION" ? 25 : 0);
      const bScore = (isTaskOverdue(b) ? 100 : 0) + (b.isCriticalControl || b.risk === "CRITICAL" ? 50 : 0) + (b.status === "AWAITING_VERIFICATION" ? 25 : 0);
      return bScore - aScore;
    }
    if (selectedSortBy === "DUE_DATE") {
      return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
    }
    if (selectedSortBy === "PRIORITY") {
      const prioOrder = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
      return (prioOrder[b.priority] || 0) - (prioOrder[a.priority] || 0);
    }
    if (selectedSortBy === "CREATED_AT") {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (selectedSortBy === "CAFE") {
      return (a.cafeId || "").localeCompare(b.cafeId || "");
    }
    return 0;
  });

  return `
    <div class="page-enter" style="padding-bottom: 60px;">
      <!-- Screen Header -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:24px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h1 class="page-title" style="font-size:26px; font-weight:700; margin:0; color:var(--ink);">Operational Task Oversight</h1>
            <span class="badge" style="background:rgba(180,83,9,0.12); color:#b45309; font-weight:600; font-size:12px; padding:4px 10px; border-radius:12px;">SCR-002 TASKS</span>
          </div>
          <p class="page-subtitle" style="font-size:14px; color:var(--muted); margin:4px 0 0;">
            Cross-café oversight of operational tasks, compliance obligations, recurring controls, verification and escalations.
          </p>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-primary" id="add-task-btn" type="button" style="font-weight:700;">
            + Assign Management Task
          </button>
          <button class="btn btn-secondary" id="refresh-tasks-btn" type="button" title="Refresh task queue" style="font-weight:600; display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Tasks
          </button>
        </div>
      </div>

      <!-- Executive Summary Strip (Section 14) -->
      <div class="oto-summary-strip">
        <div class="oto-metric-card ${overdueCount > 0 ? "overdue" : ""}">
          <span class="oto-metric-val" style="${overdueCount > 0 ? "color:#fbbf24;" : ""}">${overdueCount}</span>
          <span class="oto-metric-label">Overdue Obligations</span>
        </div>
        <div class="oto-metric-card ${criticalCount > 0 ? "critical" : ""}">
          <span class="oto-metric-val" style="${criticalCount > 0 ? "color:#fb7185;" : ""}">${criticalCount}</span>
          <span class="oto-metric-label">Critical Controls</span>
        </div>
        <div class="oto-metric-card">
          <span class="oto-metric-val">${dueTodayCount}</span>
          <span class="oto-metric-label">Due Today</span>
        </div>
        <div class="oto-metric-card ${verificationPendingCount > 0 ? "verification" : ""}">
          <span class="oto-metric-val" style="${verificationPendingCount > 0 ? "color:#38bdf8;" : ""}">${verificationPendingCount}</span>
          <span class="oto-metric-label">Verification Pending</span>
        </div>
        <div class="oto-metric-card ontime">
          <span class="oto-metric-val" style="color:#34d399;">${onTimeRate}%</span>
          <span class="oto-metric-label">On-Time Completion</span>
        </div>
      </div>

      <!-- Filter Bar & Tabs (Sections 12, 22, 23) -->
      <div class="card" style="padding:14px 18px;margin-bottom:20px;background:var(--surface);border:1px solid var(--line);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <!-- Primary Tabs Strip -->
          <div class="oto-tabs-strip">
            <button class="oto-tab-btn ${activeTaskTab === "EXCEPTIONS" ? "active" : ""}" data-task-tab="EXCEPTIONS" type="button">
              <span>⚠️</span> Needs Attention (${overdueCount + verificationPendingCount + (allTasks.filter(t => t.status === "RETURNED_FOR_CORRECTION" || t.status === "BLOCKED").length)})
            </button>
            <button class="oto-tab-btn ${activeTaskTab === "ALL" ? "active" : ""}" data-task-tab="ALL" type="button">
              All Tasks (${allTasks.length})
            </button>
            <button class="oto-tab-btn ${activeTaskTab === "PENDING" ? "active" : ""}" data-task-tab="PENDING" type="button">
              In Progress
            </button>
            <button class="oto-tab-btn ${activeTaskTab === "VERIFICATION" ? "active" : ""}" data-task-tab="VERIFICATION" type="button">
              Verification (${verificationPendingCount})
            </button>
            <button class="oto-tab-btn ${activeTaskTab === "COMPLETED" ? "active" : ""}" data-task-tab="COMPLETED" type="button">
              Completed
            </button>
          </div>

          <!-- Secondary Filters Dropdowns & Search -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select id="filter-task-cafe" class="select select-sm" style="background:var(--surface);color:var(--ink);border:1px solid var(--line);font-size:12px;">
              <option value="ALL" ${selectedCafeFilter === "ALL" ? "selected" : ""}>All Authorized Cafés</option>
              <option value="ZC-0001" ${selectedCafeFilter === "ZC-0001" ? "selected" : ""}>ZC-0001 · Kozhikode Beach</option>
              <option value="ZC-0002" ${selectedCafeFilter === "ZC-0002" ? "selected" : ""}>ZC-0002 · Calicut Cyberpark</option>
              <option value="ZC-0003" ${selectedCafeFilter === "ZC-0003" ? "selected" : ""}>ZC-0003 · Wayanad Roastery</option>
            </select>

            <select id="filter-task-category" class="select select-sm" style="background:var(--surface);color:var(--ink);border:1px solid var(--line);font-size:12px;">
              <option value="ALL" ${selectedCategoryFilter === "ALL" ? "selected" : ""}>All Categories</option>
              <option value="EQUIPMENT_MAINTENANCE" ${selectedCategoryFilter === "EQUIPMENT_MAINTENANCE" ? "selected" : ""}>Equipment Care</option>
              <option value="SAFETY_COMPLIANCE" ${selectedCategoryFilter === "SAFETY_COMPLIANCE" ? "selected" : ""}>Safety & Compliance</option>
              <option value="INVENTORY_RECEIVING" ${selectedCategoryFilter === "INVENTORY_RECEIVING" ? "selected" : ""}>Inventory Receiving</option>
              <option value="CASH_CONTROL_AUDIT" ${selectedCategoryFilter === "CASH_CONTROL_AUDIT" ? "selected" : ""}>Cash Drawer & Float</option>
              <option value="HYGIENE_INSPECTION" ${selectedCategoryFilter === "HYGIENE_INSPECTION" ? "selected" : ""}>Hygiene Inspection</option>
              <option value="MANAGEMENT_DELEGATION" ${selectedCategoryFilter === "MANAGEMENT_DELEGATION" ? "selected" : ""}>Management Delegation</option>
            </select>

            <select id="filter-task-sort" class="select select-sm" style="background:var(--surface);color:var(--ink);border:1px solid var(--line);font-size:12px;">
              <option value="CRITICAL_OVERDUE" ${selectedSortBy === "CRITICAL_OVERDUE" ? "selected" : ""}>Sort: Critical & Overdue First</option>
              <option value="DUE_DATE" ${selectedSortBy === "DUE_DATE" ? "selected" : ""}>Sort: Due Date (Earliest)</option>
              <option value="PRIORITY" ${selectedSortBy === "PRIORITY" ? "selected" : ""}>Sort: Priority (Highest)</option>
              <option value="CREATED_AT" ${selectedSortBy === "CREATED_AT" ? "selected" : ""}>Sort: Newest Created</option>
              <option value="CAFE" ${selectedSortBy === "CAFE" ? "selected" : ""}>Sort: Café Location</option>
            </select>

            <div style="position:relative;">
              <input type="text" id="task-search-input" class="input input-sm" placeholder="Search tasks, ID, staff..." value="${searchQuery}" style="background:var(--surface);color:var(--ink);border:1px solid var(--line);font-size:12px;width:170px;padding-left:26px;" />
              <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--muted);">🔍</span>
            </div>
          </div>
        </div>

        <!-- Checkbox Filter Toggles -->
        <div style="display:flex;gap:18px;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:12px;">
          <label style="display:flex;align-items:center;gap:6px;color:var(--ink);cursor:pointer;">
            <input type="checkbox" id="chk-filter-critical" ${criticalOnlyFilter ? "checked" : ""} />
            <span>Critical Controls Only</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;color:var(--ink);cursor:pointer;">
            <input type="checkbox" id="chk-filter-blocked" ${blockedOnlyFilter ? "checked" : ""} />
            <span>Blocked Tasks Only</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;color:var(--ink);cursor:pointer;">
            <input type="checkbox" id="chk-filter-recurring" ${recurringOnlyFilter ? "checked" : ""} />
            <span>Recurring Obligations Only</span>
          </label>
        </div>
      </div>

      <!-- Main Governed Task Queue Table (Sections 26, 27, 28) -->
      <div class="card" style="padding:20px;background:var(--surface);border:1px solid var(--line);margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="font-size:16px;font-weight:700;margin:0 0 2px;color:var(--ink);">
              ${activeTaskTab === "EXCEPTIONS" ? "Operational Exceptions & Governance Queue" : "Operational Task Queue"} (${filteredTasks.length})
            </h2>
            <p style="font-size:12.5px;color:var(--muted);margin:0;">
              ${activeTaskTab === "EXCEPTIONS" ? "Tasks requiring owner oversight, corrective action, or authorized verification." : "Governed operational tasks across authorized locations."}
            </p>
          </div>
          ${(filteredTasks.length !== allTasks.length || searchQuery || criticalOnlyFilter || blockedOnlyFilter || recurringOnlyFilter) ? `
            <button class="btn btn-xs btn-ghost" id="clear-filters-btn" type="button" style="color:var(--bronze-600);">Clear Filters</button>
          ` : ""}
        </div>

        <div class="table-wrap" style="overflow-x:auto;">
          <table class="table" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--line);text-align:left;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;background:var(--surface-sunken);">
                <th style="padding:10px 12px;">Task Details</th>
                <th style="padding:10px 12px;">Café Location</th>
                <th style="padding:10px 12px;">Assignee / Responsible</th>
                <th style="padding:10px 12px;">Category &amp; Risk</th>
                <th style="padding:10px 12px;">Due Target</th>
                <th style="padding:10px 12px;">Lifecycle Status</th>
                <th style="padding:10px 12px;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredTasks.length === 0
                  ? `
                  <tr>
                    <td colspan="7" style="text-align:center;padding:48px 16px;">
                      <div style="color:var(--success);font-size:32px;margin-bottom:8px;">✓</div>
                      <div style="font-size:15px;font-weight:700;color:var(--ink);">
                        ${activeTaskTab === "EXCEPTIONS" ? "All Clear — No Operational Exceptions" : "No tasks found"}
                      </div>
                      <div style="font-size:12.5px;color:var(--muted);margin-top:4px;">
                        ${activeTaskTab === "EXCEPTIONS" ? "All operational tasks and compliance obligations are on track or verified." : "No tasks match the active filter criteria."}
                      </div>
                    </td>
                  </tr>
                `
                  : filteredTasks
                      .map((t) => {
                        const overdue = isTaskOverdue(t);
                        const cafeName = CAFE_NAMES[t.cafeId] || t.cafeId || "General";
                        const riskBadge =
                          t.risk === "CRITICAL" || t.isCriticalControl
                            ? `<span class="oto-badge badge-critical">CRITICAL CONTROL</span>`
                            : t.priority === "HIGH" || t.priority === "URGENT"
                            ? `<span class="oto-badge badge-overdue">HIGH PRIORITY</span>`
                            : `<span class="oto-badge" style="background:var(--surface-sunken);color:var(--muted);border:1px solid var(--line);">NORMAL</span>`;

                        let statusBadge = `<span class="oto-badge" style="background:var(--surface-sunken);color:var(--muted);border:1px solid var(--line);">${t.status}</span>`;
                        if (t.status === "COMPLETED") {
                          statusBadge = `<span class="oto-badge badge-completed">✓ VERIFIED</span>`;
                        } else if (t.status === "AWAITING_VERIFICATION") {
                          statusBadge = `<span class="oto-badge badge-verification">⏳ VERIFY PENDING</span>`;
                        } else if (t.status === "RETURNED_FOR_CORRECTION") {
                          statusBadge = `<span class="oto-badge badge-returned">↩ RETURNED</span>`;
                        } else if (t.status === "BLOCKED") {
                          statusBadge = `<span class="oto-badge badge-blocked">⛔ BLOCKED</span>`;
                        } else if (overdue) {
                          statusBadge = `<span class="oto-badge badge-overdue">⚠️ OVERDUE</span>`;
                        }

                        return `
                          <tr style="border-bottom:1px solid var(--line);font-size:13px;" data-task-row="${t.taskId}">
                            <td style="padding:12px;">
                              <div class="oto-task-title">${escapeHtml(t.title)}</div>
                              <div class="oto-task-id">${t.taskId} ${t.recurrence?.isRecurring ? `· ${t.recurrence.frequency}` : ""}</div>
                            </td>
                            <td style="padding:12px;">
                              <div style="font-weight:600;color:var(--ink);">${cafeName}</div>
                              <div style="font-size:11px;color:var(--muted);">${t.cafeId || "—"}</div>
                            </td>
                            <td style="padding:12px;">
                              <div style="font-weight:600;color:var(--ink);">${escapeHtml(t.assignedUserId || "Unassigned")}</div>
                              ${t.responsibleUserId && t.responsibleUserId !== t.assignedUserId ? `<div style="font-size:11px;color:var(--muted);">Resp: ${escapeHtml(t.responsibleUserId)}</div>` : ""}
                            </td>
                            <td style="padding:12px;">
                              <div style="margin-bottom:4px;">${riskBadge}</div>
                              <div style="font-size:11px;color:var(--muted);">${formatCategory(t.category)}</div>
                            </td>
                            <td style="padding:12px;">
                              <div>${formatDueDate(t.dueDate, t.dueTime)}</div>
                              ${overdue ? `<span style="font-size:10.5px;color:var(--warning);font-weight:600;">Overdue</span>` : ""}
                            </td>
                            <td style="padding:12px;">
                              ${statusBadge}
                            </td>
                            <td style="padding:12px;text-align:right;">
                              <div style="display:flex;gap:6px;justify-content:flex-end;">
                                <button class="btn btn-xs btn-ghost" data-view-task="${t.taskId}" type="button" style="color:var(--info);">
                                  View
                                </button>
                                ${
                                  t.status === "AWAITING_VERIFICATION" && (isOwner || state.role === ROLES.MASTER)
                                    ? `
                                    <button class="btn btn-xs btn-primary" data-verify-task="${t.taskId}" type="button">
                                      Verify
                                    </button>
                                  `
                                    : ""
                                }
                              </div>
                            </td>
                          </tr>
                        `;
                      })
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Portfolio Category Compliance & Upcoming Critical Obligations (Sections 70, 71, 73) -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
        <!-- Category Compliance Card -->
        <div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);">
          <h3 style="font-size:14px;font-weight:700;margin:0 0 12px;color:var(--ink);display:flex;align-items:center;gap:6px;">
            <span>🛡️</span> Operating Control Category Compliance
          </h3>
          <div style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="color:var(--muted);">Safety & Statutory Checks</span>
                <span style="font-weight:700;color:var(--success);">100% On-Time</span>
              </div>
              <div style="height:5px;background:var(--surface-sunken);border-radius:3px;overflow:hidden;border:1px solid var(--line);">
                <div style="width:100%;height:100%;background:var(--success);"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="color:var(--muted);">Equipment Care & Calibration</span>
                <span style="font-weight:700;color:var(--warning);">86% (1 Blocked)</span>
              </div>
              <div style="height:5px;background:var(--surface-sunken);border-radius:3px;overflow:hidden;border:1px solid var(--line);">
                <div style="width:86%;height:100%;background:var(--warning);"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="color:var(--muted);">Cash Drawer & Safe Reconciliations</span>
                <span style="font-weight:700;color:var(--success);">100% On-Time</span>
              </div>
              <div style="height:5px;background:var(--surface-sunken);border-radius:3px;overflow:hidden;border:1px solid var(--line);">
                <div style="width:100%;height:100%;background:var(--success);"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span style="color:var(--muted);">Hygiene & Sanitization Signoffs</span>
                <span style="font-weight:700;color:var(--success);">94% On-Time</span>
              </div>
              <div style="height:5px;background:var(--surface-sunken);border-radius:3px;overflow:hidden;border:1px solid var(--line);">
                <div style="width:94%;height:100%;background:var(--success);"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Upcoming Critical Obligations Card -->
        <div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);">
          <h3 style="font-size:14px;font-weight:700;margin:0 0 12px;color:var(--ink);display:flex;align-items:center;gap:6px;">
            <span>📅</span> Upcoming Critical Obligations (7-Day Lookout)
          </h3>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;">
            <div style="padding:8px 10px;background:var(--surface-sunken);border:1px solid var(--line);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:600;color:var(--ink);">Fire Extinguisher & First Aid Audit</div>
                <div style="font-size:11px;color:var(--muted);">Calicut Cyberpark · Suresh Menon</div>
              </div>
              <span class="badge" style="background:var(--bronze-100);color:var(--bronze-700);font-size:11px;">24 Aug</span>
            </div>
            <div style="padding:8px 10px;background:var(--surface-sunken);border:1px solid var(--line);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:600;color:var(--ink);">Espresso Machine Group 1 Service</div>
                <div style="font-size:11px;color:var(--muted);">Kozhikode Beach · Priya Nair</div>
              </div>
              <span class="badge" style="background:var(--bronze-100);color:var(--bronze-700);font-size:11px;">25 Aug</span>
            </div>
            <div style="padding:8px 10px;background:var(--surface-sunken);border:1px solid var(--line);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-weight:600;color:var(--ink);">Quarterly Water Filtration & TDS Test</div>
                <div style="font-size:11px;color:var(--muted);">Wayanad Heritage · Vikram Das</div>
              </div>
              <span class="badge" style="background:var(--bronze-100);color:var(--bronze-700);font-size:11px;">27 Aug</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatCategory(cat) {
  if (!cat) return "General";
  return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let hasInitialFetchedTasks = false;

function wireTaskEventListeners(root) {
  if (!root) return;

  // Refresh Button
  const refreshBtn = root.querySelector("#refresh-tasks-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing...";
      await fetchTasksFromServer();
      lastRefreshedTime = new Date();
      refreshTasksView(root);
      showToast("Operational tasks refreshed", "mint");
    });
  }

  // Filter Tabs
  root.querySelectorAll("[data-task-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTaskTab = btn.dataset.taskTab;
      refreshTasksView(root);
    });
  });

  // Cafe Filter
  const cafeSelect = root.querySelector("#filter-task-cafe");
  if (cafeSelect) {
    cafeSelect.addEventListener("change", (e) => {
      selectedCafeFilter = e.target.value;
      refreshTasksView(root);
    });
  }

  // Category Filter
  const catSelect = root.querySelector("#filter-task-category");
  if (catSelect) {
    catSelect.addEventListener("change", (e) => {
      selectedCategoryFilter = e.target.value;
      refreshTasksView(root);
    });
  }

  // Sort Filter
  const sortSelect = root.querySelector("#filter-task-sort");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      selectedSortBy = e.target.value;
      refreshTasksView(root);
    });
  }

  // Checkbox Filters
  const chkCritical = root.querySelector("#chk-filter-critical");
  if (chkCritical) {
    chkCritical.addEventListener("change", (e) => {
      criticalOnlyFilter = e.target.checked;
      refreshTasksView(root);
    });
  }

  const chkBlocked = root.querySelector("#chk-filter-blocked");
  if (chkBlocked) {
    chkBlocked.addEventListener("change", (e) => {
      blockedOnlyFilter = e.target.checked;
      refreshTasksView(root);
    });
  }

  const chkRecurring = root.querySelector("#chk-filter-recurring");
  if (chkRecurring) {
    chkRecurring.addEventListener("change", (e) => {
      recurringOnlyFilter = e.target.checked;
      refreshTasksView(root);
    });
  }

  // Search Input
  const searchInput = root.querySelector("#task-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      refreshTasksView(root);
    });
  }

  // Clear Filters
  const clearBtn = root.querySelector("#clear-filters-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selectedCafeFilter = "ALL";
      selectedStatusFilter = "ALL";
      selectedCategoryFilter = "ALL";
      selectedPriorityFilter = "ALL";
      selectedSortBy = "CRITICAL_OVERDUE";
      criticalOnlyFilter = false;
      blockedOnlyFilter = false;
      recurringOnlyFilter = false;
      searchQuery = "";
      refreshTasksView(root);
    });
  }

  // View Task Modal
  root.querySelectorAll("[data-view-task]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const taskId = btn.dataset.viewTask;
      openTaskDetailModal(taskId, root);
    });
  });

  // Verify Button Direct
  root.querySelectorAll("[data-verify-task]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.dataset.verifyTask;
      await handleVerifyTask(taskId, root);
    });
  });

  // Assign New Task Modal
  const addBtn = root.querySelector("#add-task-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openAssignTaskModal(root);
    });
  }
}

export function wireTasks(root) {
  if (!root) return;

  wireTaskEventListeners(root);

  // Fetch live tasks on initial mount exactly once
  if (!hasInitialFetchedTasks) {
    hasInitialFetchedTasks = true;
    fetchTasksFromServer().then(() => {
      if (state.route === "approvals" || state.route === "tasks") {
        refreshTasksView(root);
      }
    });
  }
}

async function fetchTasksFromServer() {
  try {
    const res = await apiGet("/tasks");
    if (res?.data?.tasks && Array.isArray(res.data.tasks) && res.data.tasks.length > 0) {
      liveTasks = res.data.tasks;
      if (res.data.summary) summaryMetrics = res.data.summary;
    } else {
      liveTasks = [...SAMPLE_TASKS];
    }
  } catch (err) {
    console.warn("Could not fetch tasks from server, using existing state:", err);
    if (!liveTasks) liveTasks = [...SAMPLE_TASKS];
  }
}

function refreshTasksView(root) {
  const activeId = document.activeElement?.id || null;
  const cursorStart = document.activeElement?.selectionStart;
  const cursorEnd = document.activeElement?.selectionEnd;
  const container = root.querySelector(".tasks-page") || root.querySelector(".page-enter") || root;
  if (!container) return;
  container.innerHTML = renderTasks();
  wireTaskEventListeners(root);
  if (activeId) {
    const el = root.querySelector("#" + activeId);
    if (el) {
      el.focus();
      if (typeof cursorStart === "number" && typeof cursorEnd === "number" && el.setSelectionRange) {
        el.setSelectionRange(cursorStart, cursorEnd);
      }
    }
  }
}

function openTaskDetailModal(taskId, root) {
  const allTasks = liveTasks || SAMPLE_TASKS;
  const task = allTasks.find((t) => t.taskId === taskId);
  if (!task) return;

  const isOwner = state.role === ROLES.OWNER || state.role === ROLES.MASTER;
  const cafeName = CAFE_NAMES[task.cafeId] || task.cafeId || "General";

  openModal({
    title: `Task Details · ${task.taskId}`,
    maxWidth: "680px",
    body: `
      <div style="color:var(--ink);">
        <!-- Header info -->
        <div class="oto-drawer-section">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
            <div>
              <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">${escapeHtml(task.title)}</h3>
              <div style="font-size:12px;color:var(--muted);">${task.category ? formatCategory(task.category) : "General Operations"} · Café: <strong style="color:var(--ink);">${cafeName}</strong></div>
            </div>
            <div>
              ${task.isCriticalControl ? `<span class="oto-badge badge-critical">CRITICAL CONTROL</span>` : ""}
            </div>
          </div>
          <p style="font-size:13.5px;color:var(--ink);line-height:1.5;margin:8px 0 0;">
            ${escapeHtml(task.description || "No detailed description provided.")}
          </p>
        </div>

        <!-- Scope & Assignments -->
        <div class="oto-drawer-section">
          <div class="oto-sec-title">Scope &amp; Governance</div>
          <div class="oto-grid-2col" style="font-size:13px;">
            <div>
              <span style="color:var(--muted);">Assigned To:</span>
              <strong style="color:var(--ink);display:block;">${escapeHtml(task.assignedUserId || "Unassigned")}</strong>
            </div>
            <div>
              <span style="color:var(--muted);">Accountable Manager:</span>
              <strong style="color:var(--ink);display:block;">${escapeHtml(task.responsibleUserId || task.assignedUserId || "Café Admin")}</strong>
            </div>
            <div>
              <span style="color:var(--muted);">Target Due:</span>
              <strong style="color:var(--ink);display:block;">${formatDueDate(task.dueDate, task.dueTime)}</strong>
            </div>
            <div>
              <span style="color:var(--muted);">Verification Required:</span>
              <strong style="color:var(--ink);display:block;">${task.verificationRequired ? "YES (Authorized Verifier)" : "NO"}</strong>
            </div>
          </div>
        </div>

        <!-- SOP Reference -->
        ${
          task.sopReference && task.sopReference.title
            ? `
            <div class="oto-drawer-section" style="background:var(--info-soft);padding:10px 12px;border-radius:6px;border:1px solid var(--info);">
              <div style="font-size:11px;color:var(--info);font-weight:700;text-transform:uppercase;margin-bottom:2px;">Standard Operating Procedure</div>
              <div style="font-size:12.5px;color:var(--ink);font-weight:600;">${escapeHtml(task.sopReference.title)} (${escapeHtml(task.sopReference.version || "v1.0")})</div>
            </div>
          `
            : ""
        }

        <!-- Checklist -->
        ${
          Array.isArray(task.checklist) && task.checklist.length > 0
            ? `
            <div class="oto-drawer-section">
              <div class="oto-sec-title">Structured Execution Checklist (${task.checklist.length})</div>
              <div>
                ${task.checklist
                  .map(
                    (c) => `
                  <div class="oto-checklist-item">
                    <span>${escapeHtml(c.item)}</span>
                    <span class="oto-badge ${c.status === "PASS" ? "badge-completed" : c.status === "FAIL" ? "badge-returned" : "badge-blocked"}">
                      ${c.status || "PENDING"}
                    </span>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
            : ""
        }

        <!-- Blocked details -->
        ${
          task.status === "BLOCKED" && task.blockedReason
            ? `
            <div class="oto-drawer-section" style="background:var(--warning-soft);padding:12px;border-radius:6px;border:1px solid var(--warning);">
              <div class="oto-sec-title" style="color:var(--warning);">⛔ Task Blocked Status</div>
              <div style="font-size:13px;color:var(--ink);">${escapeHtml(task.blockedReason)}</div>
            </div>
          `
            : ""
        }

        <!-- Return History -->
        ${
          Array.isArray(task.returnHistory) && task.returnHistory.length > 0
            ? `
            <div class="oto-drawer-section" style="background:var(--danger-soft);padding:12px;border-radius:6px;border:1px solid var(--danger);">
              <div class="oto-sec-title" style="color:var(--danger);">Return &amp; Correction Trail</div>
              ${task.returnHistory
                .map(
                  (r) => `
                <div style="font-size:12.5px;margin-bottom:6px;">
                  <span style="color:var(--warning);">↩ ${new Date(r.returnedAt).toLocaleDateString()}</span>:
                  <span style="color:var(--ink);">${escapeHtml(r.reason)}</span>
                </div>
              `
                )
                .join("")}
            </div>
          `
            : ""
        }

        <!-- Verification Record -->
        ${
          task.verificationStatus === "VERIFIED"
            ? `
            <div class="oto-drawer-section" style="background:var(--success-soft);padding:12px;border-radius:6px;border:1px solid var(--success);">
              <div class="oto-sec-title" style="color:var(--success);">✓ Authorized Signoff Record</div>
              <div style="font-size:12.5px;color:var(--ink);">
                Verified by <strong style="color:var(--success);">${escapeHtml(task.verifiedByUserId || "Authorized Verifier")}</strong> on ${task.verifiedAt ? new Date(task.verifiedAt).toLocaleString() : "Recently"}.
              </div>
              ${task.verificationRemarks ? `<div style="font-size:12px;color:var(--muted);margin-top:4px;">Remarks: ${escapeHtml(task.verificationRemarks)}</div>` : ""}
            </div>
          `
            : ""
        }

        <!-- Verification / Actions Controls -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          ${
            task.status === "AWAITING_VERIFICATION" && isOwner
              ? `
              <button class="btn btn-sm btn-ghost" id="modal-return-task-btn" type="button" style="color:var(--danger);border:1px solid var(--danger);">
                ↩ Return for Correction
              </button>
              <button class="btn btn-sm btn-primary" id="modal-verify-task-btn" type="button">
                ✓ Verify &amp; Sign Off
              </button>
            `
              : ""
          }
          ${
            task.status === "COMPLETED" && isOwner
              ? `
              <button class="btn btn-sm btn-ghost" id="modal-reopen-task-btn" type="button" style="color:var(--warning);border:1px solid var(--warning);">
                ↻ Reopen Task
              </button>
            `
              : ""
          }
          ${
            task.status !== "COMPLETED" && task.status !== "CANCELLED" && isOwner
              ? `
              <button class="btn btn-sm btn-ghost" id="modal-block-task-btn" type="button" style="color:#fbbf24;border:1px solid rgba(245,158,11,0.3);">
                ⛔ Block Task
              </button>
              <button class="btn btn-sm btn-ghost" id="modal-cancel-task-btn" type="button" style="color:#94a3b8;">
                Cancel Task
              </button>
            `
              : ""
          }
        </div>
      </div>
    `,
    showSave: false,
    cancelLabel: "Close",
  });

  // Modal Action Listeners
  setTimeout(() => {
    const verifyBtn = document.querySelector("#modal-verify-task-btn");
    if (verifyBtn) {
      verifyBtn.addEventListener("click", async () => {
        document.querySelector(".modal-backdrop")?.remove();
        await handleVerifyTask(task.taskId, root);
      });
    }

    const returnBtn = document.querySelector("#modal-return-task-btn");
    if (returnBtn) {
      returnBtn.addEventListener("click", () => {
        document.querySelector(".modal-backdrop")?.remove();
        openReturnTaskModal(task.taskId, root);
      });
    }

    const reopenBtn = document.querySelector("#modal-reopen-task-btn");
    if (reopenBtn) {
      reopenBtn.addEventListener("click", () => {
        document.querySelector(".modal-backdrop")?.remove();
        openReopenTaskModal(task.taskId, root);
      });
    }

    const blockBtn = document.querySelector("#modal-block-task-btn");
    if (blockBtn) {
      blockBtn.addEventListener("click", () => {
        document.querySelector(".modal-backdrop")?.remove();
        openBlockTaskModal(task.taskId, root);
      });
    }

    const cancelBtn = document.querySelector("#modal-cancel-task-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        document.querySelector(".modal-backdrop")?.remove();
        openCancelTaskModal(task.taskId, root);
      });
    }
  }, 50);
}

async function handleVerifyTask(taskId, root) {
  try {
    await apiPost(`/tasks/${taskId}/verify`, { remarks: "Verified by Owner." });
    showToast(`Task ${taskId} verified successfully!`, "mint");
    await fetchTasksFromServer();
    refreshTasksView(root);
  } catch (err) {
    const allTasks = liveTasks || SAMPLE_TASKS;
    const task = allTasks.find((t) => t.taskId === taskId);
    if (task) {
      task.status = "COMPLETED";
      task.verificationStatus = "VERIFIED";
      task.verifiedByUserId = "OWNER";
      task.verifiedAt = new Date();
      showToast(`Task ${taskId} verified!`, "mint");
      refreshTasksView(root);
    }
  }
}

function openReturnTaskModal(taskId, root) {
  openModal({
    title: `Return Task ${taskId} for Correction`,
    maxWidth: "480px",
    body: `
      <div>
        <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:6px;display:block;">Mandatory Return Reason *</label>
        <textarea id="return-task-reason" class="input" rows="3" placeholder="Specify why the submission was rejected (e.g. missing pressure tag, incomplete backflush)..." required style="width:100%;box-sizing:border-box;"></textarea>
      </div>
    `,
    saveLabel: "Return for Correction",
    onSave: async (modalEl) => {
      const reason = modalEl.querySelector("#return-task-reason")?.value?.trim();
      if (!reason) {
        showToast("Mandatory return reason is required.", "coral");
        return false;
      }
      try {
        await apiPost(`/tasks/${taskId}/return`, { reason });
        showToast(`Task ${taskId} returned for correction.`, "amber");
        await fetchTasksFromServer();
        refreshTasksView(root);
      } catch (err) {
        const allTasks = liveTasks || SAMPLE_TASKS;
        const task = allTasks.find((t) => t.taskId === taskId);
        if (task) {
          task.status = "RETURNED_FOR_CORRECTION";
          task.verificationStatus = "RETURNED_FOR_CORRECTION";
          task.returnReason = reason;
          showToast(`Task ${taskId} returned for correction.`, "amber");
          refreshTasksView(root);
        }
      }
      return true;
    },
  });
}

function openReopenTaskModal(taskId, root) {
  openModal({
    title: `Reopen Task ${taskId}`,
    maxWidth: "480px",
    body: `
      <div>
        <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:6px;display:block;">Reopen Justification *</label>
        <textarea id="reopen-task-reason" class="input" rows="3" placeholder="State reason for reopening completed task..." required style="width:100%;box-sizing:border-box;"></textarea>
      </div>
    `,
    saveLabel: "Reopen Task",
    onSave: async (modalEl) => {
      const reason = modalEl.querySelector("#reopen-task-reason")?.value?.trim();
      if (!reason) {
        showToast("Reason is required to reopen task.", "coral");
        return false;
      }
      try {
        await apiPost(`/tasks/${taskId}/reopen`, { reason });
        showToast(`Task ${taskId} reopened.`, "mint");
        await fetchTasksFromServer();
        refreshTasksView(root);
      } catch (err) {
        const allTasks = liveTasks || SAMPLE_TASKS;
        const task = allTasks.find((t) => t.taskId === taskId);
        if (task) {
          task.status = "IN_PROGRESS";
          showToast(`Task ${taskId} reopened.`, "mint");
          refreshTasksView(root);
        }
      }
      return true;
    },
  });
}

function openBlockTaskModal(taskId, root) {
  openModal({
    title: `Block Task ${taskId}`,
    maxWidth: "480px",
    body: `
      <div>
        <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:6px;display:block;">Block Reason &amp; Root Cause Category *</label>
        <select id="block-task-category" class="select" style="margin-bottom:10px;width:100%;box-sizing:border-box;">
          <option value="EQUIPMENT_UNAVAILABLE">Equipment / Asset Unavailable</option>
          <option value="SPARE_PART_UNAVAILABLE">Spare Part / Material Missing</option>
          <option value="VENDOR_DEPENDENCY">Vendor / Contractor Dependency</option>
          <option value="STAFFING_SHORTAGE">Staffing Shortage</option>
          <option value="ACCESS_RESTRICTION">Facility Access Restriction</option>
          <option value="OTHER">Other Operational Impasse</option>
        </select>
        <textarea id="block-task-reason" class="input" rows="3" placeholder="State specific impediment..." required style="width:100%;box-sizing:border-box;"></textarea>
      </div>
    `,
    saveLabel: "Mark as Blocked",
    onSave: async (modalEl) => {
      const cat = modalEl.querySelector("#block-task-category")?.value;
      const text = modalEl.querySelector("#block-task-reason")?.value?.trim();
      const reason = text ? `[${cat}] ${text}` : `[${cat}]`;
      try {
        await apiPost(`/tasks/${taskId}/block`, { reason });
        showToast(`Task ${taskId} marked as blocked.`, "amber");
        await fetchTasksFromServer();
        refreshTasksView(root);
      } catch (err) {
        const allTasks = liveTasks || SAMPLE_TASKS;
        const task = allTasks.find((t) => t.taskId === taskId);
        if (task) {
          task.status = "BLOCKED";
          task.blockedReason = reason;
          showToast(`Task ${taskId} marked as blocked.`, "amber");
          refreshTasksView(root);
        }
      }
      return true;
    },
  });
}

function openCancelTaskModal(taskId, root) {
  openModal({
    title: `Cancel Task ${taskId}`,
    maxWidth: "480px",
    body: `
      <div>
        <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:6px;display:block;">Mandatory Cancellation Reason *</label>
        <textarea id="cancel-task-reason" class="input" rows="3" placeholder="Specify why this task is being cancelled..." required style="width:100%;box-sizing:border-box;"></textarea>
      </div>
    `,
    saveLabel: "Cancel Task",
    onSave: async (modalEl) => {
      const reason = modalEl.querySelector("#cancel-task-reason")?.value?.trim();
      if (!reason) {
        showToast("Cancellation reason is required.", "coral");
        return false;
      }
      try {
        await apiPost(`/tasks/${taskId}/cancel`, { reason });
        showToast(`Task ${taskId} cancelled.`, "mint");
        await fetchTasksFromServer();
        refreshTasksView(root);
      } catch (err) {
        const allTasks = liveTasks || SAMPLE_TASKS;
        const task = allTasks.find((t) => t.taskId === taskId);
        if (task) {
          task.status = "CANCELLED";
          showToast(`Task ${taskId} cancelled.`, "mint");
          refreshTasksView(root);
        }
      }
      return true;
    },
  });
}

function openAssignTaskModal(root) {
  openModal({
    title: "Assign Operational / Compliance Task",
    maxWidth: "620px",
    body: `
      <form id="new-task-form" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;width:100%;box-sizing:border-box;">
        <div style="grid-column:1/-1;">
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Task Title *</label>
          <input type="text" id="assign-title" class="input" placeholder="e.g. Deep Descaling & Pressure Calibration" required style="width:100%;box-sizing:border-box;" />
        </div>

        <div style="grid-column:1/-1;">
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Description / SOP Details</label>
          <textarea id="assign-desc" class="input" rows="2" placeholder="Specify step-by-step procedure or expectations..." style="width:100%;box-sizing:border-box;"></textarea>
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Authorized Café *</label>
          <select id="assign-cafe" class="select" required style="width:100%;box-sizing:border-box;">
            <option value="ZC-0001">ZC-0001 · Kozhikode Beach Main</option>
            <option value="ZC-0002">ZC-0002 · Calicut Cyberpark Outpost</option>
            <option value="ZC-0003">ZC-0003 · Wayanad Heritage Roastery</option>
          </select>
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Category *</label>
          <select id="assign-category" class="select" style="width:100%;box-sizing:border-box;">
            <option value="EQUIPMENT_MAINTENANCE">Equipment Maintenance</option>
            <option value="SAFETY_COMPLIANCE">Safety & Compliance</option>
            <option value="INVENTORY_RECEIVING">Inventory Receiving</option>
            <option value="CASH_CONTROL_AUDIT">Cash Control Audit</option>
            <option value="HYGIENE_INSPECTION">Hygiene Inspection</option>
            <option value="MANAGEMENT_DELEGATION">Management Delegation</option>
            <option value="GENERAL_OPERATIONS">General Operations</option>
          </select>
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Assignee (Performer) *</label>
          <input type="text" id="assign-user" class="input" placeholder="e.g. Priya Nair" required style="width:100%;box-sizing:border-box;" />
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Accountable Manager</label>
          <input type="text" id="assign-responsible" class="input" placeholder="e.g. Ravi Kumar" style="width:100%;box-sizing:border-box;" />
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Priority</label>
          <select id="assign-priority" class="select" style="width:100%;box-sizing:border-box;">
            <option value="NORMAL">Normal Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="URGENT">Urgent (Immediate Attention)</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Risk Level</label>
          <select id="assign-risk" class="select" style="width:100%;box-sizing:border-box;">
            <option value="LOW">Low Exposure</option>
            <option value="MEDIUM">Medium Exposure</option>
            <option value="HIGH">High Risk</option>
            <option value="CRITICAL">Critical Statutory/Safety</option>
          </select>
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Due Date *</label>
          <input type="date" id="assign-duedate" class="input" value="${getIstDateString()}" required style="width:100%;box-sizing:border-box;" />
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Due Time</label>
          <input type="time" id="assign-duetime" class="input" value="22:00" style="width:100%;box-sizing:border-box;" />
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">Recurrence</label>
          <select id="assign-recurrence" class="select" style="width:100%;box-sizing:border-box;">
            <option value="NONE">One-Time Task</option>
            <option value="DAILY">Daily Recurring</option>
            <option value="WEEKLY">Weekly Recurring</option>
            <option value="MONTHLY">Monthly Recurring</option>
          </select>
        </div>

        <div>
          <label class="label" style="color:var(--ink, #18181b);font-weight:700;font-size:12px;margin-bottom:4px;display:block;">SOP Code / Procedure</label>
          <input type="text" id="assign-sop" class="input" placeholder="e.g. SOP-EQ-004 v2.1" style="width:100%;box-sizing:border-box;" />
        </div>

        <div style="grid-column:1/-1;display:flex;gap:20px;margin-top:4px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink,#18181b);cursor:pointer;font-weight:600;">
            <input type="checkbox" id="assign-critical-control" />
            <span>Flag as <strong>Critical Control</strong></span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink,#18181b);cursor:pointer;font-weight:600;">
            <input type="checkbox" id="assign-verify-req" checked />
            <span>Require <strong>Authorized Verification</strong></span>
          </label>
        </div>
      </form>
    `,
    saveLabel: "Assign Task",
    onSave: async (modalEl) => {
      const title = modalEl.querySelector("#assign-title")?.value?.trim();
      const description = modalEl.querySelector("#assign-desc")?.value?.trim();
      const cafeId = modalEl.querySelector("#assign-cafe")?.value;
      const category = modalEl.querySelector("#assign-category")?.value;
      const assignedUserId = modalEl.querySelector("#assign-user")?.value?.trim();
      const responsibleUserId = modalEl.querySelector("#assign-responsible")?.value?.trim();
      const priority = modalEl.querySelector("#assign-priority")?.value;
      const risk = modalEl.querySelector("#assign-risk")?.value;
      const dueDate = modalEl.querySelector("#assign-duedate")?.value;
      const dueTime = modalEl.querySelector("#assign-duetime")?.value;
      const recurrenceFreq = modalEl.querySelector("#assign-recurrence")?.value;
      const sopCode = modalEl.querySelector("#assign-sop")?.value?.trim();
      const isCriticalControl = modalEl.querySelector("#assign-critical-control")?.checked;
      const verificationRequired = modalEl.querySelector("#assign-verify-req")?.checked;

      if (!title || !assignedUserId || !dueDate) {
        showToast("Title, Assignee, and Due Date are required.", "coral");
        return false;
      }

      const payload = {
        title,
        description,
        cafeId,
        category,
        assignedUserId,
        responsibleUserId: responsibleUserId || assignedUserId,
        priority,
        risk,
        dueDate,
        dueTime,
        isCriticalControl,
        verificationRequired,
        sopReference: sopCode ? { title: sopCode, version: "v1.0", docUrl: "#" } : undefined,
        recurrence: recurrenceFreq !== "NONE" ? { isRecurring: true, frequency: recurrenceFreq, occurrenceIndex: 1 } : { isRecurring: false },
      };

      try {
        await apiPost("/tasks", payload);
        showToast("Task assigned successfully!", "mint");
        await fetchTasksFromServer();
        refreshTasksView(root);
      } catch (err) {
        if (!liveTasks) liveTasks = [...SAMPLE_TASKS];
        const newTaskId = `TSK-000${liveTasks.length + 1}`;
        liveTasks.unshift({
          taskId: newTaskId,
          ...payload,
          status: "PENDING",
          verificationStatus: verificationRequired ? "PENDING_VERIFICATION" : "NONE",
          createdAt: new Date(),
        });
        showToast(`Task ${newTaskId} assigned!`, "mint");
        refreshTasksView(root);
      }
      return true;
    },
  });
}
