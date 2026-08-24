import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { state } from "../state.js";
import { showToast, openModal, confirmAction, renderCafeContextStrip, renderModuleErrorState } from "../components.js";
import { ROLES } from "../navigation.js";
import { navigate } from "../router.js";

let activeSubTab = "overview"; // 'overview' | 'directory' | 'rewards' | 'segments' | 'feedback' | 'integrity' | 'governance'
let cachedOverview = null;
let cachedCustomers = [];
let cachedRewards = [];
let cachedFeedbacks = [];
let cachedProgramme = null;

export function setCustomersActiveTab(tab) {
  activeSubTab = tab || "overview";
}

export function renderCustomers(subroute) {
  if (subroute !== undefined) {
    activeSubTab = subroute || "overview";
  }
  const isPrimary = state.user?.isPrimaryMaster === true;

  // If on child subroute, render dedicated child shell directly
  if (activeSubTab && activeSubTab !== "overview") {
    return `
      <div class="page-enter" style="max-width:1400px; margin:0 auto; padding-bottom:60px;">
        <div id="cust-subpanel-root">
          ${renderActiveSubpanel()}
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter" style="max-width:1400px; margin:0 auto; padding-bottom:60px;">
      <!-- Page Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:16px; border-bottom:1px solid var(--border-subtle); padding-bottom:16px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            <h1 class="page-title" style="font-size:24px; font-weight:800; margin:0; color:var(--ink); letter-spacing:-0.3px;">Customer Directory &amp; Loyalty Rewards</h1>
            <span class="status info" style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">SCR-006</span>
            ${
              isPrimary
                ? `<span class="status success" style="font-size:10px; font-weight:700;">PRIMARY MASTER</span>`
                : `<span class="status info" style="font-size:10px; font-weight:700;">OPERATIONAL MASTER</span>`
            }
          </div>
          <p style="font-size:13px; color:var(--muted); margin:0;">
            Customer Master · Customer 360 · Loyalty Programme &amp; Ledger · Rewards · Feedback &amp; Service Recovery · Privacy
          </p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="btn btn-secondary" id="refresh-cust-btn" type="button" style="display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Customers
          </button>
        </div>
      </div>

      <!-- Scope Context Banner -->
      ${renderCafeContextStrip()}

      <!-- Subpanel Root -->
      <div id="cust-subpanel-root">
        ${renderActiveSubpanel()}
      </div>
    </div>
  `;
}

function renderActiveSubpanel() {
  if (activeSubTab === "overview") {
    return renderOverviewSubpanel();
  }

  const submodules = {
    directory: {
      title: "Customer 360° Directory",
      icon: "👤",
      desc: "Guest profiles, purchase history, favorite orders and contact preferences.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-reg-guest" type="button">+ Register New Guest</button>`
    },
    rewards: {
      title: "Loyalty Points & Rewards Catalogue",
      icon: "🎁",
      desc: "Active rewards, point redemption thresholds and tiered benefits.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-reward" type="button">+ Add Reward Tier</button>`
    },
    segments: {
      title: "Customer Segments & Retention",
      icon: "🎯",
      desc: "VIP guests, regular commuters, churn risk and automated engagement.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-segment" type="button">+ Create Segment</button>`
    },
    feedback: {
      title: "Guest Feedback & Service Recovery",
      icon: "💬",
      desc: "NPS ratings, barista compliments, service incident tracking and resolution.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-log-feedback" type="button">+ Record Feedback</button>`
    },
    integrity: {
      title: "Loyalty Ledger Integrity",
      icon: "🛡️",
      desc: "Point balance invariant audits, double-spend guards and POS sync.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-audit-loyalty" type="button">Run Audit Invariant</button>`
    },
    governance: {
      title: "Programme Governance & Privacy",
      icon: "📜",
      desc: "DPDP statutory compliance, opt-out management and data retention rules.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-dpdp-settings" type="button">DPDP Settings</button>`
    },
  };

  const cur = submodules[activeSubTab] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  let bodyHtml = "";
  switch (activeSubTab) {
    case "directory": bodyHtml = renderDirectorySubpanel(); break;
    case "rewards": bodyHtml = renderRewardsSubpanel(); break;
    case "segments": bodyHtml = renderSegmentsSubpanel(); break;
    case "feedback": bodyHtml = renderFeedbackSubpanel(); break;
    case "integrity": bodyHtml = renderIntegritySubpanel(); break;
    case "governance": bodyHtml = renderGovernanceSubpanel(); break;
    default: bodyHtml = renderOverviewSubpanel();
  }

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
              <button id="cust-back-to-hub-btn" data-back-to-hub="true" data-customers-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Customers
              </button>
              <span>/</span>
              <span style="color:var(--ink); font-weight:600;">${cur.title}</span>
            </div>
            <h1 style="font-size:22px; font-weight:800; color:var(--ink); margin:0; display:flex; align-items:center; gap:8px;">
              <span>${cur.icon}</span> <span>${cur.title}</span>
            </h1>
            <p style="font-size:12.5px; color:var(--muted); margin:4px 0 0 0;">${cur.desc}</p>
          </div>
          ${cur.actionsHtml ? `<div style="display:flex; gap:8px; align-items:center;">${cur.actionsHtml}</div>` : ''}
        </div>
      </div>
      <div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

// 1. OVERVIEW SUBPANEL
function renderOverviewSubpanel() {
  const isCafeOps = state.role === ROLES.CAFE_ADMIN;
  const userCafe = state.auth?.user?.primaryCafeId || state.user?.primaryCafeId || "ZC-0001";

  const ov = cachedOverview || {
    kpis: {
      totalCustomers: isCafeOps ? 620 : 1240,
      activeMembers: isCafeOps ? 480 : 980,
      repeatCustomers: isCafeOps ? 320 : 642,
      outstandingPoints: isCafeOps ? 42100 : 84250,
      rewardsRedeemed: isCafeOps ? 82 : 148,
      rewardsAvailable: 184,
      lapsedMembers: isCafeOps ? 60 : 124,
      memberSales: isCafeOps ? 215400 : 412500,
      averageMemberBill: 341.60,
      feedbackOpen: isCafeOps ? 1 : 3,
    },
    cafeSummary: isCafeOps
      ? [{ cafeId: "ZC-0001", cafeName: "Dawn Roast — Koramangala", customerCount: 620, memberSales: 215400, rewardsRedeemed: 82, feedbackOpen: 1 }]
      : [
          { cafeId: "ZC-0001", cafeName: "Dawn Roast — Koramangala", customerCount: 620, memberSales: 215400, rewardsRedeemed: 82, feedbackOpen: 1 },
          { cafeId: "ZC-0002", cafeName: "Indiranagar Central", customerCount: 410, memberSales: 138600, rewardsRedeemed: 44, feedbackOpen: 2 },
          { cafeId: "ZC-0003", cafeName: "Calicut Beach", customerCount: 210, memberSales: 58500, rewardsRedeemed: 22, feedbackOpen: 0 },
        ],
    controlStrip: {
      newMembersToday: isCafeOps ? 6 : 12,
      rewardsAvailable: 184,
      pointsExpiringSoon: isCafeOps ? 36 : 72,
      duplicateCandidates: 4,
      reconciliationIssues: 0,
      feedbackOpen: isCafeOps ? 1 : 3,
    },
  };

  const visibleSummaries = isCafeOps
    ? ov.cafeSummary.filter((c) => c.cafeId === userCafe)
    : ov.cafeSummary;

  const custTiles = [
    { id: "directory", icon: "👤", title: "Customer Directory", subtitle: "Guest profiles, purchase history & phone lookup", badge: `${ov.kpis.totalCustomers} Guests`, badgeType: "accent" },
    { id: "rewards", icon: "🎁", title: "Loyalty & Rewards", subtitle: "Reward redemption catalogue & points ledger", badge: `${ov.kpis.rewardsRedeemed} Redeemed`, badgeType: "success" },
    { id: "segments", icon: "🎯", title: "Segments & Retention", subtitle: "VIP guests, regular commuters & churn risks", badge: "Automated", badgeType: "" },
    { id: "feedback", icon: "💬", title: "Feedback & Recovery", subtitle: "Guest reviews, NPS scores & service incidents", badge: `${ov.kpis.feedbackOpen} Open`, badgeType: ov.kpis.feedbackOpen > 0 ? "warning" : "success" },
    { id: "integrity", icon: "🛡️", title: "Loyalty Integrity", subtitle: "Ledger invariant audits & POS sync state", badge: "Zero Violations", badgeType: "success" },
    { id: "governance", icon: "📜", title: "Governance & Privacy", subtitle: "DPDP statutory compliance & privacy rules", badge: "DPDP Ready", badgeType: "success" },
  ];

  return `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Customer Relationship &amp; Loyalty Workspaces</h3>
        <div class="module-tile-grid">
          ${custTiles.map((t) => `
            <button class="module-hub-tile" data-cust-hub-tile="${t.id}" type="button">
              <div class="module-tile-icon-box">${t.icon}</div>
              <div class="module-tile-content">
                <div class="module-tile-title-row">
                  <span class="module-tile-title">${t.title}</span>
                  ${t.badge ? `<span class="module-tile-badge ${t.badgeType}">${t.badge}</span>` : ""}
                </div>
                <div class="module-tile-sub">${t.subtitle}</div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Top KPI Row -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px;">
      ${kpiCard("Total Customers", `${ov.kpis.totalCustomers}`, "Profiles Registered", "var(--ink)")}
      ${kpiCard("Active Members", `${ov.kpis.activeMembers}`, "30-Day Activity", "var(--color-success, #2E7D32)")}
      ${kpiCard("Repeat Guests", `${ov.kpis.repeatCustomers}`, "> 1 Verified Visit", "var(--ink)")}
      ${kpiCard("Outstanding Points", `${Number(ov.kpis.outstandingPoints).toLocaleString("en-IN")} pts`, "Active Loyalty Balance", "var(--color-accent-amber, #C89D5C)")}
      ${kpiCard("Rewards Redeemed", `${ov.kpis.rewardsRedeemed}`, "Vouchers Claimed", "var(--ink)")}
      ${kpiCard("Member Sales", `₹${Number(ov.kpis.memberSales).toLocaleString("en-IN")}`, "Lifetime Member Spend", "var(--color-success)")}
      ${kpiCard("Average Bill", `₹${ov.kpis.averageMemberBill}`, "Per Member Visit", "var(--ink)")}
      ${kpiCard("Open Feedback", `${ov.kpis.feedbackOpen}`, "Pending Review", ov.kpis.feedbackOpen > 0 ? "var(--color-warning, #ED6C02)" : "var(--color-success)")}
    </div>

    <!-- Operational Control Strip -->
    <div style="padding:12px 18px; background:var(--bg-subtle, rgba(0,0,0,0.02)); border:1px solid var(--border-subtle); border-radius:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:24px;">
      <div style="display:flex; gap:16px; font-size:12.5px; font-weight:700;">
        <span style="color:var(--color-success);">✓ NEW MEMBERS TODAY: ${ov.controlStrip.newMembersToday}</span>
        <span style="color:var(--color-success);">✓ REWARDS AVAILABLE: ${ov.controlStrip.rewardsAvailable}</span>
        <span style="color:var(--color-warning);">● POINTS EXPIRING: ${ov.controlStrip.pointsExpiringSoon}</span>
        <span style="color:var(--color-accent-amber);">● DUPLICATES TO MERGE: ${ov.controlStrip.duplicateCandidates}</span>
      </div>
      <button class="btn btn-ghost" id="drill-directory-btn" type="button" style="font-size:12px; padding:4px 10px;">
        Open Customer Directory →
      </button>
    </div>

    <!-- Café Customer Summary / Portfolio -->
    <h3 style="font-size:15px; font-weight:700; margin:0 0 12px; color:var(--ink);">${isCafeOps ? "Café Customer &amp; Loyalty Summary" : "Café Customer Portfolio"}</h3>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:16px;">
      ${visibleSummaries
        .map(
          (c) => `
        <div class="card" style="padding:18px; border-radius:8px; background:var(--bg-surface); border:1px solid var(--border-subtle);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="font-size:14.5px; color:var(--ink);">${c.cafeName}</strong>
            <span class="status info" style="font-size:10.5px; font-family:var(--font-mono); font-weight:700;">${c.cafeId}</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12.5px;">
            <div><span style="color:var(--muted);">Members:</span> <strong>${c.customerCount}</strong></div>
            <div><span style="color:var(--muted);">Sales:</span> <strong>₹${Number(c.memberSales).toLocaleString("en-IN")}</strong></div>
            <div><span style="color:var(--muted);">Redeemed:</span> <strong>${c.rewardsRedeemed}</strong></div>
            <div><span style="color:var(--muted);">Feedback Open:</span> <strong style="color:${c.feedbackOpen > 0 ? "var(--color-warning)" : "var(--color-success)"}">${c.feedbackOpen}</strong></div>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// 2. CUSTOMER DIRECTORY SUBPANEL
function renderDirectorySubpanel() {
  const customers = cachedCustomers.length > 0 ? cachedCustomers : [
    {
      customerId: "CUST-0001",
      membershipId: "ZAM-MEM-0001",
      name: "Aditya Namboodiri",
      phone: "+91 98450 11990",
      email: "aditya@domain.com",
      tier: "GOLD",
      pointsBalance: 420,
      totalVisits: 28,
      totalSpendPaisa: 840000,
      preferredCafeId: "ZC-0001",
      status: "ACTIVE",
    },
    {
      customerId: "CUST-0002",
      membershipId: "ZAM-MEM-0002",
      name: "Meera Krishnan",
      phone: "+91 98450 22880",
      email: "meera.k@domain.com",
      tier: "PLATINUM",
      pointsBalance: 1150,
      totalVisits: 54,
      totalSpendPaisa: 2260000,
      preferredCafeId: "ZC-0001",
      status: "ACTIVE",
    },
    {
      customerId: "CUST-0003",
      membershipId: "ZAM-MEM-0003",
      name: "Rohan Varma",
      phone: "+91 98450 33770",
      email: "rohan@domain.com",
      tier: "SILVER",
      pointsBalance: 180,
      totalVisits: 12,
      totalSpendPaisa: 360000,
      preferredCafeId: "ZC-0002",
      status: "ACTIVE",
    },
    {
      customerId: "CUST-0004",
      membershipId: "ZAM-MEM-0004",
      name: "Kavita Rao",
      phone: "+91 98450 44660",
      email: "kavita@domain.com",
      tier: "BRONZE",
      pointsBalance: 50,
      totalVisits: 2,
      totalSpendPaisa: 58000,
      preferredCafeId: "ZC-0001",
      status: "ACTIVE",
    },
  ];

  return `
    <div class="card" style="padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
        <input type="text" class="input" id="cust-search-input" placeholder="Search by Name, Phone, Email, Membership ID, or B2B GSTIN..." style="max-width:440px; font-size:13px;">
        <div style="display:flex; gap:8px;">
          <select class="input" id="cust-tier-filter" style="font-size:12.5px; width:auto;">
            <option value="">All Tiers</option>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PLATINUM">Platinum VIP</option>
          </select>
          <select class="input" id="cust-cafe-filter" style="font-size:12.5px; width:auto;">
            <option value="">All Cafés</option>
            <option value="ZC-0001">Dawn Roast Koramangala</option>
            <option value="ZC-0002">Indiranagar Central</option>
            <option value="ZC-0003">Calicut Beach</option>
          </select>
          <button class="btn btn-ghost" id="open-merge-btn" type="button" style="font-size:12px;">Merge Duplicates</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>Member</th>
              <th>Contact</th>
              <th>Tier</th>
              <th>Loyalty Points</th>
              <th>Visits</th>
              <th>Total Spend</th>
              <th>Home Café</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${customers
              .map((c) => {
                const tierClass = c.tier === "PLATINUM" ? "purple" : c.tier === "GOLD" ? "warning" : c.tier === "SILVER" ? "info" : "default";
                const totalSpent = ((c.totalSpendPaisa || 0) / 100).toFixed(0);

                return `
                <tr>
                  <td>
                    <strong style="color:var(--ink); font-size:13.5px;">${c.name}</strong>
                    <div style="font-size:11px; color:var(--muted); font-family:var(--font-mono);">${c.membershipId || c.customerId}</div>
                  </td>
                  <td>
                    <div style="font-size:12.5px; color:var(--ink); font-family:var(--font-mono);">${c.phone}</div>
                    <div style="font-size:11px; color:var(--muted);">${c.email || "No email"}</div>
                  </td>
                  <td><span class="status ${tierClass}" style="font-size:11px; font-weight:700;">${c.tier}</span></td>
                  <td><strong style="font-family:var(--font-mono); color:var(--color-accent-amber); font-size:14px;">${c.pointsBalance || 0} pts</strong></td>
                  <td><strong style="font-size:13px; color:var(--ink);">${c.totalVisits || 0} visits</strong></td>
                  <td style="font-family:var(--font-mono); font-weight:700; color:var(--ink);">₹${Number(totalSpent).toLocaleString("en-IN")}</td>
                  <td><span class="status info" style="font-size:11px; font-family:var(--font-mono);">${c.preferredCafeId || "ZC-0001"}</span></td>
                  <td><span class="status success" style="font-size:10.5px;">${c.status || "ACTIVE"}</span></td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                      <button class="btn btn-ghost view-cust-360-btn" data-cust="${c.customerId}" type="button" style="font-size:12px; padding:4px 10px;">
                        Customer 360
                      </button>
                      <button class="btn btn-ghost adjust-points-btn" data-cust="${c.customerId}" type="button" style="font-size:12px; padding:4px 10px;">
                        Adjust Pts
                      </button>
                    </div>
                  </td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 3. LOYALTY & REWARDS SUBPANEL
function renderRewardsSubpanel() {
  const rewards = cachedRewards.length > 0 ? cachedRewards : [
    { rewardId: "REW-001", name: "Free Artisan Beverage", customerFacingName: "Complimentary Coffee on Us", pointsCost: 150, rewardType: "FREE_ITEM", minTierRequired: "BRONZE" },
    { rewardId: "REW-002", name: "₹100 Bill Voucher", customerFacingName: "₹100 Off Your Bill", pointsCost: 200, rewardType: "DISCOUNT_AMOUNT", discountPaisa: 10000, minTierRequired: "BRONZE" },
    { rewardId: "REW-003", name: "Complimentary Bakery Item", customerFacingName: "Free Fresh Croissant / Muffin", pointsCost: 180, rewardType: "FREE_CATEGORY_ITEM", minTierRequired: "SILVER" },
    { rewardId: "REW-004", name: "20% Off Weekend Brews", customerFacingName: "20% Exclusive Member Discount", pointsCost: 300, rewardType: "DISCOUNT_PERCENT", discountPercent: 20, minTierRequired: "GOLD" },
  ];

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
      ${rewards
        .map(
          (r) => `
        <div class="card" style="padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <span class="status warning" style="font-size:11px; font-weight:700;">${r.minTierRequired}+ TIER</span>
              <strong style="color:var(--color-accent-amber); font-family:var(--font-mono); font-size:16px;">${r.pointsCost} PTS</strong>
            </div>
            <h3 style="font-size:16px; font-weight:800; margin:0 0 4px; color:var(--ink);">${r.customerFacingName}</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:0 0 12px;">${r.name}</p>
          </div>
          <div style="border-top:1px solid var(--border-subtle); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11.5px; color:var(--muted); font-family:var(--font-mono);">${r.rewardId}</span>
            <span class="status success" style="font-size:10.5px;">ACTIVE</span>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// 4. SEGMENTS SUBPANEL
function renderSegmentsSubpanel() {
  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Daily Regulars</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">Visited ≥ 5 times in the last 14 days</p>
        <div style="font-size:32px; font-weight:800; color:var(--color-success); font-family:var(--font-mono);">184</div>
        <div style="font-size:12px; color:var(--muted); margin-top:6px;">High retention cohort · Avg. spend ₹480/week</div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Platinum VIP Members</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">Lifetime spend > ₹25,000</p>
        <div style="font-size:32px; font-weight:800; color:var(--color-accent-amber); font-family:var(--font-mono);">76</div>
        <div style="font-size:12px; color:var(--muted); margin-top:6px;">Top revenue contributors · Priority hospitality</div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Lapsed (45+ Days)</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">No visits in the last 45 days</p>
        <div style="font-size:32px; font-weight:800; color:var(--color-warning); font-family:var(--font-mono);">124</div>
        <div style="font-size:12px; color:var(--muted); margin-top:6px;">Target for re-engagement courtesy offers via MailOps</div>
      </div>
    </div>
  `;
}

// 5. FEEDBACK & SERVICE RECOVERY SUBPANEL
function renderFeedbackSubpanel() {
  const feedbacks = cachedFeedbacks.length > 0 ? cachedFeedbacks : [
    { feedbackId: "FB-001", customerId: "CUST-0002", cafeId: "ZC-0001", rating: 5, category: "SERVICE", comment: "Exceptional pour-over coffee and warm barista greeting!", status: "RESOLVED" },
    { feedbackId: "FB-002", customerId: "CUST-0003", cafeId: "ZC-0002", rating: 3, category: "BILLING", comment: "Wait time at billing counter was slightly long during rush hour.", status: "UNDER_REVIEW" },
  ];

  return `
    <div class="card" style="padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0 0 2px; color:var(--ink);">Customer Feedback &amp; Service Cases</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:0;">In-cafe guest feedback, ratings, and service recovery courtesy vouchers</p>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" style="width:100%;">
          <thead>
            <tr>
              <th>Feedback ID</th>
              <th>Customer</th>
              <th>Café</th>
              <th>Rating</th>
              <th>Category</th>
              <th>Comment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${feedbacks
              .map(
                (f) => `
              <tr>
                <td style="font-family:var(--font-mono); font-size:12px; color:var(--color-accent-amber);">${f.feedbackId}</td>
                <td><strong style="font-size:13px; color:var(--ink);">${f.customerId}</strong></td>
                <td><span class="status info" style="font-size:11px; font-family:var(--font-mono);">${f.cafeId}</span></td>
                <td><strong style="color:var(--color-accent-amber); font-size:14px;">${"★".repeat(f.rating)}</strong></td>
                <td><span class="status default" style="font-size:11px;">${f.category}</span></td>
                <td style="font-size:12.5px; color:var(--ink); max-width:320px;">${f.comment}</td>
                <td><span class="status ${f.status === "RESOLVED" ? "success" : "warning"}" style="font-size:10.5px;">${f.status}</span></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 6. LOYALTY INTEGRITY SUBPANEL
function renderIntegritySubpanel() {
  return `
    <div class="card" style="padding:24px; max-width:840px; margin:0 auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0 0 2px; color:var(--ink);">Loyalty Ledger Integrity &amp; Reconciliation</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:0;">Point balances ↔ POS accruals ↔ Refund reversals ↔ Redemptions</p>
        </div>
        <span class="status success" style="font-size:11px; font-weight:700;">HEALTHY (100%)</span>
      </div>

      <div style="padding:16px; border:1px solid var(--border-subtle); border-radius:8px; margin-bottom:20px; font-size:13px;">
        <h4 style="font-size:13.5px; font-weight:700; margin:0 0 10px; color:var(--ink);">Automated Integrity Checks</h4>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Duplicate Loyalty Accruals:</span><strong style="color:var(--color-success);">0 (PASSED)</strong></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Negative Balance Anomalies:</span><strong style="color:var(--color-success);">0 (PASSED)</strong></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Orphan Loyalty Events:</span><strong style="color:var(--color-success);">0 (PASSED)</strong></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Double Reward Redemptions:</span><strong style="color:var(--color-success);">0 (PASSED)</strong></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Refund Reversal Mismatches:</span><strong style="color:var(--color-success);">0 (PASSED)</strong></div>
      </div>
    </div>
  `;
}

// 7. GOVERNANCE & PRIVACY SUBPANEL
function renderGovernanceSubpanel() {
  const prog = cachedProgramme?.programme || {
    programmeVersion: "V1.0",
    spendToPointsRatio: 0.1,
    pointsExpiryDays: 365,
  };

  return `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:20px;">
      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Active Programme Version: ${prog.programmeVersion}</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">Governed earning rules and tier qualification policy</p>

        <div style="font-size:13px; line-height:1.8;">
          <div>Earn Rate: <strong>1 Point per ₹10 Spent</strong></div>
          <div>Points Expiry: <strong>365 Days</strong></div>
          <div>Tier Multipliers: <strong>Bronze 1.0× · Silver 1.25× · Gold 1.5× · Platinum 2.0×</strong></div>
        </div>
      </div>

      <div class="card" style="padding:20px;">
        <h3 style="font-size:15px; font-weight:700; margin:0 0 4px; color:var(--ink);">Privacy &amp; Consent Governance</h3>
        <p style="font-size:12px; color:var(--muted); margin:0 0 16px;">Consent provenance, suppression lists, and erasure requests</p>

        <div style="font-size:13px; line-height:1.8;">
          <div>Transactional Receipts: <strong>Consent Active</strong></div>
          <div>Marketing Email/SMS: <strong>Opt-In Governed</strong></div>
          <div>Open Privacy Requests: <strong>0</strong></div>
        </div>
      </div>
    </div>
  `;
}

// Helper: KPI Card
function kpiCard(title, value, subtitle, valColor) {
  return `
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.4px; margin-bottom:4px;">${title}</div>
      <div style="font-size:22px; font-weight:800; color:${valColor}; font-family:var(--font-mono); line-height:1.1;">${value}</div>
      <div style="font-size:11px; color:var(--muted); margin-top:4px;">${subtitle}</div>
    </div>
  `;
}

export async function wireCustomers(root, subroute) {
  if (subroute !== undefined) {
    activeSubTab = subroute || "overview";
  }
  // Customer Hub Tiles
  root.querySelectorAll("[data-cust-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tileId = e.currentTarget.dataset.custHubTile;
      navigate("customers/" + tileId);
    });
  });

  // Back to Customer Hub Button
  root.querySelector("#cust-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("customers");
  });

  // Navigation tabs (legacy)
  root.querySelectorAll(".cust-nav-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      activeSubTab = e.currentTarget.dataset.tab;
      rerender(root);
    });
  });

  // Refresh
  root.querySelector("#refresh-cust-btn")?.addEventListener("click", async () => {
    await loadCustomerData();
    rerender(root);
    showToast("Customers & Loyalty data refreshed.", "info");
  });

  // Drill to directory
  root.querySelector("#drill-directory-btn")?.addEventListener("click", () => {
    activeSubTab = "directory";
    rerender(root);
  });

  // Register Guest button (GLOBAL UI-001: mounts above sidebar on --layer-modal)
  root.querySelector("#open-register-cust-btn")?.addEventListener("click", () => {
    openRegisterCustomerModal(root);
  });

  // Customer 360 button
  root.querySelectorAll(".view-cust-360-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const custId = btn.dataset.cust;
      const cust = cachedCustomers.find((c) => c.customerId === custId);
      if (cust) openCustomer360Modal(cust);
    });
  });

  // Adjust Points button
  root.querySelectorAll(".adjust-points-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const custId = btn.dataset.cust;
      const cust = cachedCustomers.find((c) => c.customerId === custId);
      if (cust) openAdjustPointsModal(cust, root);
    });
  });

  // Merge Duplicates button
  root.querySelector("#open-merge-btn")?.addEventListener("click", () => {
    openMergeModal(root);
  });

  // Initial load
  if (!cachedOverview) {
    loadCustomerData().then(() => {
      if (state.route?.startsWith("customers")) {
        rerender(root);
      }
    });
  }
}

async function loadCustomerData() {
  try {
    const [ovRes, listRes, rewRes, fbRes, progRes] = await Promise.all([
      apiGet("/api/v1/customers/overview").catch(() => null),
      apiGet("/api/v1/customers").catch(() => null),
      apiGet("/api/v1/customers/rewards/catalogue").catch(() => null),
      apiGet("/api/v1/customers/feedback").catch(() => null),
      apiGet("/api/v1/customers/programme/current").catch(() => null),
    ]);

    if (ovRes?.data) cachedOverview = ovRes.data;
    if (listRes?.data?.customers) cachedCustomers = listRes.data.customers;
    if (rewRes?.data?.rewards) cachedRewards = rewRes.data.rewards;
    if (fbRes?.data?.feedbacks) cachedFeedbacks = fbRes.data.feedbacks;
    if (progRes?.data) cachedProgramme = progRes.data;
  } catch (err) {
    console.warn("Customer data load notice:", err);
  }
}

function rerender(root) {
  if (!state.route?.startsWith("customers")) return;
  const subpanelRoot = root?.querySelector ? root.querySelector("#cust-subpanel-root") : null;
  if (subpanelRoot) {
    subpanelRoot.innerHTML = renderActiveSubpanel();
    root.querySelectorAll("[data-cust-hub-tile]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tileId = e.currentTarget.dataset.custHubTile;
        navigate("customers/" + tileId);
      });
    });
    root.querySelector("#cust-back-to-hub-btn")?.addEventListener("click", () => {
      navigate("customers");
    });
  } else {
    root.innerHTML = renderCustomers();
    wireCustomers(root);
  }
}

// Modal: Register Customer (GLOBAL UI-001)
function openRegisterCustomerModal(root) {
  const content = `
    <div style="max-width:540px; margin:0 auto; padding:10px 0;">
      <h3 style="font-size:17px; font-weight:800; margin:0 0 6px; color:var(--ink);">Register New Guest</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Create guest profile and enrol into Zamorin Loyalty Programme.</p>

      <div class="form-group">
        <label class="label">Guest Full Name*</label>
        <input type="text" id="new-cust-name" class="input" placeholder="e.g. Meera Krishnan" required>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="label">Mobile Number*</label>
          <input type="tel" id="new-cust-phone" class="input" placeholder="+91 98450 11223" required>
        </div>
        <div class="form-group">
          <label class="label">Email Address (Optional)</label>
          <input type="email" id="new-cust-email" class="input" placeholder="guest@domain.com">
        </div>
      </div>

      <div class="form-group">
        <label class="label">Preferred Home Café</label>
        <select id="new-cust-cafe" class="input">
          <option value="ZC-0001">Dawn Roast Koramangala</option>
          <option value="ZC-0002">Indiranagar Central</option>
          <option value="ZC-0003">Calicut Beach</option>
        </select>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid var(--border-subtle); padding-top:14px;">
        <button class="btn btn-ghost" id="reg-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="reg-submit-btn" type="button">Register Guest</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#reg-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#reg-submit-btn")?.addEventListener("click", async () => {
    const name = modal.querySelector("#new-cust-name")?.value;
    const phone = modal.querySelector("#new-cust-phone")?.value;
    const email = modal.querySelector("#new-cust-email")?.value;
    const preferredCafeId = modal.querySelector("#new-cust-cafe")?.value;

    if (!name || !phone) {
      showToast("Name and phone number are required.", "error");
      return;
    }

    try {
      await apiPost("/api/v1/customers", { name, phone, email, preferredCafeId });
      showToast("Guest profile created successfully.", "success");
      modal.close();
      await loadCustomerData();
      rerender(root);
    } catch (err) {
      showToast(err.message || "Failed to register guest.", "error");
    }
  });
}

// Modal: Customer 360 Detail
function openCustomer360Modal(cust) {
  const content = `
    <div style="max-width:640px; margin:0 auto; padding:10px 0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid var(--border-subtle); padding-bottom:12px;">
        <div>
          <h3 style="font-size:18px; font-weight:800; margin:0; color:var(--ink);">${cust.name}</h3>
          <div style="font-size:12px; color:var(--muted); font-family:var(--font-mono);">${cust.membershipId || cust.customerId} · ${cust.phone}</div>
        </div>
        <span class="status ${cust.tier === "PLATINUM" ? "purple" : cust.tier === "GOLD" ? "warning" : "info"}" style="font-size:12px; font-weight:800;">
          ${cust.tier} TIER
        </span>
      </div>

      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:18px;">
        <div style="padding:12px; background:var(--bg-subtle, #faf8f5); border-radius:6px;">
          <div style="font-size:11px; color:var(--muted);">Loyalty Balance</div>
          <strong style="font-size:18px; color:var(--color-accent-amber); font-family:var(--font-mono);">${cust.pointsBalance || 0} pts</strong>
        </div>
        <div style="padding:12px; background:var(--bg-subtle, #faf8f5); border-radius:6px;">
          <div style="font-size:11px; color:var(--muted);">Total Visits</div>
          <strong style="font-size:18px; color:var(--ink); font-family:var(--font-mono);">${cust.totalVisits || 0} visits</strong>
        </div>
        <div style="padding:12px; background:var(--bg-subtle, #faf8f5); border-radius:6px;">
          <div style="font-size:11px; color:var(--muted);">Lifetime Spend</div>
          <strong style="font-size:18px; color:var(--color-success); font-family:var(--font-mono);">₹${(((cust.totalSpendPaisa || 0) / 100)).toLocaleString("en-IN")}</strong>
        </div>
      </div>

      <div style="font-size:13px; line-height:1.7; margin-bottom:18px;">
        <div>Preferred Café: <strong>${cust.preferredCafeId || "ZC-0001"}</strong></div>
        <div>Email: <strong>${cust.email || "Not specified"}</strong></div>
        <div>Consent: <strong>Transactional Receipts (Active) · Loyalty Communications (Active)</strong></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--border-subtle); padding-top:14px;">
        <button class="btn btn-primary" id="c360-close-btn" type="button">Close</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#c360-close-btn")?.addEventListener("click", () => modal.close());
}

// Modal: Adjust Points
function openAdjustPointsModal(cust, root) {
  const content = `
    <div style="max-width:500px; margin:0 auto; padding:10px 0;">
      <h3 style="font-size:16px; font-weight:800; margin:0 0 6px; color:var(--ink);">Adjust Loyalty Points: ${cust.name}</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Current balance: <strong>${cust.pointsBalance || 0} pts</strong></p>

      <div class="form-group">
        <label class="label">Action*</label>
        <select id="adj-action" class="input">
          <option value="ADD">Add Points (+)</option>
          <option value="SUBTRACT">Deduct Points (-)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="label">Points Amount*</label>
        <input type="number" id="adj-amount" class="input" placeholder="e.g. 50" min="1" required>
      </div>

      <div class="form-group">
        <label class="label">Mandatory Reason Code*</label>
        <select id="adj-reason" class="input">
          <option value="Missing Earn Transaction">Missing Earn Transaction</option>
          <option value="Customer Service Correction">Customer Service Correction</option>
          <option value="Promotional Award">Promotional Award</option>
          <option value="Administrative Correction">Administrative Correction</option>
        </select>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
        <button class="btn btn-ghost" id="adj-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="adj-submit-btn" type="button">Apply Adjustment</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#adj-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#adj-submit-btn")?.addEventListener("click", async () => {
    const action = modal.querySelector("#adj-action")?.value;
    const points = Number(modal.querySelector("#adj-amount")?.value);
    const reasonCode = modal.querySelector("#adj-reason")?.value;

    if (!points || points <= 0) {
      showToast("Please enter a valid points amount.", "error");
      return;
    }

    try {
      await apiPost(`/api/v1/customers/${encodeURIComponent(cust.customerId)}/loyalty/adjust`, {
        action,
        points,
        reasonCode,
      });
      showToast("Loyalty points adjusted successfully.", "success");
      modal.close();
      await loadCustomerData();
      rerender(root);
    } catch (err) {
      showToast(err.message || "Failed to adjust points.", "error");
    }
  });
}

// Modal: Merge Duplicates
function openMergeModal(root) {
  const content = `
    <div style="max-width:520px; margin:0 auto; padding:10px 0;">
      <h3 style="font-size:16px; font-weight:800; margin:0 0 6px; color:var(--ink);">Merge Duplicate Customer Profiles</h3>
      <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Combines purchase history, visit logs, and loyalty points into the primary profile.</p>

      <div class="form-group">
        <label class="label">Primary Customer ID (To Keep)*</label>
        <input type="text" id="merge-primary-id" class="input" placeholder="e.g. CUST-0001" required>
      </div>

      <div class="form-group">
        <label class="label">Duplicate Customer ID (To Merge &amp; Close)*</label>
        <input type="text" id="merge-dup-id" class="input" placeholder="e.g. CUST-0004" required>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
        <button class="btn btn-ghost" id="merge-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-primary" id="merge-submit-btn" type="button">Execute Merge</button>
      </div>
    </div>
  `;

  const modal = openModal(content);
  modal.querySelector("#merge-cancel-btn")?.addEventListener("click", () => modal.close());
  modal.querySelector("#merge-submit-btn")?.addEventListener("click", async () => {
    const primaryCustomerId = modal.querySelector("#merge-primary-id")?.value;
    const duplicateCustomerId = modal.querySelector("#merge-dup-id")?.value;

    if (!primaryCustomerId || !duplicateCustomerId) {
      showToast("Both customer IDs are required.", "error");
      return;
    }

    try {
      await apiPost("/api/v1/customers/merge", { primaryCustomerId, duplicateCustomerId });
      showToast("Profiles merged successfully.", "success");
      modal.close();
      await loadCustomerData();
      rerender(root);
    } catch (err) {
      showToast(err.message || "Failed to merge profiles.", "error");
    }
  });
}
