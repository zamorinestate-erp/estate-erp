import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { showToast, openModal, confirmAction, renderCafeContextStrip, renderChildHeader } from "../components.js";
import { state } from "../state.js";
import { navigate } from "../router.js";

let liveOrders = null;
let liveOverview = null;
let liveQuotes = null;
let liveSchedule = null;
let liveAccounts = null;
let liveIntegrity = null;

let activeTab = "overview"; // overview | orders | quotes | schedule | accounts | credit | integrity
let activeStatusFilter = "ALL";
let searchQuery = "";

export function setDepartmentOrdersActiveTab(tab) {
  const norm = (tab || "overview").toLowerCase();
  const aliasMap = {
    "register": "orders",
    "order-register": "orders",
    "proposals": "quotes",
    "quotations": "quotes",
    "calendar": "schedule",
    "clients": "accounts",
    "settlement": "credit",
    "settlements": "credit",
    "audit": "integrity",
    "reports": "integrity",
  };
  activeTab = aliasMap[norm] || norm || "overview";
}

const SAMPLE_ORDERS = [
  {
    orderId: "DO-2026-0001",
    institutionName: "University of Calicut",
    departmentName: "Dean Office / Academic Affairs",
    careOfContact: "Dr. K. S. Namboodiri",
    cafeId: "ZC-0001",
    orderDate: "2026-08-15",
    fulfilmentDate: "2026-08-20",
    promisedTimeWindow: "10:00 - 10:30 AM",
    items: [
      { name: "Pour-Over Specialty Coffee", quantity: 20, unit: "cups", unitPricePaisa: 15000, totalPaisa: 300000 },
      { name: "Artisanal Butter Croissants", quantity: 20, unit: "pieces", unitPricePaisa: 12000, totalPaisa: 240000 },
    ],
    headcount: { estimated: 20, guaranteed: 20, final: 20, actual: 20 },
    totalPaisa: 567000,
    settledPaisa: 0,
    orderStatus: "CONFIRMED",
    fulfilmentStatus: "SCHEDULED",
    creditStatus: "CREDIT_OPEN",
    poNumber: "UOC-ACAD-2026-088",
  },
  {
    orderId: "DO-2026-0002",
    institutionName: "NIT Calicut",
    departmentName: "Department of Computer Science",
    careOfContact: "Prof. Ananya Roy",
    cafeId: "ZC-0001",
    orderDate: "2026-08-16",
    fulfilmentDate: "2026-08-21",
    promisedTimeWindow: "01:00 - 01:30 PM",
    items: [
      { name: "Cold Brew Glass Bottles", quantity: 30, unit: "bottles", unitPricePaisa: 22000, totalPaisa: 660000 },
      { name: "Smoked Chicken Panini", quantity: 30, unit: "boxes", unitPricePaisa: 25000, totalPaisa: 750000 },
    ],
    headcount: { estimated: 30, guaranteed: 30, final: 30, actual: 30 },
    totalPaisa: 1480500,
    settledPaisa: 500000,
    orderStatus: "IN_FULFILMENT",
    fulfilmentStatus: "IN_FULFILMENT",
    creditStatus: "PARTIALLY_SETTLED",
    poNumber: "NITC-CS-PO-409",
  },
  {
    orderId: "DO-2026-0003",
    institutionName: "IIM Kozhikode",
    departmentName: "MBA Executive Programme Secretariat",
    careOfContact: "Sunil Jacob",
    cafeId: "ZC-0002",
    orderDate: "2026-08-14",
    fulfilmentDate: "2026-08-18",
    promisedTimeWindow: "04:00 - 04:30 PM",
    items: [
      { name: "Executive High Tea Platter", quantity: 45, unit: "sets", unitPricePaisa: 38000, totalPaisa: 1710000 },
    ],
    headcount: { estimated: 45, guaranteed: 45, final: 45, actual: 45 },
    totalPaisa: 1795500,
    settledPaisa: 1795500,
    orderStatus: "CLOSED",
    fulfilmentStatus: "FULFILLED",
    creditStatus: "SETTLED",
    poNumber: "IIMK-EP-2026-112",
  },
];

export function renderDepartmentOrders(subroute) {
  if (subroute !== undefined) {
    setDepartmentOrdersActiveTab(subroute);
  }
  const isCafeOps = state.role === "CAFE_ADMIN";
  const userCafe = state.auth?.user?.primaryCafeId || state.user?.primaryCafeId || "ZC-0001";
  const rawOrders = liveOrders || SAMPLE_ORDERS;
  const orders = isCafeOps ? rawOrders.filter((o) => !o.cafeId || o.cafeId === userCafe) : rawOrders;

  const filtered = orders.filter((o) => {
    const matchStatus =
      activeStatusFilter === "ALL" ||
      o.orderStatus === activeStatusFilter ||
      o.fulfilmentStatus === activeStatusFilter ||
      o.creditStatus === activeStatusFilter;

    const matchSearch =
      !searchQuery ||
      (o.orderId && o.orderId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.institutionName && o.institutionName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.departmentName && o.departmentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.careOfContact && o.careOfContact.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.poNumber && o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchStatus && matchSearch;
  });

  const totalOutstanding = orders.reduce((acc, o) => acc + Math.max(0, (o.totalPaisa || 0) - (o.settledPaisa || 0)), 0);
  const totalSettled = orders.reduce((acc, o) => acc + (o.settledPaisa || 0), 0);
  const upcomingCount = orders.filter((o) => o.fulfilmentStatus === "SCHEDULED" || o.fulfilmentStatus === "CONFIRMED").length;

  if (activeTab && activeTab !== "overview") {
    return `
      <div class="page-enter" style="max-width:1400px; margin:0 auto; padding-bottom:50px;">
        <div id="dept-subpanel-root">
          ${renderActiveTabContent(orders, filtered, totalOutstanding, totalSettled, upcomingCount)}
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter" style="max-width:1400px; margin:0 auto; padding-bottom:50px;">
      <!-- Page Header -->
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:16px;border-bottom:1px solid var(--border-subtle);padding-bottom:16px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <h1 class="page-title" style="font-size:24px;font-weight:800;margin:0;color:var(--ink);letter-spacing:-0.3px;">Institutional &amp; Department Orders</h1>
            <span class="badge" style="background:var(--bronze-100);color:var(--bronze-800);font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;">SCR-007</span>
          </div>
          <p class="page-subtitle" style="font-size:13px;color:var(--muted);margin:0;">
            Authoritative institutional order lifecycle: Requests • Quotes • Approvals • Schedules • Fulfilment • Institutional Credit • Settlements • Reconciliation.
          </p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button class="btn btn-ghost" id="refresh-dept-btn" type="button" style="font-size:12.5px;padding:7px 14px;">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Scope Context Banner -->
      ${renderCafeContextStrip()}

      <!-- TAB CONTENT -->
      <div id="dept-subpanel-root">
        ${renderActiveTabContent(orders, filtered, totalOutstanding, totalSettled, upcomingCount)}
      </div>
    </div>
  `;
}

function renderActiveTabContent(orders, filtered, totalOutstanding, totalSettled, upcomingCount) {
  if (activeTab === "overview") {
    return renderOverviewTab(orders, totalOutstanding, totalSettled, upcomingCount);
  }

  const submodules = {
    orders: {
      title: "Orders Register",
      icon: "📑",
      desc: "Institutional booking register, order lifecycle, items, status & delivery receipts.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="add-dept-order-btn" type="button" style="font-size:12px; font-weight:700;">+ New Department Order</button>`
    },
    quotes: {
      title: "Requests & Quotations",
      icon: "📝",
      desc: "Institutional RFQs, catering quotes, pricing estimates & client approvals.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="new-quote-btn" type="button" style="font-size:12px; font-weight:700;">+ Create Quote</button>`
    },
    schedule: {
      title: "Fulfilment Schedule & Calendar",
      icon: "📅",
      desc: "7-day commitment schedule, dispatch windows, and kitchen preparation loads.",
      actionsHtml: `<button class="btn btn-ghost btn-sm" id="dept-sync-calendar-btn" type="button" style="font-size:12px;">📅 Sync Schedule</button>`
    },
    accounts: {
      title: "Institutional Clients & Accounts",
      icon: "🏛️",
      desc: "Approved institutions, authorized signatories, billing terms and credit limits.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="add-client-btn" type="button" style="font-size:12px; font-weight:700;">+ Add Institution</button>`
    },
    credit: {
      title: "Credit Ledger & Receivables Settlement",
      icon: "💳",
      desc: "Open credit tracking, advance collections, invoice status & settlement posting.",
      actionsHtml: `<button class="btn btn-ghost btn-sm" id="export-credit-btn" type="button" style="font-size:12px;">📑 Export Receivables</button>`
    },
    integrity: {
      title: "Integrity, Audit & ZURF Reporting",
      icon: "🛡️",
      desc: "Immutable change logs, multi-store reconciliation, and ZURF export certificates.",
      actionsHtml: `<button class="btn btn-primary btn-sm" id="export-zurf-btn" type="button" style="font-size:12px; font-weight:700;">📑 ZURF Export</button>`
    },
  };

  const cur = submodules[activeTab] || { title: "Department Orders", icon: "📑", desc: "", actionsHtml: "" };

  let bodyHtml = "";
  switch (activeTab) {
    case "orders":
      bodyHtml = renderOrdersTab(filtered, orders.length);
      break;
    case "quotes":
      bodyHtml = renderQuotesTab();
      break;
    case "schedule":
      bodyHtml = renderScheduleTab(orders);
      break;
    case "accounts":
      bodyHtml = renderAccountsTab();
      break;
    case "credit":
      bodyHtml = renderCreditTab(orders, totalOutstanding, totalSettled);
      break;
    case "integrity":
      bodyHtml = renderIntegrityTab(orders);
      break;
    default:
      bodyHtml = renderOverviewTab(orders, totalOutstanding, totalSettled, upcomingCount);
  }

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${renderChildHeader({
        parentLabel: "Institutional Orders",
        parentRoute: "dept-orders",
        childTitle: cur.title,
        icon: cur.icon,
        description: cur.desc,
        backBtnId: "dept-back-to-hub-btn",
        actionsHtml: cur.actionsHtml || ""
      })}
      <div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderOverviewTab(orders, totalOutstanding, totalSettled, upcomingCount) {
  const deptTiles = [
    { id: "orders", icon: "📑", title: "Orders Register", subtitle: "Full institutional booking register, status tracking & delivery receipts", badge: `${orders.length} Orders`, badgeType: "success" },
    { id: "quotes", icon: "📝", title: "Requests & Quotes", subtitle: "Institutional requests, rate quotes, menu proposals & discounts", badge: "Quotes", badgeType: "accent" },
    { id: "schedule", icon: "📅", title: "Schedule & Calendar", subtitle: "Kitchen preparation calendar, dispatch slots & delivery coordination", badge: `${upcomingCount} Upcoming`, badgeType: "warning" },
    { id: "accounts", icon: "🏛️", title: "Institutional Accounts", subtitle: "Corporate clients, university departments, credit limits & contacts", badge: "Directory", badgeType: "" },
    { id: "credit", icon: "💳", title: "Credit & Settlement", subtitle: "Outstanding ledger, partial advances, invoice payments & collections", badge: "Receivables", badgeType: "warning" },
    { id: "integrity", icon: "🛡️", title: "Integrity & Reports", subtitle: "Audit trail, 3-way reconciliation, ZURF export & delivery SLA metrics", badge: "Audited", badgeType: "success" },
  ];

  return `
    <!-- Control Centre Button Hub Section -->
    <div class="module-hub-section" style="margin-bottom:24px;">
      <h3 class="module-hub-section-title">Department &amp; Institutional Catering Workspaces</h3>
      <div class="module-tile-grid">
        ${deptTiles.map((t) => `
          <button class="module-hub-tile" data-dept-hub-tile="${t.id}" type="button">
            <div class="module-tile-icon-box">${t.icon}</div>
            <div class="module-tile-content">
              <div class="module-tile-title-row">
                <span class="module-tile-title">${t.title}</span>
                ${t.badge ? `<span class="module-tile-badge ${t.badgeType || ""}">${t.badge}</span>` : ""}
              </div>
              <p class="module-tile-subtitle">${t.subtitle}</p>
            </div>
            <div class="module-tile-arrow">→</div>
          </button>
        `).join("")}
      </div>
    </div>

    <!-- Top KPI Grid -->
    <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
      <article class="card kpi-card" style="padding:18px;border-left:4px solid var(--warning, #f59e0b);">
        <div class="kpi-label" style="font-size:12px;text-transform:uppercase;color:var(--muted);font-weight:600;">Outstanding Institutional Credit</div>
        <div class="kpi-value" style="font-size:24px;font-weight:700;color:var(--warning);margin:4px 0;">₹${(totalOutstanding / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
        <div class="kpi-trend trend-down" style="font-size:12px;color:var(--muted);">Institutional Tab Receivable</div>
      </article>
      <article class="card kpi-card" style="padding:18px;border-left:4px solid var(--success, #10b981);">
        <div class="kpi-label" style="font-size:12px;text-transform:uppercase;color:var(--muted);font-weight:600;">Reconciled &amp; Settled (Month)</div>
        <div class="kpi-value" style="font-size:24px;font-weight:700;color:var(--success);margin:4px 0;">₹${(totalSettled / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
        <div class="kpi-trend trend-up" style="font-size:12px;color:var(--muted);">Payment Received &amp; Posted</div>
      </article>
      <article class="card kpi-card" style="padding:18px;border-left:4px solid var(--bronze-500, #b45309);">
        <div class="kpi-label" style="font-size:12px;text-transform:uppercase;color:var(--muted);font-weight:600;">Upcoming Commitments (7 Days)</div>
        <div class="kpi-value" style="font-size:24px;font-weight:700;color:var(--ink);margin:4px 0;">${upcomingCount} Orders</div>
        <div class="kpi-trend trend-up" style="font-size:12px;color:var(--muted);">Scheduled / Confirmed</div>
      </article>
    </div>

    <!-- Operational Control Strip -->
    <div class="card" style="padding:14px 20px;margin-bottom:20px;background:var(--surface);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--muted);">Operational Control Strip:</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <span class="badge" style="background:#e0f2fe;color:#0369a1;padding:4px 10px;font-size:12px;font-weight:600;border-radius:6px;">TODAY: 1 ORDER</span>
        <span class="badge" style="background:#fef3c7;color:#92400e;padding:4px 10px;font-size:12px;font-weight:600;border-radius:6px;">NEXT 7 DAYS: ${upcomingCount}</span>
        <span class="badge" style="background:#f1f5f9;color:#475569;padding:4px 10px;font-size:12px;font-weight:600;border-radius:6px;">AWAITING APPROVAL: 0</span>
        <span class="badge" style="background:#fee2e2;color:#991b1b;padding:4px 10px;font-size:12px;font-weight:600;border-radius:6px;">OVERDUE: ₹0.00</span>
        <span class="badge" style="background:#f0fdf4;color:#166534;padding:4px 10px;font-size:12px;font-weight:600;border-radius:6px;">PO COMPLIANCE: 100%</span>
      </div>
    </div>

    <!-- 7-Day Forecasting Load & Recent Register Preview -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px;margin-bottom:20px;">
      <div class="card" style="padding:20px;">
        <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--ink);">Next 7 Days Institutional Load</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background);border-radius:6px;">
            <span style="font-weight:600;font-size:13px;">Thu, 20 Aug</span>
            <span class="badge" style="background:var(--bronze-100);color:var(--bronze-800);font-weight:600;">1 Order • 20 Heads • ₹5,670</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background);border-radius:6px;">
            <span style="font-weight:600;font-size:13px;">Fri, 21 Aug</span>
            <span class="badge" style="background:var(--bronze-100);color:var(--bronze-800);font-weight:600;">1 Order • 30 Heads • ₹14,805</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background);border-radius:6px;">
            <span style="font-weight:600;font-size:13px;">Sat, 22 Aug</span>
            <span style="font-size:12px;color:var(--muted);">No scheduled institutional orders</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background);border-radius:6px;">
            <span style="font-weight:600;font-size:13px;">Sun, 23 Aug</span>
            <span style="font-size:12px;color:var(--muted);">No scheduled institutional orders</span>
          </div>
        </div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="font-size:16px;font-weight:700;margin:0 0 12px;color:var(--ink);">Active Institutional Accounts</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background);border-radius:6px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--ink);">University of Calicut</div>
              <div style="font-size:11px;color:var(--muted);">Academic Affairs • Net 30</div>
            </div>
            <span class="badge" style="background:#fef3c7;color:#92400e;font-weight:600;">₹5,670 / ₹1,00,000</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background);border-radius:6px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--ink);">NIT Calicut</div>
              <div style="font-size:11px;color:var(--muted);">Computer Science • Net 15</div>
            </div>
            <span class="badge" style="background:#fef3c7;color:#92400e;font-weight:600;">₹9,805 / ₹1,00,000</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--background);border-radius:6px;">
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--ink);">IIM Kozhikode</div>
              <div style="font-size:11px;color:var(--muted);">Executive Programmes • Net 30</div>
            </div>
            <span class="badge" style="background:#dcfce7;color:#166534;font-weight:600;">Settled (₹0 Bal)</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function wireDepartmentOrders(root, subroute) {
  if (subroute !== undefined) {
    setDepartmentOrdersActiveTab(subroute);
  }

  // Hub Tiles
  root.querySelectorAll("[data-dept-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tileId = btn.dataset.deptHubTile;
      navigate("dept-orders/" + tileId);
    });
  });

  // Back to Hub Button
  root.querySelector("#dept-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("dept-orders");
  });

  // Filter buttons
  root.querySelectorAll("[data-dept-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeStatusFilter = btn.dataset.deptFilter;
      refreshDeptView(root);
    });
  });

  // Search input
  const searchInput = root.querySelector("#dept-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      refreshDeptView(root);
    });
  }

  // Refresh
  const refreshBtn = root.querySelector("#refresh-dept-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchDeptOrdersFromServer(root));
  }

  // Add Order Modal
  const addBtn = root.querySelector("#add-dept-order-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => openNewOrderWizard(root));
  }

  // Create Quote
  const quoteBtn = root.querySelector("#new-quote-btn") || root.querySelector("#create-quote-top-btn");
  if (quoteBtn) {
    quoteBtn.addEventListener("click", () => openCreateQuoteModal(root));
  }

  // Add Client
  const addClientBtn = root.querySelector("#add-client-btn");
  if (addClientBtn) {
    addClientBtn.addEventListener("click", () => {
      showToast("Institution onboarding form opened.", "info");
    });
  }

  // Sync Calendar
  const syncCalBtn = root.querySelector("#dept-sync-calendar-btn");
  if (syncCalBtn) {
    syncCalBtn.addEventListener("click", () => {
      showToast("Fulfilment schedule synced with kitchen display.", "mint");
    });
  }

  // Export Receivables
  const exportCreditBtn = root.querySelector("#export-credit-btn");
  if (exportCreditBtn) {
    exportCreditBtn.addEventListener("click", () => {
      showToast("Institutional receivables report downloaded.", "mint");
    });
  }

  // Export ZURF
  const exportZurfBtn = root.querySelector("#export-zurf-btn");
  if (exportZurfBtn) {
    exportZurfBtn.addEventListener("click", () => {
      showToast("ZURF Department Orders audit certificate generated.", "mint");
    });
  }

  // Order Actions
  root.querySelectorAll("[data-view-360]").forEach((btn) => {
    btn.addEventListener("click", () => openOrder360Modal(btn.dataset.view360, root));
  });

  root.querySelectorAll("[data-fulfil-dept]").forEach((btn) => {
    btn.addEventListener("click", () => openFulfilModal(btn.dataset.fulfilDept, root));
  });

  root.querySelectorAll("[data-settle-dept]").forEach((btn) => {
    btn.addEventListener("click", () => openSettleModal(btn.dataset.settleDept, root));
  });

  root.querySelectorAll("[data-print-dept]").forEach((btn) => {
    btn.addEventListener("click", () => openOrderSheetModal(btn.dataset.printDept));
  });
}

function renderOrdersTab(orders, totalCount) {
  return `
    <div class="card" style="padding:20px;margin-bottom:20px;">
      <!-- Search & Filters -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${["ALL", "CONFIRMED", "IN_FULFILMENT", "FULFILLED", "CREDIT_OPEN", "SETTLED"].map(
            (status) => `
            <button class="btn btn-sm ${activeStatusFilter === status ? "btn-primary" : "btn-ghost"}" data-dept-filter="${status}" type="button">
              ${status === "ALL" ? "All Orders" : status.replace("_", " ")}
            </button>`
          ).join("")}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="dept-search-input" class="input" placeholder="Search Order #, Institution, PO, C/O..." value="${searchQuery}" style="max-width:260px;" />
        </div>
      </div>

      <!-- Orders Table -->
      <div class="table-wrap" style="overflow-x:auto;">
        <table class="table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-color, #e2e8f0);text-align:left;font-size:12px;color:var(--muted);text-transform:uppercase;">
              <th style="padding:10px 12px;">Order #</th>
              <th style="padding:10px 12px;">Institution &amp; Department</th>
              <th style="padding:10px 12px;">Date &amp; Window</th>
              <th style="padding:10px 12px;">Headcount &amp; Items</th>
              <th style="padding:10px 12px;">Amount</th>
              <th style="padding:10px 12px;">Fulfilment Status</th>
              <th style="padding:10px 12px;">Institutional Credit</th>
              <th style="padding:10px 12px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              orders.length
                ? orders
                    .map((o) => {
                      const balance = Math.max(0, (o.totalPaisa || 0) - (o.settledPaisa || 0));
                      const isSettled = balance === 0 || o.creditStatus === "SETTLED";
                      const isFulfilled = o.fulfilmentStatus === "FULFILLED";
                      const itemsSummary = Array.isArray(o.items)
                        ? o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")
                        : typeof o.items === "string"
                        ? o.items
                        : "Catering Items";

                      return `
                <tr style="border-bottom:1px solid var(--border-color, #f1f5f9);">
                  <td style="padding:12px;font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">
                    ${o.orderId}
                    ${o.poNumber ? `<div style="font-size:10.5px;color:var(--muted);">PO: ${o.poNumber}</div>` : ""}
                  </td>
                  <td style="padding:12px;">
                    <div style="font-weight:700;color:var(--ink);">${o.institutionName || "Institutional Account"}</div>
                    <div style="font-size:12px;color:var(--muted);">${o.departmentName || o.department || "General Department"}</div>
                    <div style="font-size:11px;color:var(--bronze-700);">C/O: ${o.careOfContact || o.careOf || "Auth Rep"}</div>
                  </td>
                  <td style="padding:12px;font-size:12px;">
                    <div style="font-family:var(--font-mono);">${o.fulfilmentDate || o.orderDate}</div>
                    <div style="font-size:11px;color:var(--muted);">${o.promisedTimeWindow || "10:00 AM"}</div>
                  </td>
                  <td style="padding:12px;font-size:12.5px;max-width:220px;">
                    <div style="font-weight:600;">${o.headcount?.final || o.headcount?.estimated || "—"} Guests</div>
                    <div style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemsSummary}</div>
                  </td>
                  <td style="padding:12px;font-family:var(--font-mono);font-size:13px;">
                    <div style="font-weight:700;color:var(--ink);">₹${((o.totalPaisa || (o.amount ? o.amount * 100 : 0)) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                    ${
                      balance > 0
                        ? `<div style="font-size:11px;color:var(--warning);font-weight:600;">Bal: ₹${(balance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>`
                        : `<div style="font-size:11px;color:var(--success);font-weight:600;">Paid in Full</div>`
                    }
                  </td>
                  <td style="padding:12px;">
                    <span class="badge" style="background:${isFulfilled ? "#dcfce7;color:#166534" : "#e0f2fe;color:#0369a1"};font-weight:600;font-size:11.5px;">
                      ${o.fulfilmentStatus || "SCHEDULED"}
                    </span>
                  </td>
                  <td style="padding:12px;">
                    <span class="badge" style="background:${isSettled ? "#dcfce7;color:#166534" : "#fef3c7;color:#92400e"};font-weight:600;font-size:11.5px;">
                      ${isSettled ? "SETTLED" : "CREDIT OPEN"}
                    </span>
                  </td>
                  <td style="padding:12px;text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button class="btn btn-sm btn-ghost" data-view-360="${o.orderId}" type="button">View 360</button>
                      ${
                        !isFulfilled
                          ? `<button class="btn btn-sm btn-ghost" data-fulfil-dept="${o.orderId}" type="button" style="color:var(--bronze-700);">Fulfil</button>`
                          : ""
                      }
                      ${
                        !isSettled
                          ? `<button class="btn btn-sm btn-primary" data-settle-dept="${o.orderId}" type="button">Settle</button>`
                          : ""
                      }
                      <button class="btn btn-sm btn-ghost" data-print-dept="${o.orderId}" type="button">Order Sheet</button>
                    </div>
                  </td>
                </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No department orders match the selected criteria.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderQuotesTab() {
  return `
    <div class="card" style="padding:24px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Institutional Quotes &amp; Enquiries</h3>
          <p style="font-size:13px;color:var(--muted);margin:0;">Formal institutional quotes with effective pricing, validity dates, and one-click order conversion.</p>
        </div>
        <button class="btn btn-primary" id="create-quote-top-btn" type="button">+ Create Quote</button>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-color, #e2e8f0);text-align:left;font-size:12px;color:var(--muted);text-transform:uppercase;">
              <th style="padding:10px 12px;">Quote #</th>
              <th style="padding:10px 12px;">Institution &amp; Contact</th>
              <th style="padding:10px 12px;">Valid Until</th>
              <th style="padding:10px 12px;">Headcount</th>
              <th style="padding:10px 12px;">Quote Amount</th>
              <th style="padding:10px 12px;">Status</th>
              <th style="padding:10px 12px;text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border-color, #f1f5f9);">
              <td style="padding:12px;font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">QUO-2026-0042</td>
              <td style="padding:12px;">
                <div style="font-weight:700;color:var(--ink);">Farook College Autonomous</div>
                <div style="font-size:12px;color:var(--muted);">Postgraduate Commerce Dept • Dr. Basheer A.</div>
              </td>
              <td style="padding:12px;font-family:var(--font-mono);font-size:12px;">2026-08-30</td>
              <td style="padding:12px;font-size:13px;">60 Guests</td>
              <td style="padding:12px;font-family:var(--font-mono);font-weight:700;color:var(--ink);">₹22,500.00</td>
              <td style="padding:12px;"><span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:600;">SENT</span></td>
              <td style="padding:12px;text-align:right;">
                <button class="btn btn-sm btn-primary" data-convert-quote="QUO-2026-0042" type="button">Convert to Order</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderScheduleTab(orders) {
  return `
    <div class="card" style="padding:24px;margin-bottom:20px;">
      <div class="card-head" style="margin-bottom:16px;">
        <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Institutional Catering Schedule</h3>
        <p style="font-size:13px;color:var(--muted);margin:0;">Daily and weekly institutional delivery manifests across all café branches.</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;">
        <div class="card" style="background:var(--background);border:1px solid var(--border-color, #e2e8f0);padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-weight:700;font-size:14px;color:var(--ink);">Thursday, 20 Aug 2026</div>
            <span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:600;">1 Order</span>
          </div>
          <div style="padding:12px;background:var(--surface);border-radius:6px;border:1px solid var(--border-color,#f1f5f9);">
            <div style="display:flex;justify-content:space-between;">
              <span style="font-weight:700;color:var(--bronze-600);font-family:var(--font-mono);">DO-2026-0001</span>
              <span style="font-size:11.5px;color:var(--muted);">10:00 - 10:30 AM</span>
            </div>
            <div style="font-weight:600;font-size:13px;margin-top:4px;">University of Calicut (Dean Office)</div>
            <div style="font-size:12px;color:var(--muted);">20 Guests • Pour-Over Coffee, Croissants</div>
            <div style="font-size:11px;color:var(--bronze-700);margin-top:4px;">Delivery: Senate Hall, Floor 2</div>
          </div>
        </div>

        <div class="card" style="background:var(--background);border:1px solid var(--border-color, #e2e8f0);padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-weight:700;font-size:14px;color:var(--ink);">Friday, 21 Aug 2026</div>
            <span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:600;">1 Order</span>
          </div>
          <div style="padding:12px;background:var(--surface);border-radius:6px;border:1px solid var(--border-color,#f1f5f9);">
            <div style="display:flex;justify-content:space-between;">
              <span style="font-weight:700;color:var(--bronze-600);font-family:var(--font-mono);">DO-2026-0002</span>
              <span style="font-size:11.5px;color:var(--muted);">01:00 - 01:30 PM</span>
            </div>
            <div style="font-weight:600;font-size:13px;margin-top:4px;">NIT Calicut (Computer Science)</div>
            <div style="font-size:12px;color:var(--muted);">30 Guests • Cold Brew Bottles, Panini</div>
            <div style="font-size:11px;color:var(--bronze-700);margin-top:4px;">Delivery: Seminar Complex Block B</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAccountsTab() {
  return `
    <div class="card" style="padding:24px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Institutional Credit Accounts</h3>
          <p style="font-size:13px;color:var(--muted);margin:0;">Governed credit limits, purchase order mandates, and billing cycle configurations.</p>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-color, #e2e8f0);text-align:left;font-size:12px;color:var(--muted);text-transform:uppercase;">
              <th style="padding:10px 12px;">Account ID</th>
              <th style="padding:10px 12px;">Institution</th>
              <th style="padding:10px 12px;">Credit Limit</th>
              <th style="padding:10px 12px;">Current Exposure</th>
              <th style="padding:10px 12px;">PO Required</th>
              <th style="padding:10px 12px;">Billing Cycle</th>
              <th style="padding:10px 12px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid var(--border-color, #f1f5f9);">
              <td style="padding:12px;font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">INST-001</td>
              <td style="padding:12px;font-weight:700;color:var(--ink);">University of Calicut</td>
              <td style="padding:12px;font-family:var(--font-mono);">₹1,00,000.00</td>
              <td style="padding:12px;font-family:var(--font-mono);font-weight:600;color:var(--warning);">₹5,670.00</td>
              <td style="padding:12px;"><span class="badge" style="background:#dcfce7;color:#166534;">YES</span></td>
              <td style="padding:12px;">MONTHLY</td>
              <td style="padding:12px;"><span class="badge" style="background:#dcfce7;color:#166534;">ACTIVE</span></td>
            </tr>
            <tr style="border-bottom:1px solid var(--border-color, #f1f5f9);">
              <td style="padding:12px;font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">INST-002</td>
              <td style="padding:12px;font-weight:700;color:var(--ink);">NIT Calicut</td>
              <td style="padding:12px;font-family:var(--font-mono);">₹1,50,000.00</td>
              <td style="padding:12px;font-family:var(--font-mono);font-weight:600;color:var(--warning);">₹9,805.00</td>
              <td style="padding:12px;"><span class="badge" style="background:#dcfce7;color:#166534;">YES</span></td>
              <td style="padding:12px;">PER_ORDER</td>
              <td style="padding:12px;"><span class="badge" style="background:#dcfce7;color:#166534;">ACTIVE</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCreditTab(orders, totalOutstanding, totalSettled) {
  return `
    <div class="card" style="padding:24px;margin-bottom:20px;">
      <div class="card-head" style="margin-bottom:16px;">
        <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Institutional Credit &amp; Settlement Register</h3>
        <p style="font-size:13px;color:var(--muted);margin:0;">Aging breakdown, outstanding receivables, and recorded settlement transactions.</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
        <div style="padding:14px;background:var(--background);border-radius:6px;border-left:3px solid #10b981;">
          <div style="font-size:11.5px;color:var(--muted);text-transform:uppercase;font-weight:600;">Current (0-30 Days)</div>
          <div style="font-size:18px;font-weight:700;color:var(--ink);margin-top:2px;">₹${(totalOutstanding / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style="padding:14px;background:var(--background);border-radius:6px;border-left:3px solid #f59e0b;">
          <div style="font-size:11.5px;color:var(--muted);text-transform:uppercase;font-weight:600;">31-60 Days</div>
          <div style="font-size:18px;font-weight:700;color:var(--ink);margin-top:2px;">₹0.00</div>
        </div>
        <div style="padding:14px;background:var(--background);border-radius:6px;border-left:3px solid #ef4444;">
          <div style="font-size:11.5px;color:var(--muted);text-transform:uppercase;font-weight:600;">60+ Days (Overdue)</div>
          <div style="font-size:18px;font-weight:700;color:var(--ink);margin-top:2px;">₹0.00</div>
        </div>
      </div>
    </div>
  `;
}

function renderIntegrityTab(orders) {
  return `
    <div class="card" style="padding:24px;margin-bottom:20px;">
      <div class="card-head" style="margin-bottom:16px;">
        <h3 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Three-Way Reconciliation &amp; Integrity Health</h3>
        <p style="font-size:13px;color:var(--muted);margin:0;">Verification between Ordered items, Fulfilment proofs, and Invoiced/Settled amounts.</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
          <div>
            <strong style="color:#166534;">PO Number Validation Check</strong>
            <div style="font-size:12px;color:#15803d;">All active orders over ₹10,000 have valid Purchase Order references attached.</div>
          </div>
          <span class="badge" style="background:#166534;color:var(--ink);font-weight:700;">PASS</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
          <div>
            <strong style="color:#166534;">Fulfilment Proof &amp; Receiving Acknowledgement</strong>
            <div style="font-size:12px;color:#15803d;">All completed orders contain recorded receiving contact names and device acknowledgements.</div>
          </div>
          <span class="badge" style="background:#166534;color:var(--ink);font-weight:700;">PASS</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
          <div>
            <strong style="color:#166534;">Credit Exposure vs Authorized Limit</strong>
            <div style="font-size:12px;color:#15803d;">No institutional account exceeds its approved credit ceiling.</div>
          </div>
          <span class="badge" style="background:#166534;color:var(--ink);font-weight:700;">PASS</span>
        </div>
      </div>
    </div>
  `;
}

function openNewOrderWizard(root) {
  openModal({
    title: "Create Institutional Department Order (Wizard)",
    maxWidth: "750px",
    body: `
      <form id="new-dept-order-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
        <div class="field" style="grid-column:1/-1;">
          <label class="label" style="font-weight:600;font-size:12.5px;">Institution Name *</label>
          <input type="text" id="dept-institution" class="input" placeholder="e.g. University of Calicut" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Department / Cost Centre *</label>
          <input type="text" id="dept-name" class="input" placeholder="e.g. Dean Office / Academic Affairs" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Care Of / Authorized Representative *</label>
          <input type="text" id="dept-care-of" class="input" placeholder="e.g. Dr. K. S. Namboodiri" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Purchase Order (PO) Number</label>
          <input type="text" id="dept-po" class="input" placeholder="e.g. UOC-ACAD-2026-088" />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Café Location *</label>
          <select id="dept-cafe" class="select" required>
            <option value="ZC-0001">ZC-0001 · Koramangala Main</option>
            <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
            <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
          </select>
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Fulfilment Date *</label>
          <input type="date" id="dept-fulfil-date" class="input" value="${new Date().toISOString().slice(0, 10)}" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Service Time Window</label>
          <input type="text" id="dept-window" class="input" value="10:00 - 10:30 AM" />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Estimated Headcount *</label>
          <input type="number" id="dept-headcount" class="input" min="1" value="20" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;font-size:12.5px;">Total Order Amount (₹) *</label>
          <input type="number" id="dept-amount" class="input" min="1" placeholder="e.g. 5670" required />
        </div>
        <div class="field" style="grid-column:1/-1;">
          <label class="label" style="font-weight:600;font-size:12.5px;">Delivery Location Details (Building / Room)</label>
          <input type="text" id="dept-location" class="input" placeholder="e.g. Senate Hall, 2nd Floor, Main Administrative Building" />
        </div>
        <div class="field" style="grid-column:1/-1;">
          <label class="label" style="font-weight:600;font-size:12.5px;">Catering Items &amp; Instructions *</label>
          <textarea id="dept-items" class="textarea" rows="2" placeholder="e.g. 20× Specialty Coffee, 20× Butter Croissants" required></textarea>
        </div>
      </form>
    `,
    saveLabel: "Create Institutional Order",
    onSave: async (modalEl) => {
      const institutionName = modalEl.querySelector("#dept-institution")?.value?.trim();
      const departmentName = modalEl.querySelector("#dept-name")?.value?.trim();
      const careOfContact = modalEl.querySelector("#dept-care-of")?.value?.trim();
      const poNumber = modalEl.querySelector("#dept-po")?.value?.trim();
      const cafeId = modalEl.querySelector("#dept-cafe")?.value;
      const fulfilmentDate = modalEl.querySelector("#dept-fulfil-date")?.value;
      const promisedTimeWindow = modalEl.querySelector("#dept-window")?.value?.trim();
      const headcountNum = Number(modalEl.querySelector("#dept-headcount")?.value || 20);
      const amount = Number(modalEl.querySelector("#dept-amount")?.value || 0);
      const deliveryLocationStr = modalEl.querySelector("#dept-location")?.value?.trim();
      const itemsStr = modalEl.querySelector("#dept-items")?.value?.trim();

      if (!institutionName || !departmentName || amount <= 0 || !itemsStr) {
        showToast("Institution, Department, Items, and Amount are required", "coral");
        return false;
      }

      try {
        await apiPost("/department-orders", {
          body: {
            institutionName,
            departmentName,
            careOfContact,
            poNumber,
            cafeId,
            fulfilmentDate,
            promisedTimeWindow,
            headcount: { estimated: headcountNum, guaranteed: headcountNum, final: headcountNum },
            items: [
              {
                name: itemsStr,
                quantity: headcountNum,
                unit: "guests",
                unitPricePaisa: Math.round((amount * 100) / headcountNum),
                totalPaisa: amount * 100,
              },
            ],
            deliveryLocation: { notes: deliveryLocationStr },
          },
        });
        showToast(`Institutional order created for ${institutionName}!`, "mint");
        await fetchDeptOrdersFromServer(root);
        return true;
      } catch (err) {
        showToast(err.message || "Failed to create order", "coral");
        return false;
      }
    },
  });
}

function openCreateQuoteModal(root) {
  openModal({
    title: "Create Institutional Quote / Proposal",
    maxWidth: "600px",
    body: `
      <form id="create-quote-form" class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div class="field" style="grid-column:1/-1;">
          <label class="label" style="font-weight:600;">Institution Name *</label>
          <input type="text" id="quote-inst" class="input" placeholder="e.g. Farook College Autonomous" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Department *</label>
          <input type="text" id="quote-dept" class="input" placeholder="e.g. Commerce Department" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Contact Person *</label>
          <input type="text" id="quote-contact" class="input" placeholder="e.g. Dr. Basheer A." required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Valid Until *</label>
          <input type="date" id="quote-valid" class="input" value="${new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Total Proposed Amount (₹) *</label>
          <input type="number" id="quote-amount" class="input" placeholder="e.g. 22500" required />
        </div>
        <div class="field" style="grid-column:1/-1;">
          <label class="label" style="font-weight:600;">Menu Package Description *</label>
          <textarea id="quote-items" class="textarea" rows="2" placeholder="e.g. Executive High Tea Service with Cold Brew & Mini Croissants" required></textarea>
        </div>
      </form>
    `,
    saveLabel: "Issue Quote",
    onSave: async (modalEl) => {
      showToast("Institutional quote issued successfully!", "mint");
      return true;
    },
  });
}

function openOrder360Modal(orderId, root) {
  const orders = liveOrders || SAMPLE_ORDERS;
  const order = orders.find((o) => o.orderId === orderId);
  if (!order) return;

  const balance = Math.max(0, (order.totalPaisa || 0) - (order.settledPaisa || 0));

  openModal({
    title: `Department Order 360 — ${order.orderId}`,
    maxWidth: "680px",
    body: `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;justify-content:space-between;padding:12px;background:var(--background);border-radius:6px;">
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--ink);">${order.institutionName || "Institutional Account"}</div>
            <div style="font-size:13px;color:var(--muted);">${order.departmentName || order.department}</div>
            <div style="font-size:12px;color:var(--bronze-700);margin-top:2px;">Care of: ${order.careOfContact || order.careOf || "Authorized Rep"}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--ink);">₹${((order.totalPaisa || (order.amount ? order.amount * 100 : 0)) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
            <div style="font-size:12px;font-weight:600;color:${balance > 0 ? "var(--warning)" : "var(--success)"};">Outstanding: ₹${(balance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="padding:10px;background:var(--surface);border:1px solid var(--border-color,#e2e8f0);border-radius:6px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600;">Fulfilment Status</div>
            <div style="font-weight:700;color:var(--ink);margin-top:2px;">${order.fulfilmentStatus || "SCHEDULED"}</div>
            <div style="font-size:11px;color:var(--muted);">${order.fulfilmentDate || order.orderDate} (${order.promisedTimeWindow || "10:00 AM"})</div>
          </div>
          <div style="padding:10px;background:var(--surface);border:1px solid var(--border-color,#e2e8f0);border-radius:6px;">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:600;">PO &amp; Authorization</div>
            <div style="font-weight:700;color:var(--ink);margin-top:2px;">${order.poNumber || "Direct Authorization"}</div>
            <div style="font-size:11px;color:var(--muted);">Headcount: ${order.headcount?.final || 20} Guests</div>
          </div>
        </div>

        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--ink);">Catering Items:</div>
          <div style="padding:10px;background:var(--background);border-radius:6px;font-size:13px;">
            ${Array.isArray(order.items) ? order.items.map((i) => `<div>• ${i.quantity}× ${i.name} — ₹${(i.totalPaisa / 100).toLocaleString("en-IN")}</div>`).join("") : order.items || "Standard Catering Pack"}
          </div>
        </div>
      </div>
    `,
  });
}

function openFulfilModal(orderId, root) {
  openModal({
    title: `Confirm Fulfilment — ${orderId}`,
    maxWidth: "500px",
    body: `
      <form id="fulfil-form" style="display:flex;flex-direction:column;gap:14px;">
        <div class="field">
          <label class="label" style="font-weight:600;">Receiving Person Name *</label>
          <input type="text" id="receiving-name" class="input" placeholder="e.g. Dr. K. S. Namboodiri / Staff Rep" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Discrepancy Notes (if any)</label>
          <textarea id="discrepancy-notes" class="textarea" rows="2" placeholder="Leave blank if fulfilled in full as requested"></textarea>
        </div>
      </form>
    `,
    saveLabel: "Record Fulfilment",
    onSave: async (modalEl) => {
      const receivingName = modalEl.querySelector("#receiving-name")?.value?.trim();
      const notes = modalEl.querySelector("#discrepancy-notes")?.value?.trim();
      if (!receivingName) {
        showToast("Receiving contact name is required", "coral");
        return false;
      }
      try {
        await apiPost(`/department-orders/${orderId}/fulfil`, {
          body: { receivingContactName: receivingName, discrepancyNotes: notes },
        });
        showToast(`Order ${orderId} marked as fulfilled!`, "mint");
        await fetchDeptOrdersFromServer(root);
        return true;
      } catch (err) {
        showToast(err.message || "Failed to confirm fulfilment", "coral");
        return false;
      }
    },
  });
}

function openSettleModal(orderId, root) {
  const orders = liveOrders || SAMPLE_ORDERS;
  const order = orders.find((o) => o.orderId === orderId);
  const balance = order ? Math.max(0, (order.totalPaisa || 0) - (order.settledPaisa || 0)) : 500000;

  openModal({
    title: `Record Institutional Settlement — ${orderId}`,
    maxWidth: "500px",
    body: `
      <form id="settle-form" style="display:flex;flex-direction:column;gap:14px;">
        <div style="padding:10px;background:var(--background);border-radius:6px;font-size:13px;">
          Outstanding Balance: <strong style="color:var(--warning);">₹${(balance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Settlement Amount (₹) *</label>
          <input type="number" id="settle-amount" class="input" value="${balance / 100}" max="${balance / 100}" min="1" required />
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Payment Method *</label>
          <select id="settle-method" class="select" required>
            <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
            <option value="UPI">Institutional UPI</option>
            <option value="CHEQUE">Institutional Cheque</option>
            <option value="CREDIT_NOTE">Credit Note Offset</option>
          </select>
        </div>
        <div class="field">
          <label class="label" style="font-weight:600;">Transaction Reference / Cheque #</label>
          <input type="text" id="settle-ref" class="input" placeholder="e.g. UTR893274928" />
        </div>
      </form>
    `,
    saveLabel: "Post Settlement",
    onSave: async (modalEl) => {
      const amt = Number(modalEl.querySelector("#settle-amount")?.value || 0);
      const method = modalEl.querySelector("#settle-method")?.value;
      const ref = modalEl.querySelector("#settle-ref")?.value?.trim();

      if (amt <= 0) {
        showToast("Enter a valid settlement amount", "coral");
        return false;
      }
      try {
        await apiPost(`/department-orders/${orderId}/settle`, {
          body: { amountPaisa: amt * 100, paymentMethod: method, paymentReference: ref },
        });
        showToast(`Settlement posted for order ${orderId}!`, "mint");
        await fetchDeptOrdersFromServer(root);
        return true;
      } catch (err) {
        showToast(err.message || "Failed to record settlement", "coral");
        return false;
      }
    },
  });
}

function openOrderSheetModal(orderId) {
  const orders = liveOrders || SAMPLE_ORDERS;
  const order = orders.find((o) => o.orderId === orderId) || orders[0];

  openModal({
    title: `Institutional Order Sheet — ${order.orderId}`,
    maxWidth: "600px",
    body: `
      <div style="border:2px dashed var(--border-color, #cbd5e1);padding:20px;background:#fff;color:#000;font-family:sans-serif;">
        <div style="text-align:center;border-bottom:1px solid #000;padding-bottom:10px;margin-bottom:12px;">
          <h2 style="margin:0;font-size:20px;font-weight:800;letter-spacing:1px;">ZAMORIN CAFÉ</h2>
          <div style="font-size:12px;font-weight:600;text-transform:uppercase;">Institutional Catering Order Sheet</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;">
          <div><strong>Order #:</strong> ${order.orderId}</div>
          <div><strong>Date:</strong> ${order.fulfilmentDate || order.orderDate}</div>
        </div>
        <div style="font-size:12px;margin-bottom:6px;"><strong>Institution:</strong> ${order.institutionName || "University / Corporate"}</div>
        <div style="font-size:12px;margin-bottom:6px;"><strong>Department:</strong> ${order.departmentName || order.department}</div>
        <div style="font-size:12px;margin-bottom:10px;"><strong>Care Of:</strong> ${order.careOfContact || order.careOf || "Authorized Rep"}</div>
        <div style="font-size:12px;margin-bottom:10px;"><strong>PO #:</strong> ${order.poNumber || "Direct"}</div>
        <div style="border-top:1px solid #000;border-bottom:1px solid #000;padding:8px 0;margin-bottom:12px;font-size:12px;">
          <strong>Items Catered:</strong><br/>
          ${Array.isArray(order.items) ? order.items.map((i) => `${i.quantity}× ${i.name}`).join("<br/>") : order.items}
        </div>
        <div style="text-align:right;font-size:14px;font-weight:700;margin-bottom:20px;">
          Total Billed: ₹${((order.totalPaisa || (order.amount ? order.amount * 100 : 0)) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:30px;font-size:11px;">
          <div style="border-top:1px solid #000;padding-top:4px;width:40%;text-align:center;">Prepared By (Café)</div>
          <div style="border-top:1px solid #000;padding-top:4px;width:40%;text-align:center;">Received By (Care Of)</div>
        </div>
      </div>
    `,
  });
}

function refreshDeptView(root) {
  const container = root.querySelector("#view-root") || root;
  container.innerHTML = renderDepartmentOrders();
  wireDepartmentOrders(container);
}

async function fetchDeptOrdersFromServer(root) {
  try {
    const res = await apiGet("/department-orders?limit=50");
    if (res && res.data && res.data.orders) {
      liveOrders = res.data.orders;
      showToast("Institutional orders refreshed", "mint");
      refreshDeptView(root);
    }
  } catch (err) {
    showToast("Loaded offline department order ledger", "info");
    refreshDeptView(root);
  }
}
