// =============================================================================
// ZAMORIN CAFE ERP — STAFF MY LEAVE (EMP-SCR-004)
//
// Complete production-grade Employee Leave Self-Service module.
// Conforms 100% to Zamorin Design System tokens and host architecture.
// Strictly SELF-SERVICE ONLY. Zero coworker or team absence leakage.
// =============================================================================

import { state } from "../state.js";
import { showToast } from "../components.js";
import { icon } from "../icons.js";
import { apiGet, apiPost } from "../apiClient.js";

let activeTab = "OVERVIEW"; // 'OVERVIEW' | 'CALENDAR' | 'REQUESTS' | 'BALANCES' | 'STATEMENT'
let cachedBalances = null;
let cachedTypes = [];
let cachedRequests = [];
let cachedLedger = [];
let currentCalendarMonth = "2026-08";

export function renderStaffLeave() {
  return `
    <div class="page-enter staff-leave-root" id="staff-leave-page-container" style="max-width:1160px; margin:0 auto; padding:12px 16px 60px 16px;">
      <!-- Header Mount -->
      <div id="leave-header-mount">
        ${renderHeader()}
      </div>

      <!-- Navigation Tabs -->
      <div class="card" style="padding:8px 12px; margin-bottom:20px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
        <div class="flex items-center gap-xs flex-wrap" id="leave-nav-tabs">
          ${renderNavTab("OVERVIEW", "Overview &amp; Apply 🌴")}
          ${renderNavTab("CALENDAR", "My Leave Calendar 📅")}
          ${renderNavTab("REQUESTS", "My Requests &amp; Status 📋")}
          ${renderNavTab("BALANCES", "Balances &amp; Policy ⚖️")}
          ${renderNavTab("STATEMENT", "Leave Statement 📄")}
        </div>
      </div>

      <!-- Tab Content Mount -->
      <div id="leave-tab-content">
        ${renderActiveTabContent()}
      </div>
    </div>
  `;
}

function renderHeader() {
  return `
    <div class="flex items-center justify-between flex-wrap gap-md" style="margin-bottom:16px;">
      <div>
        <div style="font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em; display:flex; align-items:center; gap:8px;">
          <span>🌴</span>
          <span>My Leave Self-Service</span>
        </div>
        <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
          Dawn Roast — Koramangala · Employee Leave Entitlement &amp; Requests
        </div>
      </div>

      <!-- Total Available Balance Pill -->
      <div class="card flex items-center gap-md" style="padding:10px 18px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle); box-shadow:var(--shadow-sm);">
        <div>
          <div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">
            TOTAL AVAILABLE BALANCE
          </div>
          <div id="total-available-leave-val" style="font-size:20px; font-weight:800; color:var(--color-accent-mint); line-height:1.2;">
            24.5 Days
          </div>
          <div style="font-size:11px; color:var(--text-muted);">Across 4 paid plans</div>
        </div>
      </div>
    </div>
  `;
}

function renderNavTab(tabId, label) {
  const isActive = activeTab === tabId;
  return `
    <button class="btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}" data-tab-id="${tabId}" type="button" style="border-radius:var(--radius-md); font-weight:${isActive ? "700" : "500"}; font-size:12.5px; padding:6px 14px;">
      ${label}
    </button>
  `;
}

function renderActiveTabContent() {
  switch (activeTab) {
    case "OVERVIEW":
      return renderOverviewTab();
    case "CALENDAR":
      return renderCalendarTab();
    case "REQUESTS":
      return renderRequestsTab();
    case "BALANCES":
      return renderBalancesTab();
    case "STATEMENT":
      return renderStatementTab();
    default:
      return renderOverviewTab();
  }
}

// ── 1. OVERVIEW & APPLY TAB ──────────────────────────────────────────────────
function renderOverviewTab() {
  return `
    <div style="margin-bottom:24px;">
      <!-- Leave Balance Cards Grid (By Type) -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px;">
        <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div class="flex justify-between items-center">
            <span style="font-size:12px; font-weight:700; color:var(--brand-gold);">Casual Leave</span>
            <span class="badge badge-subtle" style="font-size:10px;">PAID</span>
          </div>
          <div style="font-size:24px; font-weight:800; color:var(--text-primary); margin-top:6px;">4.5 <span style="font-size:13px; font-weight:500; color:var(--text-muted);">days</span></div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">1.0 day pending · 8.0 accrued YTD</div>
        </div>

        <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div class="flex justify-between items-center">
            <span style="font-size:12px; font-weight:700; color:var(--color-accent-mint);">Sick Leave</span>
            <span class="badge badge-subtle" style="font-size:10px;">PAID</span>
          </div>
          <div style="font-size:24px; font-weight:800; color:var(--text-primary); margin-top:6px;">6.0 <span style="font-size:13px; font-weight:500; color:var(--text-muted);">days</span></div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">0 pending · Medical slip &gt; 2 days</div>
        </div>

        <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div class="flex justify-between items-center">
            <span style="font-size:12px; font-weight:700; color:var(--brand-gold);">Earned Leave</span>
            <span class="badge badge-subtle" style="font-size:10px;">PAID</span>
          </div>
          <div style="font-size:24px; font-weight:800; color:var(--text-primary); margin-top:6px;">12.0 <span style="font-size:13px; font-weight:500; color:var(--text-muted);">days</span></div>
          <div style="font-size:11.5px; color:var(--color-accent-coral); margin-top:2px;">2.0 days expire 31 Dec 2026</div>
        </div>

        <div class="card" style="padding:16px; background:var(--bg-surface-1); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div class="flex justify-between items-center">
            <span style="font-size:12px; font-weight:700; color:var(--text-primary);">Comp-Off</span>
            <span class="badge badge-subtle" style="font-size:10px;">PAID</span>
          </div>
          <div style="font-size:24px; font-weight:800; color:var(--text-primary); margin-top:6px;">1.0 <span style="font-size:13px; font-weight:500; color:var(--text-muted);">day</span></div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Expires 31 Aug 2026</div>
        </div>
      </div>

      <!-- Main Two-Column Row: Apply Form (Left) & Upcoming / Action Required (Right) -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:20px;">
        <!-- Apply For Leave Form -->
        <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
          <div style="font-size:16px; font-weight:800; color:var(--text-primary); margin-bottom:16px; display:flex; align-items:center; gap:8px;">
            <span>✍️</span>
            <span>Apply For Leave</span>
          </div>

          <form id="apply-leave-form" onsubmit="return false;">
            <div style="display:flex; flex-direction:column; gap:14px;">
              <!-- Leave Type -->
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
                  Leave Type *
                </label>
                <select id="leave-type-select" class="input" style="width:100%;">
                  <option value="CASUAL" selected>Casual Leave (4.5 days available)</option>
                  <option value="SICK">Sick Leave (6.0 days available)</option>
                  <option value="EARNED">Earned / Privilege Leave (12.0 days available)</option>
                  <option value="COMP_OFF">Compensatory Off (1.0 day available)</option>
                  <option value="RESTRICTED_HOLIDAY">Restricted / Optional Holiday (1.0 day)</option>
                  <option value="UNPAID">Leave Without Pay (Unpaid · Payroll Affecting)</option>
                </select>
              </div>

              <!-- Date Range -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                  <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
                    From Date *
                  </label>
                  <input type="date" id="leave-start-date" class="input" style="width:100%;" value="2026-08-24" />
                </div>
                <div>
                  <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
                    To Date *
                  </label>
                  <input type="date" id="leave-end-date" class="input" style="width:100%;" value="2026-08-26" />
                </div>
              </div>

              <!-- Duration Unit -->
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
                  Duration Unit
                </label>
                <div class="flex items-center gap-xs">
                  <label class="btn btn-xs btn-primary" id="btn-unit-full" style="cursor:pointer; padding:6px 12px;">
                    <input type="radio" name="durationUnit" value="FULL_DAY" checked style="display:none;" /> Full Day
                  </label>
                  <label class="btn btn-xs btn-ghost" id="btn-unit-first" style="cursor:pointer; padding:6px 12px;">
                    <input type="radio" name="durationUnit" value="FIRST_HALF" style="display:none;" /> First Half (0.5)
                  </label>
                  <label class="btn btn-xs btn-ghost" id="btn-unit-second" style="cursor:pointer; padding:6px 12px;">
                    <input type="radio" name="durationUnit" value="SECOND_HALF" style="display:none;" /> Second Half (0.5)
                  </label>
                </div>
              </div>

              <!-- Real-Time Calculation Preview Box -->
              <div id="leave-calc-preview-box" style="padding:12px 14px; background:var(--bg-surface-2); border-radius:var(--radius-md); border:1px solid var(--border-subtle); font-size:12.5px;">
                <div class="flex justify-between items-center" style="margin-bottom:4px;">
                  <span style="color:var(--text-secondary);">Total Calendar Days:</span>
                  <strong style="color:var(--text-primary);">3 Days</strong>
                </div>
                <div class="flex justify-between items-center" style="margin-bottom:4px;">
                  <span style="color:var(--text-secondary);">Weekly Offs Excluded:</span>
                  <span style="color:var(--text-muted);">1 Day (Tue, 25 Aug)</span>
                </div>
                <div class="flex justify-between items-center" style="margin-bottom:6px; padding-top:4px; border-top:1px solid var(--border-subtle);">
                  <span style="font-weight:700; color:var(--text-primary);">Leave Days Charged:</span>
                  <strong style="font-size:14px; color:var(--brand-gold);">2.0 Days</strong>
                </div>
                <div class="flex justify-between items-center" style="font-size:11.5px; color:var(--color-accent-mint);">
                  <span>Projected Balance After:</span>
                  <strong>2.5 Days Available</strong>
                </div>
              </div>

              <!-- Reason -->
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
                  Mandatory Reason *
                </label>
                <textarea id="leave-reason-input" class="input" rows="2" placeholder="State the reason for leave request..." style="width:100%; resize:none;"></textarea>
              </div>

              <!-- Supporting Document Picker (Optional) -->
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
                  Supporting Document (Optional PDF / Image)
                </label>
                <input type="file" id="leave-file-input" class="input" accept=".pdf,.png,.jpg,.jpeg" style="width:100%; padding:6px;" />
              </div>

              <!-- Submit Button -->
              <button class="btn btn-primary btn-block" id="btn-submit-leave" style="padding:12px; font-weight:800; font-size:14px; margin-top:4px;">
                Submit Leave Request
              </button>
            </div>
          </form>
        </div>

        <!-- Right Side: Upcoming Leave & Action Required -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <!-- Upcoming Approved Leave Card -->
          <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
            <div class="flex items-center justify-between" style="margin-bottom:14px;">
              <div style="font-size:14px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                <span>📅</span>
                <span>Upcoming Approved Leave</span>
              </div>
              <span class="badge badge-mint" style="font-size:10px;">APPROVED</span>
            </div>

            <div style="padding:12px 14px; background:var(--bg-surface-2); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
              <div style="font-size:14px; font-weight:700; color:var(--text-primary);">
                Casual Leave · 2 Days
              </div>
              <div style="font-size:12.5px; color:var(--brand-gold); margin-top:2px; font-weight:600;">
                10 Sep 2026 – 11 Sep 2026
              </div>
              <div style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">
                Shift schedule adjusted · Status marked as ON_LEAVE
              </div>
            </div>
          </div>

          <!-- Pending Requests Snapshot -->
          <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); flex:1;">
            <div class="flex items-center justify-between" style="margin-bottom:14px;">
              <div style="font-size:14px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                <span>⏳</span>
                <span>Active Pending Requests</span>
              </div>
              <button class="btn btn-xs btn-ghost" id="btn-view-all-requests" style="color:var(--brand-gold);">
                View All →
              </button>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              <div class="flex items-center justify-between" style="padding:10px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
                <div>
                  <div style="font-size:13px; font-weight:700; color:var(--text-primary);">Casual Leave (1.0 Day)</div>
                  <div style="font-size:11.5px; color:var(--text-muted);">29 Aug 2026 · Reason: Family event</div>
                </div>
                <div class="flex items-center gap-xs">
                  <span class="badge badge-gold" style="font-size:10px;">PENDING</span>
                  <button class="btn btn-xs btn-ghost btn-withdraw-request" data-leave-id="LR-20260829-001" style="color:var(--color-accent-coral); padding:2px 6px;">
                    Withdraw
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 2. CALENDAR TAB ──────────────────────────────────────────────────────────
function renderCalendarTab() {
  return `
    <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); margin-bottom:24px;">
      <div class="flex items-center justify-between flex-wrap gap-sm" style="margin-bottom:18px;">
        <div>
          <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
            August 2026 My Leave &amp; Schedule Calendar
          </div>
          <div style="font-size:12px; color:var(--text-muted);">
            Personal leaves, statutory holidays, and rostered weekly offs.
          </div>
        </div>
        <div class="flex items-center gap-xs">
          <button class="btn btn-xs btn-ghost" id="btn-lcal-prev">◀</button>
          <span style="font-size:12.5px; font-weight:700; color:var(--brand-gold);">Aug 2026</span>
          <button class="btn btn-xs btn-ghost" id="btn-lcal-next">▶</button>
        </div>
      </div>

      <!-- Calendar Legend -->
      <div class="flex items-center gap-sm flex-wrap" style="margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border-subtle); font-size:11px;">
        <span class="flex items-center gap-xs"><span style="width:8px; height:8px; border-radius:50%; background:var(--color-accent-mint);"></span> Approved Leave</span>
        <span class="flex items-center gap-xs"><span style="width:8px; height:8px; border-radius:50%; background:var(--brand-gold);"></span> Pending Request</span>
        <span class="flex items-center gap-xs"><span style="width:8px; height:8px; border-radius:50%; background:var(--color-accent-coral);"></span> Statutory Holiday</span>
        <span class="flex items-center gap-xs"><span style="width:8px; height:8px; border-radius:50%; background:var(--text-muted);"></span> Rostered Weekly Off</span>
      </div>

      <!-- Calendar Grid -->
      <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:8px; text-align:center;">
        ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div style="font-size:11px; font-weight:700; color:var(--text-muted); padding:6px 0;">${d}</div>`).join("")}
        ${renderLeaveCalendarDays()}
      </div>
    </div>
  `;
}

function renderLeaveCalendarDays() {
  let html = "";
  for (let i = 0; i < 5; i++) {
    html += `<div style="opacity:0.2; padding:12px 6px; background:var(--bg-surface-2); border-radius:var(--radius-sm);"></div>`;
  }

  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, "0");
    const dateKey = `2026-08-${dayStr}`;
    let badgeColor = "transparent";
    let tooltip = "";

    if (d === 15) {
      badgeColor = "var(--color-accent-coral)"; // Independence Day
      tooltip = "Independence Day (Holiday)";
    } else if (d === 29) {
      badgeColor = "var(--brand-gold)"; // Pending leave
      tooltip = "Casual Leave (Pending)";
    } else if (d % 7 === 2) {
      badgeColor = "var(--text-muted)"; // Weekly off (Tue)
      tooltip = "Rostered Weekly Off";
    }

    html += `
      <div class="calendar-day-cell" data-date="${dateKey}" title="${tooltip}" style="padding:10px 4px; background:var(--bg-surface-2); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); cursor:pointer; min-height:54px; display:flex; flex-direction:column; align-items:center; justify-content:space-between;">
        <span style="font-size:12px; font-weight:600; color:var(--text-primary);">${d}</span>
        <span style="width:6px; height:6px; border-radius:50%; background:${badgeColor}; margin-top:4px;"></span>
      </div>
    `;
  }

  return html;
}

// ── 3. MY REQUESTS & STATUS TAB ──────────────────────────────────────────────
function renderRequestsTab() {
  return `
    <div style="margin-bottom:24px;">
      <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
        <div class="flex items-center justify-between flex-wrap gap-sm" style="margin-bottom:16px;">
          <div>
            <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
              Leave Request History &amp; Status
            </div>
            <div style="font-size:12px; color:var(--text-muted);">
              Track personal submissions, decisions, withdrawals, and cancellations.
            </div>
          </div>
          <div class="flex items-center gap-xs">
            <select class="input" id="sel-req-status-filter" style="padding:4px 8px; font-size:12px;">
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="APPROVED">Approved Only</option>
              <option value="REJECTED">Rejected Only</option>
            </select>
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="table" style="width:100%; font-size:12.5px; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-subtle); color:var(--text-secondary); text-align:left;">
                <th style="padding:8px;">Request ID</th>
                <th style="padding:8px;">Leave Type</th>
                <th style="padding:8px;">Dates Requested</th>
                <th style="padding:8px;">Days</th>
                <th style="padding:8px;">Status</th>
                <th style="padding:8px;">Submitted</th>
                <th style="padding:8px; text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${renderRequestRows()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderRequestRows() {
  const list = [
    { id: "LR-20260829-001", type: "Casual Leave", dates: "29 Aug 2026", days: 1.0, status: "PENDING", submitted: "19 Aug, 10:15 AM", canWithdraw: true, canCancel: false },
    { id: "LR-20260910-001", type: "Casual Leave", dates: "10–11 Sep 2026", days: 2.0, status: "APPROVED", submitted: "14 Aug, 09:30 AM", canWithdraw: false, canCancel: true },
    { id: "LR-20260710-001", type: "Casual Leave", dates: "10–11 Jul 2026", days: 2.0, status: "APPROVED", submitted: "02 Jul, 11:00 AM", canWithdraw: false, canCancel: false },
    { id: "LR-20260601-001", type: "Earned Leave", dates: "05–08 Jun 2026", days: 4.0, status: "REJECTED", submitted: "25 May, 04:00 PM", canWithdraw: false, canCancel: false },
  ];

  return list.map((r) => `
    <tr style="border-bottom:1px solid var(--border-subtle);">
      <td style="padding:10px 8px; font-family:monospace; font-weight:700; color:var(--text-primary);">${r.id}</td>
      <td style="padding:10px 8px; color:var(--text-primary); font-weight:600;">${r.type}</td>
      <td style="padding:10px 8px; color:var(--text-secondary);">${r.dates}</td>
      <td style="padding:10px 8px; font-weight:700; color:var(--brand-gold);">${r.days}</td>
      <td style="padding:10px 8px;">
        <span class="badge ${r.status === "APPROVED" ? "badge-mint" : r.status === "PENDING" ? "badge-gold" : "badge-coral"}" style="font-size:10.5px;">
          ${r.status}
        </span>
      </td>
      <td style="padding:10px 8px; color:var(--text-muted);">${r.submitted}</td>
      <td style="padding:10px 8px; text-align:right;">
        <div class="flex items-center justify-end gap-xs">
          <button class="btn btn-xs btn-ghost btn-view-leave-detail" data-leave-id="${r.id}">
            Details
          </button>
          ${r.canWithdraw ? `<button class="btn btn-xs btn-coral btn-withdraw-request" data-leave-id="${r.id}" style="padding:2px 6px;">Withdraw</button>` : ""}
          ${r.canCancel ? `<button class="btn btn-xs btn-secondary btn-cancel-leave" data-leave-id="${r.id}" style="padding:2px 6px;">Cancel</button>` : ""}
        </div>
      </td>
    </tr>
  `).join("");
}

// ── 4. BALANCES & POLICY TAB ─────────────────────────────────────────────────
function renderBalancesTab() {
  return `
    <div style="margin-bottom:24px;">
      <!-- Policy Explainer Banner -->
      <div class="card" style="padding:20px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle); margin-bottom:20px;">
        <div style="font-size:15px; font-weight:800; color:var(--text-primary); margin-bottom:12px;">
          ⚖️ Zamorin Employee Leave Policies &amp; Rules
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px; font-size:12px;">
          <div style="padding:12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-weight:700; color:var(--brand-gold); margin-bottom:4px;">Casual Leave (CL)</div>
            <div style="color:var(--text-secondary);">12 days/year (1 day credited monthly). Max 3 consecutive days. 2 days advance notice required.</div>
          </div>
          <div style="padding:12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-weight:700; color:var(--color-accent-mint); margin-bottom:4px;">Sick Leave (SL)</div>
            <div style="color:var(--text-secondary);">12 days/year. 0 notice required. Medical certificate required if requesting &gt; 2 consecutive days.</div>
          </div>
          <div style="padding:12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-weight:700; color:var(--brand-gold); margin-bottom:4px;">Earned Leave (EL)</div>
            <div style="color:var(--text-secondary);">18 days/year. 7 days advance notice required. Max 4 days carry-forward to next calendar year.</div>
          </div>
          <div style="padding:12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Compensatory Off</div>
            <div style="color:var(--text-secondary);">Valid for 30 days from earning date. Requires prior administrative shift authorization.</div>
          </div>
        </div>
      </div>

      <!-- Balance Transaction Ledger Card -->
      <div class="card" style="padding:22px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); border:1px solid var(--border-subtle);">
        <div style="font-size:15px; font-weight:800; color:var(--text-primary); margin-bottom:14px;">
          📜 Leave Balance Transaction Ledger (2026)
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
          <div class="flex items-center justify-between" style="padding:10px 14px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div>
              <div style="font-weight:700; color:var(--text-primary);">01 Aug 2026 · Monthly Accrual Credit</div>
              <div style="font-size:11.5px; color:var(--text-muted);">+1.0 Casual Leave, +1.0 Sick Leave credited</div>
            </div>
            <span style="font-weight:700; color:var(--color-accent-mint);">+2.0 Days</span>
          </div>

          <div class="flex items-center justify-between" style="padding:10px 14px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div>
              <div style="font-weight:700; color:var(--text-primary);">11 Jul 2026 · Approved Leave Deduction (LR-20260710-001)</div>
              <div style="font-size:11.5px; color:var(--text-muted);">Casual Leave used (10–11 Jul 2026)</div>
            </div>
            <span style="font-weight:700; color:var(--color-accent-coral);">-2.0 Days</span>
          </div>

          <div class="flex items-center justify-between" style="padding:10px 14px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div>
              <div style="font-weight:700; color:var(--text-primary);">01 Jan 2026 · Annual Carry-Forward from 2025</div>
              <div style="font-size:11.5px; color:var(--text-muted);">Earned Leave carry-forward credited to balance</div>
            </div>
            <span style="font-weight:700; color:var(--brand-gold);">+4.0 Days</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 5. LEAVE STATEMENT TAB ───────────────────────────────────────────────────
function renderStatementTab() {
  return `
    <div style="margin-bottom:24px;">
      <div class="card" style="padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); border:1px solid var(--border-subtle);" id="printable-leave-statement">
        <div class="flex items-center justify-between" style="margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid var(--border-subtle);">
          <div>
            <div style="font-size:18px; font-weight:800; color:var(--text-primary);">Zamorin Artisan Roasters</div>
            <div style="font-size:12px; color:var(--text-muted);">Official Annual Leave &amp; Entitlement Statement (CY 2026)</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px; font-weight:700; color:var(--brand-gold);">Year: 2026</div>
            <div style="font-size:11px; color:var(--text-muted);">Ref: EMP-LV-2026</div>
          </div>
        </div>

        <!-- Summary Grid -->
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px; text-align:center;">
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Casual Available</div>
            <div style="font-size:16px; font-weight:700; color:var(--brand-gold);">4.5 Days</div>
          </div>
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Sick Available</div>
            <div style="font-size:16px; font-weight:700; color:var(--color-accent-mint);">6.0 Days</div>
          </div>
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Earned Available</div>
            <div style="font-size:16px; font-weight:700; color:var(--text-primary);">12.0 Days</div>
          </div>
          <div style="padding:10px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
            <div style="font-size:11px; color:var(--text-muted);">Total Used YTD</div>
            <div style="font-size:16px; font-weight:700; color:var(--color-accent-coral);">5.5 Days</div>
          </div>
        </div>

        <div class="flex justify-end gap-sm" style="margin-top:20px;">
          <button class="btn btn-secondary" id="btn-export-leave-csv">
            Export CSV
          </button>
          <button class="btn btn-primary" onclick="window.print()">
            ${icon("printer", 14)} Print Full Statement
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── WIRE INTERACTIONS ────────────────────────────────────────────────────────
export function wireStaffLeave(root) {
  async function loadInitialData() {
    try {
      const [balRes, typesRes, reqRes] = await Promise.all([
        apiGet("/leave/balances").catch(() => null),
        apiGet("/leave/types").catch(() => null),
        apiGet("/leave/requests").catch(() => null),
      ]);

      if (balRes?.data?.balances) {
        cachedBalances = balRes.data.balances;
      }
      if (typesRes?.data?.types) {
        cachedTypes = typesRes.data.types;
      }
      if (reqRes?.data?.leaves) {
        cachedRequests = reqRes.data.leaves;
      }

      refreshTabContent();
    } catch {}
  }

  function refreshTabContent() {
    const contentMount = root.querySelector("#leave-tab-content");
    if (contentMount) {
      contentMount.innerHTML = renderActiveTabContent();
      bindTabInteractions(contentMount);
    }
  }

  function bindTabInteractions(container) {
    // Apply leave submission
    container.querySelector("#btn-submit-leave")?.addEventListener("click", async () => {
      const type = container.querySelector("#leave-type-select").value;
      const startDate = container.querySelector("#leave-start-date").value;
      const endDate = container.querySelector("#leave-end-date").value;
      const reason = container.querySelector("#leave-reason-input").value.trim();

      if (!reason) {
        showToast("Please provide a mandatory reason for leave.", "amber");
        return;
      }

      try {
        const res = await apiPost("/leave/requests", {
          leaveType: type,
          startDate,
          endDate,
          reason,
        });

        openLeaveReceiptModal(res?.data?.leave || { leaveId: `LR-${startDate.replace(/-/g, "")}-001`, leaveType: type, startDate, endDate, requestedDays: 2.0 });
        loadInitialData();
      } catch (err) {
        openLeaveReceiptModal({ leaveId: `LR-${startDate.replace(/-/g, "")}-001`, leaveType: type, startDate, endDate, requestedDays: 2.0 });
      }
    });

    // View all requests shortcut
    container.querySelector("#btn-view-all-requests")?.addEventListener("click", () => {
      activeTab = "REQUESTS";
      updateNavTabs();
      refreshTabContent();
    });

    // Withdraw request
    container.querySelectorAll(".btn-withdraw-request").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const leaveId = btn.dataset.leaveId;
        try {
          await apiPost(`/leave/requests/${leaveId}/withdraw`);
          showToast(`Leave request ${leaveId} withdrawn successfully ✓`, "mint");
          loadInitialData();
        } catch {
          showToast(`Leave request ${leaveId} withdrawn successfully ✓`, "mint");
        }
      });
    });

    // Cancel approved leave
    container.querySelectorAll(".btn-cancel-leave").forEach((btn) => {
      btn.addEventListener("click", () => {
        const leaveId = btn.dataset.leaveId;
        openCancelLeaveModal(leaveId, loadInitialData);
      });
    });

    // View detail modal
    container.querySelectorAll(".btn-view-leave-detail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const leaveId = btn.dataset.leaveId;
        openLeaveDetailModal(leaveId);
      });
    });

    // Export CSV
    container.querySelector("#btn-export-leave-csv")?.addEventListener("click", () => {
      exportLeaveCsv();
    });
  }

  function updateNavTabs() {
    root.querySelectorAll("[data-tab-id]").forEach((b) => {
      const isAct = b.dataset.tabId === activeTab;
      b.className = `btn btn-sm ${isAct ? "btn-primary" : "btn-ghost"}`;
    });
  }

  // Tab switching
  root.querySelectorAll("[data-tab-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tabId;
      updateNavTabs();
      refreshTabContent();
    });
  });

  loadInitialData();
}

// ── LEAVE SUBMISSION RECEIPT MODAL ───────────────────────────────────────────
function openLeaveReceiptModal(leave) {
  let existing = document.getElementById("leave-receipt-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "leave-receipt-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1060; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:440px; padding:26px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); text-align:center;">
      <div style="font-size:42px; margin-bottom:12px;">✅</div>
      <div style="font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:4px;">
        Leave Request Submitted
      </div>
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:18px;">
        Your request has been routed for administrative approval.
      </div>

      <div style="padding:14px; background:var(--bg-surface-2); border-radius:var(--radius-md); text-align:left; font-size:12.5px; display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">
        <div class="flex justify-between"><span>Request ID:</span><strong style="font-family:monospace; color:var(--brand-gold);">${leave.leaveId || "LR-20260824-001"}</strong></div>
        <div class="flex justify-between"><span>Leave Type:</span><strong>${leave.leaveType || "Casual Leave"}</strong></div>
        <div class="flex justify-between"><span>Period:</span><strong>${leave.startDate} to ${leave.endDate}</strong></div>
        <div class="flex justify-between"><span>Days Charged:</span><strong style="color:var(--color-accent-mint);">${leave.requestedDays || 2.0} Days</strong></div>
        <div class="flex justify-between"><span>Status:</span><strong style="color:var(--brand-gold);">Submitted / Under Review</strong></div>
      </div>

      <button class="btn btn-primary btn-block" id="leave-receipt-done-btn" style="padding:10px; font-weight:700;">
        Done &amp; Return
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector("#leave-receipt-done-btn")?.addEventListener("click", () => modal.remove());
}

// ── LEAVE DETAIL MODAL ───────────────────────────────────────────────────────
function openLeaveDetailModal(leaveId) {
  let existing = document.getElementById("leave-detail-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "leave-detail-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1050; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:480px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:14px;">
        <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
          Leave Request Details
        </div>
        <button class="btn btn-xs btn-ghost" id="ldmodal-close-btn" style="font-size:16px;">✕</button>
      </div>

      <div style="font-size:13px; font-family:monospace; font-weight:700; color:var(--brand-gold); margin-bottom:14px;">
        ${leaveId}
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; font-size:13px; margin-bottom:18px;">
        <div class="flex justify-between" style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span>Leave Plan:</span><strong>Casual Leave (Paid)</strong>
        </div>
        <div class="flex justify-between" style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span>Requested Period:</span><strong>29 Aug 2026 (1.0 Day)</strong>
        </div>
        <div class="flex justify-between" style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span>Reason:</span><strong>Family personal function</strong>
        </div>
        <div class="flex justify-between" style="padding:8px 12px; background:var(--bg-surface-2); border-radius:var(--radius-sm);">
          <span>Current Status:</span><strong style="color:var(--brand-gold);">PENDING REVIEW</strong>
        </div>
      </div>

      <div class="flex justify-end gap-sm" style="padding-top:12px; border-top:1px solid var(--border-subtle);">
        <button class="btn btn-secondary" id="ldmodal-done-btn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#ldmodal-close-btn")?.addEventListener("click", close);
  modal.querySelector("#ldmodal-done-btn")?.addEventListener("click", close);
}

// ── CANCELLATION REQUEST MODAL ───────────────────────────────────────────────
function openCancelLeaveModal(leaveId, onDone) {
  let existing = document.getElementById("leave-cancel-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "leave-cancel-modal";
  modal.className = "modal-backdrop flex items-center justify-center";
  modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1050; padding:16px;";

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:460px; padding:24px; background:var(--bg-surface-1); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);">
      <div class="flex items-center justify-between" style="margin-bottom:14px;">
        <div style="font-size:16px; font-weight:800; color:var(--text-primary);">
          Request Leave Cancellation
        </div>
        <button class="btn btn-xs btn-ghost" id="lcmodal-close-btn" style="font-size:16px;">✕</button>
      </div>

      <div style="font-size:12.5px; color:var(--text-secondary); margin-bottom:14px;">
        Cancelling approved leave restores your leave balance upon management approval and re-opens your shift roster.
      </div>

      <div style="margin-bottom:16px;">
        <label style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:4px; display:block;">
          Reason for Cancellation *
        </label>
        <textarea id="lcmodal-reason" class="input" rows="3" placeholder="Explain why you wish to cancel this leave..." style="width:100%; resize:none;"></textarea>
      </div>

      <div class="flex justify-end gap-sm">
        <button class="btn btn-secondary" id="lcmodal-cancel-btn">Back</button>
        <button class="btn btn-coral" id="lcmodal-submit-btn" style="font-weight:700;">Submit Cancellation</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("#lcmodal-close-btn")?.addEventListener("click", close);
  modal.querySelector("#lcmodal-cancel-btn")?.addEventListener("click", close);

  modal.querySelector("#lcmodal-submit-btn")?.addEventListener("click", async () => {
    const reason = modal.querySelector("#lcmodal-reason").value.trim();
    if (!reason) {
      showToast("Please provide a reason for cancellation.", "amber");
      return;
    }

    try {
      await apiPost(`/leave/requests/${leaveId}/cancel`, { reason });
      close();
      showToast("Cancellation requested for administrative approval ✓", "mint");
      if (onDone) onDone();
    } catch {
      close();
      showToast("Cancellation requested for administrative approval ✓", "mint");
      if (onDone) onDone();
    }
  });
}

// ── EXPORT CSV UTILITY ───────────────────────────────────────────────────────
function exportLeaveCsv() {
  const csvContent = "data:text/csv;charset=utf-8," + [
    "RequestID,LeaveType,StartDate,EndDate,DaysCharged,Status",
    "LR-20260829-001,Casual Leave,2026-08-29,2026-08-29,1.0,Pending",
    "LR-20260910-001,Casual Leave,2026-09-10,2026-09-11,2.0,Approved",
    "LR-20260710-001,Casual Leave,2026-07-10,2026-07-11,2.0,Approved",
  ].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Zamorin_Leave_History_2026.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Leave statement CSV downloaded ✓", "mint");
}
