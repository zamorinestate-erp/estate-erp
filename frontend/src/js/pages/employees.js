// =============================================================================
// ZAMORIN CAFE ERP — SCR-008: EMPLOYEE DIRECTORY & STAFFING
// World-Class HRIS + Workforce Administration + Employee 360 + Positioning
// =============================================================================

import { apiGet, apiPost } from "../apiClient.js";
import { showToast, openModal, renderModuleErrorState } from "../components.js";
import { state } from "../state.js";
import { navigate } from "../router.js";

let activeSubpanel = "overview";
let liveOverview = null;
let liveEmployees = [];
let livePositions = [];
let liveStaffingRequests = [];
let liveIntegrity = null;
let isLoadingData = false;

let searchQuery = "";
let selectedCafe = "ALL";
let selectedDept = "ALL";
let selectedStatus = "ALL";
let selectedWorkerType = "ALL";

export function setEmployeesActiveTab(tab) {
  activeSubpanel = tab || "overview";
}

export function renderEmployees(subroute) {
  if (subroute !== undefined) {
    activeSubpanel = subroute || "overview";
  }

  // If on child subroute, render dedicated child shell directly
  if (activeSubpanel && activeSubpanel !== "overview") {
    return `
      <div class="page-enter" style="padding: 24px; max-width: 1600px; margin: 0 auto; color: var(--ink); padding-bottom:60px;">
        <div id="workforce-content-area">
          ${renderActiveSubpanel()}
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter" style="padding: 24px; max-width: 1600px; margin: 0 auto; color: var(--ink); padding-bottom:60px;">
      <!-- PAGE HEADER -->
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:24px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <h1 style="font-size:26px; font-weight:700; margin:0; color:var(--ink);">Employee Directory &amp; Staffing</h1>
            <span class="badge" style="background:rgba(180,83,9,0.12); color:#b45309; font-weight:600; font-size:12px; padding:4px 10px; border-radius:12px;">SCR-008 HRIS</span>
          </div>
          <p style="font-size:14px; color:var(--muted); margin:4px 0 0;">Authoritative workforce administration, position structure, onboarding, skills matrix, and lifecycle mobility.</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <a class="btn btn-primary" href="#staff-home" style="display:flex; align-items:center; gap:6px; text-decoration:none; font-weight:700;">
            <span>👤</span>
            <span>Open Staff Portal →</span>
          </a>
          <button class="btn btn-secondary" id="refresh-workforce-btn" type="button" style="display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Directory
          </button>
        </div>
      </div>

      <!-- MAIN DYNAMIC CONTENT CONTAINER -->
      <div id="workforce-content-area">
        ${renderActiveSubpanel()}
      </div>
    </div>
  `;
}

function renderActiveSubpanel() {
  if (activeSubpanel === "overview") {
    return renderOverviewSubpanel();
  }

  const submodules = {
    directory: {
      title: "Employee Directory & Profiles",
      icon: "👥",
      desc: "Authoritative staff directory, 360 employee profiles and contact records.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-onboard-emp" type="button">+ Onboard Employee</button>`
    },
    positions: {
      title: "Positions & Org Structure",
      icon: "🏛️",
      desc: "Sanctioned organizational positions, reporting lines and café headcounts.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-add-position" type="button">+ Create Position</button>`
    },
    staffing: {
      title: "Workforce Planning & Staffing",
      icon: "📊",
      desc: "Headcount requests, capacity planning and recruitment approvals.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-staffing-req" type="button">+ Staffing Requisition</button>`
    },
    onboarding: {
      title: "Onboarding & Probation Reviews",
      icon: "🚀",
      desc: "New hire checklists, document verification and 90-day probation reviews.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-review-probation" type="button">Review Probation</button>`
    },
    skills: {
      title: "Skills Matrix & Training Logs",
      icon: "🎓",
      desc: "Barista certifications, food safety training and station competencies.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-verify-skill" type="button">+ Verify Competency</button>`
    },
    documents: {
      title: "Documents, Contracts & Letters",
      icon: "📄",
      desc: "Employment contracts, offer letters, statutory proofs and certificates.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-gen-letter" type="button">+ Generate Letter</button>`
    },
    integrity: {
      title: "Integrity & Offboarding",
      icon: "🔒",
      desc: "Resignation clearance, asset recovery, access revocation and exit interviews.",
      actionsHtml: `<button class="btn btn-sm btn-danger" id="btn-child-init-offboard" type="button">+ Initiate Clearance</button>`
    },
  };

  const cur = submodules[activeSubpanel] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  let bodyHtml = "";
  switch (activeSubpanel) {
    case "directory":
      bodyHtml = renderDirectorySubpanel();
      break;
    case "positions":
      bodyHtml = renderPositionsSubpanel();
      break;
    case "staffing":
      bodyHtml = renderStaffingSubpanel();
      break;
    case "onboarding":
      bodyHtml = renderOnboardingSubpanel();
      break;
    case "skills":
      bodyHtml = renderSkillsSubpanel();
      break;
    case "documents":
      bodyHtml = renderDocumentsSubpanel();
      break;
    case "integrity":
      bodyHtml = renderIntegritySubpanel();
      break;
    default:
      bodyHtml = renderOverviewSubpanel();
  }

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
              <button id="employees-back-to-hub-btn" data-back-to-hub="true" data-workforce-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Workforce
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

// ─── 1. OVERVIEW & WORKFORCE COMMAND ──────────────────────────────────────────
function renderOverviewSubpanel() {
  const kpis = liveOverview?.kpis || {
    activeEmployees: 34,
    approvedCapacity: 38,
    capacityGap: 4,
    employeesOnProbation: 4,
    openPositions: 3,
    frozenPositions: 1,
    newJoiners30Days: 2,
    exits30Days: 1,
    cafesStaffed: 3,
  };
  const strip = liveOverview?.controlStrip || {
    probationReviewsDue: 2,
    certificationsExpiring: 3,
    onboardingIncomplete: 1,
    transfersPending: 1,
    criticalVacancies: 1,
    documentsMissing: 2,
  };
  const cafes = liveOverview?.cafeWorkforce || [
    { cafeId: "ZC-0001", name: "Dawn Roast — Koramangala", totalHeadcount: 14, approvedPositions: 16, capacityGap: 2, openPositions: 1, vacancies: 1, frozenPositions: 1, probation: 2, crossTrained: 6 },
    { cafeId: "ZC-0002", name: "Zamorin Bay — Indiranagar", totalHeadcount: 11, approvedPositions: 12, capacityGap: 1, openPositions: 1, vacancies: 1, frozenPositions: 0, probation: 1, crossTrained: 4 },
    { cafeId: "ZC-0003", name: "Calicut Heritage Flagship", totalHeadcount: 9, approvedPositions: 10, capacityGap: 1, openPositions: 1, vacancies: 1, frozenPositions: 0, probation: 1, crossTrained: 3 },
  ];

  const workforceTiles = [
    { id: "directory", icon: "👥", title: "Employee Directory", subtitle: "Active staff directory, 360 profiles & contacts", badge: `${kpis.activeEmployees} Staff`, badgeType: "accent" },
    { id: "positions", icon: "🏛️", title: "Positions & Org Structure", subtitle: "Sanctioned organizational positions & hierarchy", badge: `${kpis.approvedCapacity || 38} Seats`, badgeType: "" },
    { id: "staffing", icon: "📊", title: "Workforce Planning", subtitle: "Headcount requests, capacity gaps & approvals", badge: `${kpis.capacityGap || 4} Gap`, badgeType: "accent" },
    { id: "onboarding", icon: "🚀", title: "Onboarding & Probation", subtitle: "New hire journeys & 90-day probation reviews", badge: `${kpis.employeesOnProbation} Reviews`, badgeType: "accent" },
    { id: "skills", icon: "🎓", title: "Skills Matrix & Training", subtitle: "Barista certifications & competency levels", badge: "Live Matrix", badgeType: "success" },
    { id: "documents", icon: "📄", title: "Documents & Letters", subtitle: "Statutory letters, employment contracts & IDs", badge: "Governed", badgeType: "success" },
    { id: "integrity", icon: "🔒", title: "Integrity & Offboarding", subtitle: "Resignation clearance, asset recovery & exit", badge: "Audit Clean", badgeType: "" },
  ];

  return `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Workforce &amp; HRIS Workspaces</h3>
        <div class="module-tile-grid">
          ${workforceTiles.map((t) => `
            <button class="module-hub-tile" data-workforce-hub-tile="${t.id}" type="button">
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

      <!-- TOP KPIS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">Active Employees</div>
          <div style="font-size:26px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">${kpis.activeEmployees}</div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● Authoritative Workforce</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">Approved Capacity</div>
          <div style="font-size:26px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">${kpis.approvedCapacity || 38}</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Sanctioned Headcount</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">Capacity Gap</div>
          <div style="font-size:26px; font-weight:800; color:#d97706; font-family:var(--font-heading); margin-top:4px;">${kpis.capacityGap !== undefined ? kpis.capacityGap : 4}</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Seats to Approved Total</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);" title="3 Sanctioned & Actively Recruiting Positions (1 Capacity Gap Paused/Frozen)">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">Open Positions</div>
            <span class="badge-tag" style="background:rgba(37,99,235,0.1); color:#2563eb; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px;">Recruiting</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:#2563eb; font-family:var(--font-heading); margin-top:4px;">${kpis.openPositions}</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Actively Sanctioned &amp; Open</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">On Probation</div>
          <div style="font-size:26px; font-weight:800; color:#b45309; font-family:var(--font-heading); margin-top:4px;">${kpis.employeesOnProbation}</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Reviews in progress</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">New Joiners (30D)</div>
          <div style="font-size:26px; font-weight:800; color:#059669; font-family:var(--font-heading); margin-top:4px;">${kpis.newJoiners30Days}</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Onboarded staff</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">Exits (30D)</div>
          <div style="font-size:26px; font-weight:800; color:var(--muted); font-family:var(--font-heading); margin-top:4px;">${kpis.exits30Days}</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Offboarded staff</div>
        </div>

        <div class="kpi-card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); padding:16px 18px; box-shadow:var(--shadow-xs);">
          <div style="font-size:11.5px; color:var(--muted); text-transform:uppercase; font-weight:700; letter-spacing:0.4px;">Cafés Staffed</div>
          <div style="font-size:26px; font-weight:800; color:var(--ink); font-family:var(--font-heading); margin-top:4px;">${kpis.cafesStaffed} / 3</div>
          <div style="font-size:11.5px; color:#059669; font-weight:600; margin-top:2px;">● 100% Location Coverage</div>
        </div>
      </div>

      <!-- SECONDARY CONTROL STRIP -->
      <div class="card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs); padding:16px 20px; display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-weight:700; font-size:12.5px; color:var(--muted); text-transform:uppercase; letter-spacing:0.04em;">Actionable Items:</span>
          <span class="badge-tag badge-warning" style="font-weight:700;">${strip.probationReviewsDue} Probation Due</span>
          <span class="badge-tag badge-warning" style="font-weight:700;">${strip.certificationsExpiring} Certs Expiring</span>
          <span class="badge-tag badge-accent" style="font-weight:700;">${strip.onboardingIncomplete} Preboarding</span>
          <span class="badge-tag badge-neutral" style="font-weight:600;">${strip.transfersPending} Transfers Scheduled</span>
          <span class="badge-tag badge-danger" style="font-weight:700;">${strip.criticalVacancies} Critical Vacancies</span>
          <span class="badge-tag badge-neutral" style="font-weight:600;">${strip.documentsMissing} Docs Pending</span>
        </div>
        <button class="btn btn-ghost btn-sm" id="view-integrity-fast-btn" style="font-size:12px; font-weight:600;">View Integrity Audit →</button>
      </div>

      <!-- CAFÉ WORKFORCE CAPACITIES -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        ${cafes.map(c => `
          <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:12px; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
              <div>
                <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">${c.name}</h3>
                <span style="font-size:12px; color:var(--muted);">${c.cafeId}</span>
              </div>
              <span class="badge-tag" style="background:${(c.openPositions || c.vacancies) > 0 ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)'}; color:${(c.openPositions || c.vacancies) > 0 ? '#2563eb' : '#10b981'};">
                ${(c.openPositions || c.vacancies) > 0 ? (c.openPositions || c.vacancies) + ' Open Pos' : 'Fully Staffed'}
              </span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; margin-bottom:14px;">
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="color:var(--muted); font-size:11px;">Active Headcount</div>
                <div style="font-weight:700; font-size:16px; color:var(--ink);">${c.totalHeadcount}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="color:var(--muted); font-size:11px;">Approved Capacity</div>
                <div style="font-weight:700; font-size:16px; color:var(--ink);">${c.approvedPositions}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="color:var(--muted); font-size:11px;">Capacity Gap</div>
                <div style="font-weight:700; font-size:16px; color:#f59e0b;">${c.capacityGap !== undefined ? c.capacityGap : Math.max(0, c.approvedPositions - c.totalHeadcount)}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="color:var(--muted); font-size:11px;">Open Positions</div>
                <div style="font-weight:700; font-size:16px; color:#3b82f6;">${c.openPositions !== undefined ? c.openPositions : c.vacancies}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="color:var(--muted); font-size:11px;">On Probation</div>
                <div style="font-weight:700; font-size:16px; color:#b45309;">${c.probation}</div>
              </div>
              <div style="background:#f8fafc; padding:10px; border-radius:8px;">
                <div style="color:var(--muted); font-size:11px;">Cross-Trained</div>
                <div style="font-weight:700; font-size:16px; color:#10b981;">${c.crossTrained}</div>
              </div>
            </div>
            <button class="btn btn-ghost filter-cafe-btn" data-cafe-id="${c.cafeId}" style="width:100%; font-size:12px; justify-content:center;">View Roster &amp; Positions →</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ─── 2. EMPLOYEE DIRECTORY & SEARCH ──────────────────────────────────────────
function renderDirectorySubpanel() {
  let filtered = liveEmployees.length > 0 ? [...liveEmployees] : [
    { userId: "AD-0003", name: "Ravi Kumar", preferredName: "Ravi", role: "CAFE_ADMIN", designation: "General Store Manager", department: "Management", primaryCafeId: "ZC-0001", employmentType: "Full Time", workerType: "PERMANENT", employmentStatus: "ACTIVE", joiningDate: "2024-01-15", email: "ravi@zamorin.cafe" },
    { userId: "ST-0004", name: "Priya Nair", preferredName: "Priya", role: "STAFF", designation: "Senior Head Barista", department: "Barista", primaryCafeId: "ZC-0001", employmentType: "Full Time", workerType: "PERMANENT", employmentStatus: "ACTIVE", joiningDate: "2024-03-01", email: "priya@zamorin.cafe" },
    { userId: "ST-0005", name: "Arjun Das", preferredName: "Arjun", role: "STAFF", designation: "Sous Chef", department: "Kitchen", primaryCafeId: "ZC-0002", employmentType: "Full Time", workerType: "PERMANENT", employmentStatus: "ACTIVE", joiningDate: "2024-04-10", email: "arjun@zamorin.cafe" },
    { userId: "ST-0006", name: "Ananya Sen", preferredName: "Ananya", role: "STAFF", designation: "Floor Lead / Cashier", department: "Service", primaryCafeId: "ZC-0003", employmentType: "Full Time", workerType: "PERMANENT", employmentStatus: "PROBATION", joiningDate: "2026-06-15", email: "ananya@zamorin.cafe" },
  ];

  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(e =>
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.userId && e.userId.toLowerCase().includes(q)) ||
      (e.designation && e.designation.toLowerCase().includes(q)) ||
      (e.department && e.department.toLowerCase().includes(q)) ||
      (e.email && e.email.toLowerCase().includes(q))
    );
  }
  if (selectedCafe !== "ALL") {
    filtered = filtered.filter(e => e.primaryCafeId === selectedCafe || (Array.isArray(e.assignedCafeIds) && e.assignedCafeIds.includes(selectedCafe)));
  }
  if (selectedDept !== "ALL") {
    filtered = filtered.filter(e => e.department === selectedDept);
  }
  if (selectedStatus !== "ALL") {
    filtered = filtered.filter(e => e.employmentStatus === selectedStatus);
  }
  if (selectedWorkerType !== "ALL") {
    filtered = filtered.filter(e => e.workerType === selectedWorkerType);
  }

  return `
    <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:12px; padding:20px;">
      <!-- FILTER & SEARCH BAR -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:20px;">
        <div style="display:flex; gap:10px; flex:1; min-width:280px;">
          <input type="text" id="employee-search-input" placeholder="Search by Name, Employee ID, Designation, Department..." value="${searchQuery}" style="flex:1; padding:8px 14px; border:1px solid rgba(0,0,0,0.12); border-radius:8px; font-size:13px;" />
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <select id="cafe-filter-select" style="padding:8px 12px; border:1px solid rgba(0,0,0,0.12); border-radius:8px; font-size:13px;">
            <option value="ALL" ${selectedCafe === 'ALL' ? 'selected' : ''}>All Cafés</option>
            <option value="ZC-0001" ${selectedCafe === 'ZC-0001' ? 'selected' : ''}>Dawn Roast (Koramangala)</option>
            <option value="ZC-0002" ${selectedCafe === 'ZC-0002' ? 'selected' : ''}>Zamorin Bay (Indiranagar)</option>
            <option value="ZC-0003" ${selectedCafe === 'ZC-0003' ? 'selected' : ''}>Calicut Heritage Flagship</option>
          </select>
          <select id="dept-filter-select" style="padding:8px 12px; border:1px solid rgba(0,0,0,0.12); border-radius:8px; font-size:13px;">
            <option value="ALL" ${selectedDept === 'ALL' ? 'selected' : ''}>All Departments</option>
            <option value="Barista" ${selectedDept === 'Barista' ? 'selected' : ''}>Barista</option>
            <option value="Kitchen" ${selectedDept === 'Kitchen' ? 'selected' : ''}>Kitchen</option>
            <option value="Service" ${selectedDept === 'Service' ? 'selected' : ''}>Service</option>
            <option value="Management" ${selectedDept === 'Management' ? 'selected' : ''}>Management</option>
          </select>
          <select id="status-filter-select" style="padding:8px 12px; border:1px solid rgba(0,0,0,0.12); border-radius:8px; font-size:13px;">
            <option value="ALL" ${selectedStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
            <option value="ACTIVE" ${selectedStatus === 'ACTIVE' ? 'selected' : ''}>Active</option>
            <option value="PROBATION" ${selectedStatus === 'PROBATION' ? 'selected' : ''}>Probation</option>
            <option value="PREBOARDING" ${selectedStatus === 'PREBOARDING' ? 'selected' : ''}>Preboarding</option>
            <option value="NOTICE_PERIOD" ${selectedStatus === 'NOTICE_PERIOD' ? 'selected' : ''}>Notice Period</option>
            <option value="EXITED" ${selectedStatus === 'EXITED' ? 'selected' : ''}>Exited</option>
          </select>
          <button class="btn btn-ghost" id="export-directory-btn" style="font-size:13px;" title="Export Directory">Export CSV</button>
        </div>
      </div>

      <!-- DIRECTORY TABLE -->
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid rgba(0,0,0,0.06); color:var(--muted); font-size:11px; text-transform:uppercase;">
              <th style="padding:10px 14px;">Employee</th>
              <th style="padding:10px 14px;">Job Title / Position</th>
              <th style="padding:10px 14px;">Department</th>
              <th style="padding:10px 14px;">Primary Café</th>
              <th style="padding:10px 14px;">Type</th>
              <th style="padding:10px 14px;">System Role</th>
              <th style="padding:10px 14px;">Joined</th>
              <th style="padding:10px 14px;">Status</th>
              <th style="padding:10px 14px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(emp => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.04); transition:background 0.15s ease;" onmouseover="this.style.background='#fafaf9'" onmouseout="this.style.background='transparent'">
                <td style="padding:12px 14px;">
                  <div style="font-weight:600; color:var(--ink);">${emp.name}</div>
                  <div style="font-size:11px; color:var(--muted);">${emp.userId} · ${emp.email}</div>
                </td>
                <td style="padding:12px 14px; font-weight:500;">${emp.designation || 'Staff'}</td>
                <td style="padding:12px 14px; color:var(--muted);">${emp.department || 'Operations'}</td>
                <td style="padding:12px 14px;"><span class="badge-tag badge-neutral" style="font-size:11.5px; font-weight:600;">${emp.primaryCafeId || 'ZC-0001'}</span></td>
                <td style="padding:12px 14px; font-size:12px;">${emp.workerType || 'PERMANENT'}</td>
                <td style="padding:12px 14px;">
                  <span class="badge-tag ${emp.role === 'MASTER' ? 'badge-accent' : emp.role === 'OWNER' ? 'badge-accent' : 'badge-neutral'}" style="font-size:11px; font-weight:700;">
                    ${emp.role}
                  </span>
                </td>
                <td style="padding:12px 14px; font-size:12px; color:var(--muted);">${emp.joiningDate ? String(emp.joiningDate).split('T')[0] : '—'}</td>
                <td style="padding:12px 14px;">
                  <span class="badge-tag ${emp.employmentStatus === 'ACTIVE' ? 'badge-success' : emp.employmentStatus === 'PROBATION' ? 'badge-warning' : 'badge-neutral'}" style="font-size:11.5px; font-weight:700;">
                    ${emp.employmentStatus || 'ACTIVE'}
                  </span>
                </td>
                <td style="padding:12px 14px; text-align:right; white-space:nowrap;">
                  <button class="btn btn-ghost open-employee-360-btn" data-user-id="${emp.userId}" style="font-size:12px; padding:4px 8px;">View 360</button>
                  <button class="btn btn-ghost open-transfer-modal-btn" data-user-id="${emp.userId}" style="font-size:12px; padding:4px 8px;">Transfer</button>
                  <button class="btn btn-ghost open-offboard-modal-btn" data-user-id="${emp.userId}" style="font-size:12px; padding:4px 8px; color:#dc2626;">Offboard</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; font-size:12px; color:var(--muted);">
        <div>Showing ${filtered.length} of ${liveEmployees.length || filtered.length} records</div>
        <div>Authoritative Real-Time Data</div>
      </div>
    </div>
  `;
}

// ─── 3. POSITIONS & ORGANISATION STRUCTURE ─────────────────────────────────────
function renderPositionsSubpanel() {
  const positions = livePositions.length > 0 ? livePositions : [
    { positionId: "POS-001-01", positionTitle: "General Store Manager", department: "Management", cafeId: "ZC-0001", approvedCapacity: 1, status: "FILLED", isCritical: true },
    { positionId: "POS-001-02", positionTitle: "Senior Head Barista", department: "Barista", cafeId: "ZC-0001", approvedCapacity: 2, status: "FILLED", isCritical: true },
    { positionId: "POS-001-03", positionTitle: "Junior Barista", department: "Barista", cafeId: "ZC-0001", approvedCapacity: 4, status: "OPEN", isCritical: false },
    { positionId: "POS-002-01", positionTitle: "Sous Chef", department: "Kitchen", cafeId: "ZC-0002", approvedCapacity: 2, status: "FILLED", isCritical: false },
    { positionId: "POS-003-01", positionTitle: "Floor Lead / Cashier", department: "Service", cafeId: "ZC-0003", approvedCapacity: 3, status: "OPEN", isCritical: false },
  ];

  return `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 style="font-size:18px; font-weight:700; margin:0;">Sanctioned Positions &amp; Capacity</h2>
          <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Authoritative position registry and capacity allocations across café locations.</p>
        </div>
        <button class="btn btn-primary" id="add-position-btn" style="font-size:13px;">+ Create Sanctioned Position</button>
      </div>

      <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:12px; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid rgba(0,0,0,0.06); color:var(--muted); font-size:11px; text-transform:uppercase;">
              <th style="padding:10px 14px;">Position ID</th>
              <th style="padding:10px 14px;">Title</th>
              <th style="padding:10px 14px;">Department</th>
              <th style="padding:10px 14px;">Location</th>
              <th style="padding:10px 14px;">Approved Capacity</th>
              <th style="padding:10px 14px;">Status</th>
              <th style="padding:10px 14px;">Critical</th>
            </tr>
          </thead>
          <tbody>
            ${positions.map(p => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.04);">
                <td style="padding:12px 14px; font-weight:600; color:var(--gold,#b45309);">${p.positionId}</td>
                <td style="padding:12px 14px; font-weight:600; color:var(--ink);">${p.positionTitle}</td>
                <td style="padding:12px 14px; color:var(--muted);">${p.department}</td>
                <td style="padding:12px 14px;"><span class="badge-tag" style="background:#f1f5f9; color:#334155;">${p.cafeId}</span></td>
                <td style="padding:12px 14px; font-weight:600;">${p.approvedCapacity} Seat(s)</td>
                <td style="padding:12px 14px;">
                  <span class="badge-tag" style="background:${p.status === 'FILLED' ? 'rgba(16,185,129,0.1)' : p.status === 'OPEN' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)'}; color:${p.status === 'FILLED' ? '#10b981' : p.status === 'OPEN' ? '#3b82f6' : '#d97706'};">
                    ${p.status}
                  </span>
                </td>
                <td style="padding:12px 14px;">
                  ${p.isCritical ? '<span class="badge-tag" style="background:#fef2f2; color:#dc2626;">CRITICAL ROLE</span>' : '<span style="color:var(--muted);">Standard</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── 4. WORKFORCE PLANNING & STAFFING REQUESTS ────────────────────────────────
function renderStaffingSubpanel() {
  const requests = liveStaffingRequests.length > 0 ? liveStaffingRequests : [
    { requestId: "SR-2026-001", cafeId: "ZC-0001", department: "Barista", positionTitle: "Junior Barista", headcountRequired: 2, fteRequired: 2.0, desiredDate: "2026-09-01", reason: "EXPANSION", status: "APPROVED" },
    { requestId: "SR-2026-002", cafeId: "ZC-0003", department: "Service", positionTitle: "Floor Lead", headcountRequired: 1, fteRequired: 1.0, desiredDate: "2026-09-15", reason: "REPLACEMENT", status: "SUBMITTED" },
  ];

  return `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h2 style="font-size:18px; font-weight:700; margin:0;">Staffing Requests &amp; Headcount Gaps</h2>
          <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Formal requisitions for replacement, seasonal peak, and café expansion.</p>
        </div>
        <button class="btn btn-primary" id="new-requisition-btn" style="font-size:13px;">+ New Requisition</button>
      </div>

      <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:12px; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid rgba(0,0,0,0.06); color:var(--muted); font-size:11px; text-transform:uppercase;">
              <th style="padding:10px 14px;">Requisition ID</th>
              <th style="padding:10px 14px;">Location</th>
              <th style="padding:10px 14px;">Department / Title</th>
              <th style="padding:10px 14px;">Headcount / FTE</th>
              <th style="padding:10px 14px;">Desired Date</th>
              <th style="padding:10px 14px;">Reason</th>
              <th style="padding:10px 14px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.04);">
                <td style="padding:12px 14px; font-weight:600; color:var(--gold,#b45309);">${r.requestId}</td>
                <td style="padding:12px 14px;"><span class="badge-tag" style="background:#f1f5f9; color:#334155;">${r.cafeId}</span></td>
                <td style="padding:12px 14px;">
                  <div style="font-weight:600; color:var(--ink);">${r.positionTitle}</div>
                  <div style="font-size:11px; color:var(--muted);">${r.department}</div>
                </td>
                <td style="padding:12px 14px; font-weight:600;">${r.headcountRequired} (${r.fteRequired} FTE)</td>
                <td style="padding:12px 14px; color:var(--muted);">${r.desiredDate}</td>
                <td style="padding:12px 14px;"><span class="badge-tag badge-neutral" style="font-weight:600;">${r.reason}</span></td>
                <td style="padding:12px 14px;">
                  <span class="badge-tag ${r.status === 'APPROVED' ? 'badge-success' : 'badge-accent'}" style="font-weight:700;">
                    ${r.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── 5. ONBOARDING & PROBATION ────────────────────────────────────────────────
function renderOnboardingSubpanel() {
  return `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <div class="card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs); padding:22px;">
        <h3 style="font-size:16px; font-weight:700; margin:0 0 4px; color:var(--ink);">Active Preboarding &amp; Onboarding Checklists</h3>
        <p style="font-size:12.5px; color:var(--muted); margin:0 0 16px;">Readiness verification before and during the first 90 days of employment.</p>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
          <div class="card" style="background:var(--surface-sunken, rgba(0,0,0,0.02)); border:1px solid var(--line); border-radius:var(--radius-sm, 8px); padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-weight:700; color:var(--ink); font-size:13.5px;">Ananya Sen</div>
                <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">ST-0006 · Floor Lead (Calicut)</div>
              </div>
              <span class="badge-tag badge-warning" style="font-weight:700;">Probation Review Due</span>
            </div>
            <div style="margin-top:14px; font-size:12px; display:flex; flex-direction:column; gap:6px; color:var(--ink);">
              <div>✅ Documents Signed (8/8)</div>
              <div>✅ Food Safety Induction (FoSTaC) Complete</div>
              <div style="color:var(--warning); font-weight:600;">⚠ 90-Day Manager Evaluation Pending</div>
            </div>
            <button class="btn btn-ghost btn-sm open-probation-modal-btn" data-user-id="ST-0006" style="margin-top:14px; width:100%; font-size:12px; font-weight:600; justify-content:center;">Complete Probation Review →</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── 6. SKILLS & TRAINING ─────────────────────────────────────────────────────
function renderSkillsSubpanel() {
  return `
    <div class="card" style="background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-card, 12px); box-shadow:var(--shadow-xs); padding:22px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Skills Matrix &amp; Verified Competencies</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Espresso extraction, manual brewing, food safety compliance, and supervision.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-sm" id="assign-training-btn">+ Assign Training</button>
          <button class="btn btn-primary btn-sm" id="verify-skill-btn">+ Verify Staff Skill</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
        <div class="card" style="background:var(--surface-sunken, rgba(0,0,0,0.02)); border:1px solid var(--line); border-radius:var(--radius-sm, 8px); padding:16px;">
          <div style="font-weight:700; color:var(--ink); font-size:13.5px;">Priya Nair (ST-0004)</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Senior Head Barista — Koramangala</div>
          <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;">
            <span class="badge-tag badge-success" style="font-weight:600;">Manual Brewing: Expert</span>
            <span class="badge-tag badge-success" style="font-weight:600;">Espresso Extraction: Expert</span>
            <span class="badge-tag badge-accent" style="font-weight:600;">FoSTaC Safety: Verified</span>
          </div>
        </div>
        <div class="card" style="background:var(--surface-sunken, rgba(0,0,0,0.02)); border:1px solid var(--line); border-radius:var(--radius-sm, 8px); padding:16px;">
          <div style="font-weight:700; color:var(--ink); font-size:13.5px;">Arjun Das (ST-0005)</div>
          <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Sous Chef — Indiranagar</div>
          <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:6px;">
            <span class="badge-tag badge-success" style="font-weight:600;">Kitchen Prep: Expert</span>
            <span class="badge-tag badge-warning" style="font-weight:600;">Inventory Receiving: Competent</span>
            <span class="badge-tag badge-accent" style="font-weight:600;">FoSTaC Safety: Verified</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── 7. DOCUMENTS & LETTERS ───────────────────────────────────────────────────
function renderDocumentsSubpanel() {
  return `
    <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:12px; padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Authoritative Document Generator</h3>
          <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">Generate appointment letters, confirmation letters, and experience certificates.</p>
        </div>
        <button class="btn btn-primary" id="open-letter-gen-btn" style="font-size:13px;">+ Generate HR Letter</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
        <div style="border:1px solid rgba(0,0,0,0.08); border-radius:8px; padding:16px;">
          <div style="font-weight:600; color:var(--ink);">Appointment Letter</div>
          <p style="font-size:12px; color:var(--muted); margin:4px 0 12px;">Standard full-time employment agreement with compensation terms.</p>
          <span class="badge-tag" style="background:#f1f5f9; color:#475569;">Template v2.4</span>
        </div>
        <div style="border:1px solid rgba(0,0,0,0.08); border-radius:8px; padding:16px;">
          <div style="font-weight:600; color:var(--ink);">Probation Confirmation</div>
          <p style="font-size:12px; color:var(--muted); margin:4px 0 12px;">Formal notice confirming completion of the 90-day probationary period.</p>
          <span class="badge-tag" style="background:#f1f5f9; color:#475569;">Template v1.8</span>
        </div>
        <div style="border:1px solid rgba(0,0,0,0.08); border-radius:8px; padding:16px;">
          <div style="font-weight:600; color:var(--ink);">Transfer &amp; Rotation Order</div>
          <p style="font-size:12px; color:var(--muted); margin:4px 0 12px;">Authoritative relocation or temporary café rotation documentation.</p>
          <span class="badge-tag" style="background:#f1f5f9; color:#475569;">Template v2.1</span>
        </div>
      </div>
    </div>
  `;
}

// ─── 8. INTEGRITY & OFFBOARDING ───────────────────────────────────────────────
function renderIntegritySubpanel() {
  const issues = liveIntegrity?.issues || [];
  const status = liveIntegrity?.integrityStatus || "HEALTHY";

  return `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:16px; font-weight:700; margin:0; color:var(--ink);">Deterministic Workforce Integrity Audit</h3>
            <p style="font-size:13px; color:var(--muted); margin:2px 0 0;">15-point automated verification across organisation hierarchies, active logins, and credentials.</p>
          </div>
          <span class="badge-tag" style="background:${status === 'HEALTHY' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${status === 'HEALTHY' ? '#10b981' : '#ef4444'}; font-size:13px; padding:6px 12px;">
            ${status === 'HEALTHY' ? '✓ SYSTEM HEALTHY' : '⚠ ATTENTION REQUIRED'}
          </span>
        </div>

        ${issues.length === 0 ? `
          <div style="padding:24px; text-align:center; color:#10b981; background:#f0fdf4; border-radius:8px; font-weight:500; font-size:13px;">
            ✓ All employees occupy sanctioned positions with assigned reporting managers and valid credentials.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${issues.map(iss => `
              <div style="padding:12px 16px; background:#fff1f2; border:1px solid #ffe4e6; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:600; color:#9f1239; font-size:13px;">${iss.title}</div>
                  <div style="font-size:11px; color:#be123c;">Category: ${iss.category} · Entity: ${iss.entity}</div>
                </div>
                <span class="badge-tag" style="background:#fecdd3; color:#881337;">${iss.severity}</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

// ─── ASYNC DATA FETCHER ───────────────────────────────────────────────────────
async function fetchWorkforceData() {
  if (isLoadingData) return;
  isLoadingData = true;
  try {
    const [ov, emp, pos, stf, itg] = await Promise.all([
      apiGet("/employees/overview"),
      apiGet("/employees"),
      apiGet("/employees/positions"),
      apiGet("/employees/staffing-requests"),
      apiGet("/employees/integrity"),
    ]);
    liveOverview = ov?.data;
    liveEmployees = emp?.data?.employees || [];
    livePositions = pos?.data?.positions || [];
    liveStaffingRequests = stf?.data?.staffingRequests || [];
    liveIntegrity = itg?.data;
  } catch (err) {
    // Fallback gracefully
  } finally {
    isLoadingData = false;
  }
}

// ─── WIRE DOM EVENTS & MODALS ─────────────────────────────────────────────────
export async function wireEmployees(container = document, subroute) {
  if (subroute !== undefined) {
    activeSubpanel = subroute || "overview";
  }

  // Subpanel switching via Hub Tiles
  document.querySelectorAll("[data-workforce-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tileId = btn.getAttribute("data-workforce-hub-tile");
      navigate("employees/" + tileId);
    });
  });

  // Back to Hub button
  const backToHub = () => navigate("employees");
  document.getElementById("employees-back-to-hub-btn")?.addEventListener("click", backToHub);
  document.getElementById("workforce-back-to-hub-btn")?.addEventListener("click", backToHub);

  attachDirectoryRowListeners();

  // If not yet loaded, fetch once in background and rerender
  if (!liveOverview) {
    fetchWorkforceData().then(() => {
      const host = document.getElementById("workforce-content-area");
      if (host && state.route?.startsWith("employees")) {
        host.innerHTML = renderActiveSubpanel();
        document.querySelectorAll("[data-workforce-hub-tile]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const tileId = btn.getAttribute("data-workforce-hub-tile");
            navigate("employees/" + tileId);
          });
        });
        document.getElementById("employees-back-to-hub-btn")?.addEventListener("click", backToHub);
        document.getElementById("workforce-back-to-hub-btn")?.addEventListener("click", backToHub);
        attachDirectoryRowListeners();
      }
    });
  }

  // Subpanel switching legacy tabs
  document.querySelectorAll(".subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeSubpanel = btn.getAttribute("data-subpanel");
      const host = document.getElementById("page-content");
      if (host) {
        host.innerHTML = renderEmployees();
        wireEmployees();
      }
    });
  });

  // Refresh directory
  document.getElementById("refresh-workforce-btn")?.addEventListener("click", async () => {
    try {
      await fetchWorkforceData();
      showToast("Workforce directory refreshed successfully.", "success");
      const host = document.getElementById("page-content");
      if (host) {
        host.innerHTML = renderEmployees();
        wireEmployees();
      }
    } catch (err) {
      showToast("Failed to refresh workforce data.", "error");
    }
  });

  // Search input filter
  document.getElementById("employee-search-input")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    const host = document.getElementById("workforce-content-area");
    if (host && activeSubpanel === "directory") {
      host.innerHTML = renderDirectorySubpanel();
      attachDirectoryRowListeners();
    }
  });

  // Filter selects
  document.getElementById("cafe-filter-select")?.addEventListener("change", (e) => {
    selectedCafe = e.target.value;
    const host = document.getElementById("workforce-content-area");
    if (host && activeSubpanel === "directory") {
      host.innerHTML = renderDirectorySubpanel();
      attachDirectoryRowListeners();
    }
  });

  document.getElementById("dept-filter-select")?.addEventListener("change", (e) => {
    selectedDept = e.target.value;
    const host = document.getElementById("workforce-content-area");
    if (host && activeSubpanel === "directory") {
      host.innerHTML = renderDirectorySubpanel();
      attachDirectoryRowListeners();
    }
  });

  document.getElementById("status-filter-select")?.addEventListener("change", (e) => {
    selectedStatus = e.target.value;
    const host = document.getElementById("workforce-content-area");
    if (host && activeSubpanel === "directory") {
      host.innerHTML = renderDirectorySubpanel();
      attachDirectoryRowListeners();
    }
  });

  // Export CSV
  document.getElementById("export-directory-btn")?.addEventListener("click", () => {
    exportDirectoryCSV();
  });

  // Fast Cafe drill-down
  document.querySelectorAll(".filter-cafe-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCafe = btn.getAttribute("data-cafe-id") || "ALL";
      activeSubpanel = "directory";
      const host = document.getElementById("page-content");
      if (host) {
        host.innerHTML = renderEmployees();
        wireEmployees();
      }
    });
  });

  // Fast Integrity view
  document.getElementById("view-integrity-fast-btn")?.addEventListener("click", () => {
    activeSubpanel = "integrity";
    const host = document.getElementById("page-content");
    if (host) {
      host.innerHTML = renderEmployees();
      wireEmployees();
    }
  });

  // Child action buttons
  document.getElementById("btn-child-onboard-emp")?.addEventListener("click", () => openOnboardingWizard());
  document.getElementById("btn-child-add-position")?.addEventListener("click", () => openCreatePositionModal());
  document.getElementById("btn-child-new-staffing-req")?.addEventListener("click", () => openStaffingRequestModal());
  document.getElementById("btn-child-verify-skill")?.addEventListener("click", () => openVerifySkillModal());
  document.getElementById("btn-child-gen-letter")?.addEventListener("click", () => openLetterGeneratorModal());
  document.getElementById("btn-child-review-probation")?.addEventListener("click", () => showToast("Opening probation review panel...", "info"));
  document.getElementById("btn-child-init-offboard")?.addEventListener("click", () => showToast("Opening offboarding and asset clearance workflow...", "info"));

  // Onboard Wizard button
  document.getElementById("open-onboard-wizard-btn")?.addEventListener("click", () => {
    openOnboardingWizard();
  });

  // Staffing Requisition button
  document.getElementById("open-staffing-request-btn")?.addEventListener("click", () => {
    openStaffingRequestModal();
  });
  document.getElementById("new-requisition-btn")?.addEventListener("click", () => {
    openStaffingRequestModal();
  });

  // Create Sanctioned Position button
  document.getElementById("add-position-btn")?.addEventListener("click", () => {
    openCreatePositionModal();
  });

  // Verify Skill button
  document.getElementById("verify-skill-btn")?.addEventListener("click", () => {
    openVerifySkillModal();
  });

  // Assign Training button
  document.getElementById("assign-training-btn")?.addEventListener("click", () => {
    openAssignTrainingModal();
  });

  // Open Letter Generator
  document.getElementById("open-letter-gen-btn")?.addEventListener("click", () => {
    openLetterGeneratorModal();
  });

  attachDirectoryRowListeners();
}

function attachDirectoryRowListeners() {
  // Open Employee 360
  document.querySelectorAll(".open-employee-360-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.getAttribute("data-user-id");
      openEmployee360Drawer(userId);
    });
  });

  // Open Transfer Modal
  document.querySelectorAll(".open-transfer-modal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.getAttribute("data-user-id");
      openTransferModal(userId);
    });
  });

  // Open Offboard Modal
  document.querySelectorAll(".open-offboard-modal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.getAttribute("data-user-id");
      openOffboardModal(userId);
    });
  });

  // Open Probation Modal
  document.querySelectorAll(".open-probation-modal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.getAttribute("data-user-id");
      openProbationModal(userId);
    });
  });
}

function exportDirectoryCSV() {
  const employees = liveEmployees.length > 0 ? liveEmployees : [];
  if (employees.length === 0) {
    showToast("No employee records to export.", "info");
    return;
  }
  const headers = ["Employee ID", "Full Name", "Email", "Role", "Designation", "Department", "Primary Cafe", "Worker Type", "Status", "Joined"];
  const rows = employees.map(e => [
    e.userId,
    `"${e.name || ''}"`,
    e.email || '',
    e.role || '',
    `"${e.designation || ''}"`,
    `"${e.department || ''}"`,
    e.primaryCafeId || '',
    e.workerType || '',
    e.employmentStatus || '',
    e.joiningDate ? String(e.joiningDate).split('T')[0] : '',
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Zamorin_Employee_Directory_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Employee directory exported as CSV.", "success");
}

// ─── MODAL WIZARDS ────────────────────────────────────────────────────────────
function openOnboardingWizard() {
  openModal(`
    <div style="padding:24px; max-width:640px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Onboard New Employee</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Register worker identity, position allocation, primary café, and initial compliance requirements.</p>

      <form id="onboard-employee-form" style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Legal Full Name *</label>
            <input type="text" id="ob-name" required placeholder="e.g. Rahul Sharma" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Preferred / Calling Name</label>
            <input type="text" id="ob-preferred" placeholder="e.g. Rahul" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Work Email Address *</label>
            <input type="email" id="ob-email" required placeholder="rahul@zamorin.cafe" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Mobile Phone</label>
            <input type="text" id="ob-phone" placeholder="+91 98450 12345" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Primary Café Location *</label>
            <select id="ob-cafe" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="ZC-0001">Dawn Roast (Koramangala)</option>
              <option value="ZC-0002">Zamorin Bay (Indiranagar)</option>
              <option value="ZC-0003">Calicut Heritage Flagship</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Department *</label>
            <select id="ob-dept" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="Barista">Barista Operations</option>
              <option value="Kitchen">Kitchen &amp; Culinary</option>
              <option value="Service">Front of House / Service</option>
              <option value="Management">Management &amp; Supervision</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Job Title / Designation *</label>
            <input type="text" id="ob-title" required placeholder="e.g. Junior Barista" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Worker Type</label>
            <select id="ob-worker-type" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="PERMANENT">Permanent (Full-Time)</option>
              <option value="FIXED_TERM">Fixed-Term Contract</option>
              <option value="TRAINEE">Trainee / Apprentice</option>
              <option value="CONTINGENT">Contingent Worker</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit" style="background:var(--gold,#b45309); border-color:var(--gold,#b45309); color:#fff; font-weight:600;">Complete Onboarding</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("onboard-employee-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("ob-name").value,
      preferredName: document.getElementById("ob-preferred").value,
      email: document.getElementById("ob-email").value,
      phone: document.getElementById("ob-phone").value,
      primaryCafeId: document.getElementById("ob-cafe").value,
      department: document.getElementById("ob-dept").value,
      designation: document.getElementById("ob-title").value,
      workerType: document.getElementById("ob-worker-type").value,
      role: "STAFF",
    };

    try {
      const res = await apiPost("/employees", payload);
      showToast(res.message || "Employee onboarded successfully.", "success");
      document.getElementById("modal-root").innerHTML = "";
      document.getElementById("refresh-workforce-btn")?.click();
    } catch (err) {
      showToast(err.message || "Failed to onboard employee.", "error");
    }
  });
}

function openStaffingRequestModal() {
  openModal(`
    <div style="padding:24px; max-width:540px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Submit Staffing Requisition</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Request sanctioned headcount addition or replacement for your café.</p>

      <form id="staffing-req-form" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Target Café *</label>
          <select id="sr-cafe" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
            <option value="ZC-0001">Dawn Roast (Koramangala)</option>
            <option value="ZC-0002">Zamorin Bay (Indiranagar)</option>
            <option value="ZC-0003">Calicut Heritage Flagship</option>
          </select>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Department *</label>
            <select id="sr-dept" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="Barista">Barista</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Service">Service</option>
              <option value="Management">Management</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Position Title *</label>
            <input type="text" id="sr-title" required placeholder="e.g. Junior Barista" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Headcount Required *</label>
            <input type="number" id="sr-count" min="1" max="10" value="1" required style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Desired Date *</label>
            <input type="date" id="sr-date" required value="${new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0]}" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Reason Category</label>
          <select id="sr-reason" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
            <option value="REPLACEMENT">Replacement / Backfill</option>
            <option value="EXPANSION">Volume Expansion</option>
            <option value="SEASONAL">Seasonal Peak Requirement</option>
          </select>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit">Submit Requisition</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("staffing-req-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      cafeId: document.getElementById("sr-cafe").value,
      department: document.getElementById("sr-dept").value,
      positionTitle: document.getElementById("sr-title").value,
      headcountRequired: Number(document.getElementById("sr-count").value),
      desiredDate: document.getElementById("sr-date").value,
      reason: document.getElementById("sr-reason").value,
    };

    try {
      await apiPost("/employees/staffing-requests", payload);
      showToast("Staffing requisition submitted.", "success");
      document.getElementById("modal-root").innerHTML = "";
      document.getElementById("refresh-workforce-btn")?.click();
    } catch (err) {
      showToast(err.message || "Failed to submit requisition.", "error");
    }
  });
}

function openCreatePositionModal() {
  openModal(`
    <div style="padding:24px; max-width:520px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Create Sanctioned Position</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Define position title, department, location, and approved capacity.</p>

      <form id="create-pos-form" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Position Title *</label>
          <input type="text" id="cp-title" required placeholder="e.g. Senior Shift Supervisor" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Department *</label>
            <select id="cp-dept" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="Barista">Barista</option>
              <option value="Kitchen">Kitchen</option>
              <option value="Service">Service</option>
              <option value="Management">Management</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Location *</label>
            <select id="cp-cafe" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="ZC-0001">Dawn Roast (Koramangala)</option>
              <option value="ZC-0002">Zamorin Bay (Indiranagar)</option>
              <option value="ZC-0003">Calicut Heritage Flagship</option>
            </select>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Approved Capacity *</label>
            <input type="number" id="cp-capacity" min="1" max="20" value="1" required style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Critical Role</label>
            <select id="cp-critical" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="false">Standard Role</option>
              <option value="true">Critical Leadership</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit">Create Position</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("create-pos-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      positionTitle: document.getElementById("cp-title").value,
      department: document.getElementById("cp-dept").value,
      cafeId: document.getElementById("cp-cafe").value,
      approvedCapacity: Number(document.getElementById("cp-capacity").value),
      isCritical: document.getElementById("cp-critical").value === "true",
    };

    try {
      await apiPost("/employees/positions", payload);
      showToast("Sanctioned position created.", "success");
      document.getElementById("modal-root").innerHTML = "";
      document.getElementById("refresh-workforce-btn")?.click();
    } catch (err) {
      showToast(err.message || "Failed to create position.", "error");
    }
  });
}

function openTransferModal(userId) {
  openModal(`
    <div style="padding:24px; max-width:520px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Initiate Staff Relocation / Transfer</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Move employee ${userId} to another café location with effective-dated history.</p>

      <form id="transfer-staff-form" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Movement Type *</label>
          <select id="tr-type" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
            <option value="TRANSFER">Permanent Café Relocation</option>
            <option value="TEMPORARY_ROTATION">Temporary Rotation</option>
            <option value="PROMOTION">Promotion &amp; Reassignment</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Destination Café *</label>
          <select id="tr-cafe" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
            <option value="ZC-0001">Dawn Roast (Koramangala)</option>
            <option value="ZC-0002">Zamorin Bay (Indiranagar)</option>
            <option value="ZC-0003">Calicut Heritage Flagship</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Effective Date *</label>
          <input type="date" id="tr-date" required value="${new Date().toISOString().split('T')[0]}" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Reason / Business Justification *</label>
          <textarea id="tr-reason" required rows="2" placeholder="e.g. Senior barista leadership transfer to support morning volume." style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;"></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit">Schedule Movement</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("transfer-staff-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      movementType: document.getElementById("tr-type").value,
      toCafeId: document.getElementById("tr-cafe").value,
      effectiveDate: document.getElementById("tr-date").value,
      reason: document.getElementById("tr-reason").value,
    };

    try {
      const res = await apiPost(`/employees/${userId}/movements`, payload);
      showToast(res.message || "Movement scheduled successfully.", "success");
      document.getElementById("modal-root").innerHTML = "";
      document.getElementById("refresh-workforce-btn")?.click();
    } catch (err) {
      showToast(err.message || "Failed to schedule movement.", "error");
    }
  });
}

function openProbationModal(userId) {
  openModal(`
    <div style="padding:24px; max-width:540px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Probation Review &amp; Confirmation</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Conduct 90-day evaluation for employee ${userId}.</p>

      <form id="probation-review-form" style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Job Knowledge (1-5)</label>
            <input type="number" id="pr-knowledge" min="1" max="5" value="4" required style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Service Standards (1-5)</label>
            <input type="number" id="pr-service" min="1" max="5" value="5" required style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Reliability (1-5)</label>
            <input type="number" id="pr-reliability" min="1" max="5" value="4" required style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Review Decision *</label>
            <select id="pr-decision" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="CONFIRM">Confirm Regular Employment</option>
              <option value="EXTEND">Extend Probation (30-60 Days)</option>
              <option value="FURTHER_REVIEW">Schedule Further Review</option>
            </select>
          </div>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Manager Comments</label>
          <textarea id="pr-comments" rows="2" placeholder="Summary of strengths, barista competencies, and development areas." style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;"></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit">Submit Review</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("probation-review-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      ratings: {
        jobKnowledge: Number(document.getElementById("pr-knowledge").value),
        serviceStandards: Number(document.getElementById("pr-service").value),
        reliability: Number(document.getElementById("pr-reliability").value),
      },
      decision: document.getElementById("pr-decision").value,
      managerComments: document.getElementById("pr-comments").value,
    };

    try {
      const res = await apiPost(`/employees/${userId}/probation`, payload);
      showToast(res.message || "Probation review submitted.", "success");
      document.getElementById("modal-root").innerHTML = "";
      document.getElementById("refresh-workforce-btn")?.click();
    } catch (err) {
      showToast(err.message || "Failed to submit probation review.", "error");
    }
  });
}

function openVerifySkillModal() {
  openModal(`
    <div style="padding:24px; max-width:500px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Verify Staff Competency</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Record verified technical or operational skills against employee record.</p>

      <form id="verify-skill-form" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Employee ID *</label>
          <input type="text" id="vs-user-id" required placeholder="e.g. ST-0004" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Skill Name *</label>
          <input type="text" id="vs-name" required placeholder="e.g. Latte Art Mastery / Espresso Dial-in" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Category</label>
            <select id="vs-cat" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="BARISTA">Barista Skills</option>
              <option value="CULINARY">Culinary &amp; Food Prep</option>
              <option value="COMPLIANCE">Safety &amp; Compliance</option>
              <option value="SERVICE">Customer Experience</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Proficiency</label>
            <select id="vs-prof" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="COMPETENT">Competent</option>
              <option value="EXPERT">Expert</option>
              <option value="CERTIFIED">Certified Master</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit">Verify Skill</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("verify-skill-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("vs-user-id").value.trim().toUpperCase();
    const payload = {
      skillName: document.getElementById("vs-name").value,
      category: document.getElementById("vs-cat").value,
      proficiency: document.getElementById("vs-prof").value,
    };

    try {
      const res = await apiPost(`/employees/${userId}/skills`, payload);
      showToast(res.message || "Skill verified.", "success");
      document.getElementById("modal-root").innerHTML = "";
    } catch (err) {
      showToast(err.message || "Failed to record skill.", "error");
    }
  });
}

function openAssignTrainingModal() {
  openModal(`
    <div style="padding:24px; max-width:500px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Assign Compliance / Academy Training</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Assign mandatory food hygiene, pos handling, or espresso standard modules.</p>

      <form id="assign-training-form" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Employee ID *</label>
          <input type="text" id="at-user-id" required placeholder="e.g. ST-0004" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Training Module Title *</label>
          <input type="text" id="at-title" required value="FoSTaC Food Safety &amp; Hygiene Standards" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Training Provider</label>
            <input type="text" id="at-provider" value="Zamorin Academy" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Due Date *</label>
            <input type="date" id="at-due" required value="${new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0]}" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit">Assign Module</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("assign-training-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("at-user-id").value.trim().toUpperCase();
    const payload = {
      trainingTitle: document.getElementById("at-title").value,
      provider: document.getElementById("at-provider").value,
      dueDate: document.getElementById("at-due").value,
    };

    try {
      const res = await apiPost(`/employees/${userId}/training`, payload);
      showToast(res.message || "Training assigned.", "success");
      document.getElementById("modal-root").innerHTML = "";
    } catch (err) {
      showToast(err.message || "Failed to assign training.", "error");
    }
  });
}

function openOffboardModal(userId) {
  openModal(`
    <div style="padding:24px; max-width:520px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Initiate Staff Offboarding</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Record exit notice, handover tasks, asset returns, and access revocation for ${userId}.</p>

      <form id="offboard-staff-form" style="display:flex; flex-direction:column; gap:14px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Exit Type</label>
            <select id="ob-exit-type" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
              <option value="RESIGNATION">Voluntary Resignation</option>
              <option value="END_OF_CONTRACT">Contract Completion</option>
              <option value="TERMINATION">Administrative Termination</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Last Working Day *</label>
            <input type="date" id="ob-lwd" required value="${new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]}" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
          </div>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Reason Category</label>
          <select id="ob-reason" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
            <option value="CAREER_PROGRESSION">Career Progression</option>
            <option value="RELOCATION">Personal Relocation</option>
            <option value="HIGHER_EDUCATION">Higher Education</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:13px; margin-top:4px;">
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="ob-handover" /> Store &amp; Operational Handover Complete
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="ob-assets" /> Issued Assets &amp; Uniforms Returned
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="ob-access" /> System Access Scheduled for Revocation
          </label>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit" style="background:#dc2626; border-color:#dc2626; color:#fff;">Initiate Exit</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("offboard-staff-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      exitType: document.getElementById("ob-exit-type").value,
      lastWorkingDay: document.getElementById("ob-lwd").value,
      reasonCategory: document.getElementById("ob-reason").value,
      handoverComplete: document.getElementById("ob-handover").checked,
      assetsReturned: document.getElementById("ob-assets").checked,
      accessRevoked: document.getElementById("ob-access").checked,
    };

    try {
      const res = await apiPost(`/employees/${userId}/offboard`, payload);
      showToast(res.message || "Offboarding initiated.", "success");
      document.getElementById("modal-root").innerHTML = "";
      document.getElementById("refresh-workforce-btn")?.click();
    } catch (err) {
      showToast(err.message || "Failed to initiate offboarding.", "error");
    }
  });
}

function openEmployee360Drawer(userId) {
  openModal(`
    <div style="padding:24px; max-width:700px; width:100%; color:var(--ink);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px;">
        <div>
          <h2 style="font-size:22px; font-weight:700; margin:0;">Employee 360 Overview</h2>
          <span style="font-size:13px; color:var(--gold,#b45309); font-weight:600;">${userId}</span>
        </div>
        <button class="btn btn-ghost" onclick="document.getElementById('modal-root').innerHTML=''" style="padding:4px 8px;">✕</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#f8fafc; padding:16px; border-radius:10px;">
          <div style="font-weight:700; font-size:16px; color:var(--ink);" id="e360-name">Loading Employee...</div>
          <div style="font-size:12px; color:var(--muted); margin-top:2px;" id="e360-sub">Retrieving 360 profile</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">
          <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); padding:12px; border-radius:8px;">
            <div style="color:var(--muted); font-size:11px;">Employment Type</div>
            <div style="font-weight:600;" id="e360-type">Full Time (Permanent)</div>
          </div>
          <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); padding:12px; border-radius:8px;">
            <div style="color:var(--muted); font-size:11px;">Primary Location</div>
            <div style="font-weight:600;" id="e360-loc">Dawn Roast (Koramangala)</div>
          </div>
          <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); padding:12px; border-radius:8px;">
            <div style="color:var(--muted); font-size:11px;">Department &amp; Title</div>
            <div style="font-weight:600;" id="e360-dept">Barista Operations</div>
          </div>
          <div style="background:#fff; border:1px solid rgba(0,0,0,0.06); padding:12px; border-radius:8px;">
            <div style="color:var(--muted); font-size:11px;">System Access</div>
            <div style="font-weight:600;" id="e360-role">STAFF</div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-root').innerHTML=''">Close Profile</button>
        </div>
      </div>
    </div>
  `);

  apiGet(`/employees/${userId}`).then(res => {
    const prof = res?.data?.profile;
    if (prof) {
      document.getElementById("e360-name").textContent = prof.name || prof.identity?.name || userId;
      document.getElementById("e360-sub").textContent = `${prof.userId} · ${prof.email} · Status: ${prof.employmentStatus || 'ACTIVE'}`;
      document.getElementById("e360-type").textContent = `${prof.workerType || 'PERMANENT'} (${prof.employmentType || 'Full Time'})`;
      document.getElementById("e360-loc").textContent = prof.primaryCafeId || 'ZC-0001';
      document.getElementById("e360-dept").textContent = `${prof.department || 'Operations'} — ${prof.designation || 'Staff'}`;
      document.getElementById("e360-role").textContent = prof.role || 'STAFF';
    }
  }).catch(() => {});
}

function openLetterGeneratorModal() {
  openModal(`
    <div style="padding:24px; max-width:520px; width:100%; color:var(--ink);">
      <h2 style="font-size:20px; font-weight:700; margin:0 0 6px;">Generate HR Employment Letter</h2>
      <p style="font-size:13px; color:var(--muted); margin:0 0 20px;">Produce an authoritative, template-versioned HR document.</p>

      <form id="gen-letter-form" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Employee ID *</label>
          <input type="text" id="gl-user-id" required placeholder="e.g. ST-0004" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Letter Category *</label>
          <select id="gl-category" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;">
            <option value="APPOINTMENT_LETTER">Appointment Letter</option>
            <option value="CONFIRMATION_LETTER">Probation Confirmation Letter</option>
            <option value="TRANSFER_LETTER">Transfer &amp; Relocation Letter</option>
            <option value="PROMOTION_LETTER">Promotion Order</option>
            <option value="EXPERIENCE_CERTIFICATE">Service / Experience Certificate</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; display:block; margin-bottom:4px;">Document Title *</label>
          <input type="text" id="gl-doc-name" required value="Employment Verification Certificate" style="width:100%; padding:8px 12px; border:1px solid rgba(0,0,0,0.15); border-radius:6px; font-size:13px;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
          <button class="btn btn-ghost" type="button" onclick="document.getElementById('modal-root').innerHTML=''">Cancel</button>
          <button class="btn btn-primary" type="submit">Generate Letter</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById("gen-letter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userId = document.getElementById("gl-user-id").value.trim().toUpperCase();
    const payload = {
      category: document.getElementById("gl-category").value,
      documentName: document.getElementById("gl-doc-name").value,
    };

    try {
      const res = await apiPost(`/employees/${userId}/documents/generate`, payload);
      showToast(res.message || "Document generated successfully.", "success");
      document.getElementById("modal-root").innerHTML = "";
    } catch (err) {
      showToast(err.message || "Failed to generate document.", "error");
    }
  });
}
