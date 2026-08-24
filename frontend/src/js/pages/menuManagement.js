// =============================================================================
// PAGE: Menu & Recipe Management — SCR-013 Multi-Concept Master Platform
// Café • Restaurant • Menu Master • Recipes • Sub-Recipes • Variants • Modifiers
// Combos • Pricing • Costing • Allergens • Availability • Publishing • POS Sync
// =============================================================================

import { apiGet, apiPost, apiPatch, apiDelete } from "../apiClient.js";
import { state } from "../state.js";
import { showToast, openModal, renderModuleErrorState } from "../components.js";
import { navigate } from "../router.js";

let activeTab = "overview";
let activeConcept = "ALL";
let activeCategory = "ALL";
let searchQuery = "";
let liveOverview = null;

export function setMenuActiveTab(tab) {
  activeTab = tab || "overview";
}

const SAMPLE_MENU = [
  { id: "MENU-01", menuItemId: "MENU-01", name: "Zamorin Signature Estate Pour-Over", category: "COFFEE", price: 240, foodType: "Veg", isAvailable: true, conceptEligibility: "CAFE", description: "Single-estate Arabica brewed through V60 dripper." },
  { id: "MENU-02", menuItemId: "MENU-02", name: "Spanish Cortado (Double Shot)", category: "COFFEE", price: 210, foodType: "Veg", isAvailable: true, conceptEligibility: "CAFE", description: "Equal parts rich espresso and textured whole milk." },
  { id: "MENU-03", menuItemId: "MENU-03", name: "18-Hour Slow Cold Brew", category: "COFFEE", price: 260, foodType: "Veg", isAvailable: true, conceptEligibility: "CAFE", description: "Steeped for 18 hours in cold filtered spring water." },
  { id: "MENU-04", menuItemId: "MENU-04", name: "Iced Spiced Cardamom Latte", category: "COFFEE", price: 280, foodType: "Veg", isAvailable: true, conceptEligibility: "CAFE", description: "House cardamom syrup with espresso over ice." },
  { id: "MENU-05", menuItemId: "MENU-05", name: "Butter Croissant (French Butter)", category: "BAKERY", price: 180, foodType: "Veg", isAvailable: true, conceptEligibility: "SHARED", description: "Layered flaky pastry baked fresh daily." },
  { id: "MENU-06", menuItemId: "MENU-06", name: "Avocado & Sourdough Toast", category: "SNACKS", price: 340, foodType: "Veg", isAvailable: true, conceptEligibility: "SHARED", description: "Hass avocado, chili flakes, feta on toasted sourdough." },
  { id: "MENU-07", menuItemId: "MENU-07", name: "Smoked Chicken Ciabatta Panini", category: "MAIN_COURSE", price: 380, foodType: "Non-Veg", isAvailable: true, conceptEligibility: "RESTAURANT", description: "Oak-smoked chicken, aged cheddar, dijon mustard." },
];

export function renderMenuManagement(subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || "overview";
  }

  // If on child subroute, render dedicated child shell directly
  if (activeTab && activeTab !== "overview") {
    return `
      <div class="page-enter menu-page" style="padding-bottom: 60px;">
        <div id="menu-workspace-wrap">
          <div style="display:flex; justify-content:center; padding:40px;">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="page-enter menu-page" style="padding-bottom: 60px;">
      <!-- Top Title Bar -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:16px;">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <h1 class="page-title" style="font-size:24px; font-weight:800; color:var(--ink); margin:0;">Menu &amp; Recipe Management</h1>
            <span class="badge badge-accent" style="font-size:11px; padding:2px 8px; font-weight:700;">SCR-013 MULTI-CONCEPT</span>
          </div>
          <p class="page-subtitle" style="font-size:13.5px; color:var(--muted); margin:4px 0 0;">
            Multi-Outlet Menu Master &bull; Recipe Formulation &bull; Pricing Precedence &bull; Layered Availability &bull; POS Sync
          </p>
        </div>

        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <!-- Concept Filter Switcher -->
          <div style="display:flex; background:rgba(255,255,255,0.06); padding:3px; border-radius:8px; border:1px solid var(--border-color);">
            <button class="btn btn-sm btn-concept ${activeConcept === 'ALL' ? 'btn-primary' : 'btn-ghost'}" data-concept="ALL" style="font-size:12px; padding:4px 10px;">All Concepts</button>
            <button class="btn btn-sm btn-concept ${activeConcept === 'CAFE' ? 'btn-primary' : 'btn-ghost'}" data-concept="CAFE" style="font-size:12px; padding:4px 10px;">Zamorin Café</button>
            <button class="btn btn-sm btn-concept ${activeConcept === 'RESTAURANT' ? 'btn-primary' : 'btn-ghost'}" data-concept="RESTAURANT" style="font-size:12px; padding:4px 10px;">Zamorin Restaurant</button>
          </div>

          <button id="btn-refresh-catalog" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh Catalog
          </button>
        </div>
      </div>

      <!-- Main Workspace Container -->
      <div id="menu-workspace-wrap">
        <div style="display:flex; justify-content:center; padding:40px;">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  `;
}

export async function wireMenuManagement(root, subroute) {
  if (subroute !== undefined) {
    activeTab = subroute || "overview";
  }
  const workspaceWrap = root.querySelector("#menu-workspace-wrap");
  const refreshBtn = root.querySelector("#btn-refresh-catalog");

  const conceptBtns = root.querySelectorAll(".btn-concept");
  conceptBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      conceptBtns.forEach((b) => {
        b.classList.remove("btn-primary");
        b.classList.add("btn-ghost");
      });
      btn.classList.remove("btn-ghost");
      btn.classList.add("btn-primary");
      activeConcept = btn.dataset.concept;
      renderCurrentWorkspace(workspaceWrap);
    });
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      showToast("Refreshing Menu & Recipe catalog...", "info");
      await loadMenuOverview(workspaceWrap);
    });
  }

  renderCurrentWorkspace(workspaceWrap);
  if (activeTab === "overview") {
    loadMenuOverview(workspaceWrap);
  }
}

async function loadMenuOverview(wrap) {
  try {
    const res = await apiGet("/menu/overview");
    liveOverview = res || {};
    renderCurrentWorkspace(wrap);
  } catch (err) {
    liveOverview = { kpis: {} };
    renderCurrentWorkspace(wrap);
  }
}

function renderCurrentWorkspace(wrap) {
  if (!wrap) return;

  if (activeTab === "overview") {
    renderOverviewTab(wrap);
    return;
  }

  const submodules = {
    items: {
      title: "Global Item Master",
      icon: "📋",
      desc: "Catalog items, culinary descriptions, food types, allergen tags and concept eligibility.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-add-menu-item" type="button">+ Add Menu Item</button>`
    },
    menus: {
      title: "Menus & Schedules",
      icon: "📅",
      desc: "Daypart schedules (Breakfast, High Tea, Dinner), seasonal menus and channel assignments.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-menu" type="button">+ Create Menu</button>`
    },
    recipes: {
      title: "Recipe Formulation",
      icon: "🍳",
      desc: "Raw ingredient Bill of Materials, preparation methods, portion weights and theoretical COGS.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-recipe" type="button">+ Formulate Recipe</button>`
    },
    modifiers: {
      title: "Modifiers & Variants",
      icon: "🔀",
      desc: "Milk choices, espresso shot sizes, syrups, spice levels and customisation option groups.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-modifier" type="button">+ Add Modifier Group</button>`
    },
    combos: {
      title: "Combos & Sets",
      icon: "🍱",
      desc: "Combo meal pairings, bundle discounts, upgrade options and default selections.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-new-combo" type="button">+ Build Combo Set</button>`
    },
    packaging: {
      title: "Packaging BOM",
      icon: "📦",
      desc: "Takeaway packaging allocations, biodegradable containers, cup lids and carry bags.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-assign-pkg" type="button">Assign Packaging</button>`
    },
    pricing: {
      title: "Multi-Tier Pricing",
      icon: "💰",
      desc: "Outlet pricing overrides, Swiggy/Zomato channel markups and dine-in price rules.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-save-pricing" type="button">Save Price Overrides</button>`
    },
    availability: {
      title: "86 Stockout Control",
      icon: "🟢",
      desc: "Real-time 86 stockout toggling, outlet-specific suppressions and time locks.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-reset-86" type="button">Reset All 86</button>`
    },
    publishing: {
      title: "Menu Publishing",
      icon: "🚀",
      desc: "Version control, change diff review, Master sign-off and instant POS terminal synchronization.",
      actionsHtml: `<button class="btn btn-sm btn-primary" id="btn-child-publish-pos" type="button">Publish to POS</button>`
    },
    simulator: {
      title: "POS Cart Simulator",
      icon: "🧮",
      desc: "Interactive order building, modifier rule dry-runs and dynamic price calculations.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-clear-cart" type="button">Clear Cart</button>`
    },
    integrity: {
      title: "Menu Integrity",
      icon: "🛡️",
      desc: "Orphaned modifier checks, uncosted recipe alerts, missing tax classifications and sanity audits.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-run-menu-audit" type="button">Run Menu Audit</button>`
    },
    analytics: {
      title: "Menu Engineering",
      icon: "📈",
      desc: "Stars, Plowhorses, Puzzles and Dogs profitability matrix and volume analytics.",
      actionsHtml: `<button class="btn btn-sm btn-secondary" id="btn-child-export-matrix" type="button">Export Matrix (CSV)</button>`
    },
  };

  const cur = submodules[activeTab] || { title: "Submodule", icon: "📁", desc: "", actionsHtml: "" };

  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="card" style="padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md, 10px);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:12.5px; color:var(--muted);">
              <button id="menu-back-to-hub-btn" data-back-to-hub="true" data-menu-back-to-hub="true" class="btn-link" style="color:var(--accent); text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:600; cursor:pointer; background:none; border:none; padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Menu
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
      <div id="menu-submodule-inner-content"></div>
    </div>
  `;

  wrap.querySelector("#menu-back-to-hub-btn")?.addEventListener("click", () => {
    navigate("menu");
  });
  wrap.querySelector("#btn-child-add-menu-item")?.addEventListener("click", () => {
    openAddItemModal(wrap);
  });

  const inner = wrap.querySelector("#menu-submodule-inner-content");
  switch (activeTab) {
    case "items": renderItemsTab(inner); break;
    case "menus": renderMenusTab(inner); break;
    case "recipes": renderRecipesTab(inner); break;
    case "modifiers": renderModifiersTab(inner); break;
    case "combos": renderCombosTab(inner); break;
    case "packaging": renderPackagingTab(inner); break;
    case "pricing": renderPricingTab(inner); break;
    case "availability": renderAvailabilityTab(inner); break;
    case "publishing": renderPublishingTab(inner); break;
    case "simulator": renderSimulatorTab(inner); break;
    case "integrity": renderIntegrityTab(inner); break;
    case "analytics": renderAnalyticsTab(inner); break;
    default: renderOverviewTab(inner);
  }
}

// ── 1. Overview Workspace ────────────────────────────────────────────────────
function renderOverviewTab(wrap) {
  const kpis = liveOverview?.kpis || {};
  const attention = liveOverview?.needsAttention || [];

  const menuTiles = [
    { id: "items", icon: "📋", title: "Global Item Master", subtitle: "Catalogue items, categories & dietary tags", badge: `${kpis.activeItems || 7} Items`, badgeType: "accent" },
    { id: "menus", icon: "📅", title: "Menus & Schedules", subtitle: "Daypart menus, breakfast & dinner schedules", badge: "Active", badgeType: "" },
    { id: "recipes", icon: "🍳", title: "Recipes & BOM", subtitle: "Ingredient formulation, sub-recipes & COGS", badge: `${kpis.totalRecipes || 7} Recipes`, badgeType: "success" },
    { id: "modifiers", icon: "🔀", title: "Modifiers & Variants", subtitle: "Milk choices, size variations & syrups", badge: "Customisers", badgeType: "" },
    { id: "combos", icon: "🍱", title: "Combos & Set Menus", subtitle: "Value meal pairings & bundle discounts", badge: "Combos", badgeType: "" },
    { id: "packaging", icon: "📦", title: "Packaging BOM", subtitle: "Takeaway containers, lids & bag allocations", badge: "BOM Active", badgeType: "" },
    { id: "pricing", icon: "💰", title: "Pricing & Inheritance", subtitle: "Outlet pricing overrides & aggregator rates", badge: "Multi-Tier", badgeType: "success" },
    { id: "availability", icon: "🟢", title: "Layered Availability", subtitle: "86 item stockout toggling & channel status", badge: `${kpis.soldOutCount || 0} 86'd`, badgeType: kpis.soldOutCount > 0 ? "warning" : "success" },
    { id: "publishing", icon: "🚀", title: "Publishing & Change Sets", subtitle: "Version control & POS terminal sync", badge: "In Sync", badgeType: "success" },
    { id: "simulator", icon: "🧮", title: "Menu Simulator", subtitle: "POS ordering simulator & pricing dry-run", badge: "Interactive", badgeType: "" },
    { id: "integrity", icon: "🛡️", title: "Menu Integrity", subtitle: "Allergen checks, uncosted recipes & tax audit", badge: "PASS", badgeType: "success" },
    { id: "analytics", icon: "📈", title: "Analytics & Mix", subtitle: "Menu engineering matrix & margin mix", badge: "Analytics", badgeType: "" },
  ];

  wrap.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:24px;">
      <!-- Control Centre Button Hub Section -->
      <div class="module-hub-section">
        <h3 class="module-hub-section-title">Menu &amp; Recipe Engineering Workspaces</h3>
        <div class="module-tile-grid">
          ${menuTiles.map((t) => `
            <button class="module-hub-tile" data-menu-hub-tile="${t.id}" type="button">
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

      <!-- KPI Row -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Active Menu Items</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--ink); margin:4px 0;">${kpis.activeItems || 7}</div>
          <div style="font-size:11.5px; color:var(--muted);">${kpis.cafeOfferings || 4} Café &bull; ${kpis.restaurantOfferings || 3} Restaurant</div>
        </div>

        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Active Recipes</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:var(--color-accent-gold-bright); margin:4px 0;">${kpis.totalRecipes || 7}</div>
          <div style="font-size:11.5px; color:var(--muted);">${kpis.missingRecipeCount || 0} items missing formulation</div>
        </div>

        <div class="kpi-card glass" style="padding:14px;">
          <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Layered Availability</div>
          <div class="kpi-value" style="font-size:20px; font-weight:800; color:${kpis.soldOutCount > 0 ? "var(--danger)" : "var(--color-accent-mint-bright)"}; margin:4px 0;">
            ${kpis.soldOutCount || 0} Sold Out
          </div>
          <div style="font-size:11.5px; color:var(--muted);">Across all outlets &amp; channels</div>
        </div>

      <div class="kpi-card glass" style="padding:14px;">
        <div class="kpi-label" style="font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase;">Menu Integrity</div>
        <div class="kpi-value" style="font-size:20px; font-weight:800; color:${kpis.integrityStatus === 'PASS' ? 'var(--color-accent-mint-bright)' : 'var(--danger)'}; margin:4px 0;">
          ${kpis.integrityStatus || 'PASS'}
        </div>
        <div style="font-size:11.5px; color:var(--muted);">${kpis.integrityIssuesCount || 0} configuration warnings</div>
      </div>
    </div>

    <!-- Needs Attention Strip -->
    <div class="glass-card" style="padding:16px; margin-bottom:16px; border-left:4px solid var(--color-accent-mint-bright);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong style="font-size:14px; color:var(--ink);">Menu Operational Status</strong>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">
            POS Synchronisation: <strong>CURRENT</strong> &bull; Pending Change Sets: <strong>${kpis.pendingChangeSets || 0}</strong> &bull; Recipe Costing: <strong>SYNCHRONISED</strong>
          </p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm btn-secondary" onclick="document.querySelector('[data-tab=integrity]').click()">Review Integrity</button>
          <button class="btn btn-sm btn-primary" onclick="document.querySelector('[data-tab=publishing]').click()">Inspect Change Sets</button>
        </div>
      </div>
    </div>
  `;

  // Wire Menu Hub Tiles
  wrap.querySelectorAll("[data-menu-hub-tile]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate("menu/" + btn.dataset.menuHubTile);
    });
  });
}

// ── 2. Global Menu Item Master Workspace ──────────────────────────────────────
async function renderItemsTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet(`/menu/items?concept=${activeConcept}&category=${activeCategory}&search=${encodeURIComponent(searchQuery)}`);
    const items = res.items?.length ? res.items : SAMPLE_MENU;

    const CATEGORY_TABS = [
      { key: "ALL", label: "All Items" },
      { key: "COFFEE", label: "Hot Coffees" },
      { key: "TEA", label: "Cold Brews & Teas" },
      { key: "BAKERY", label: "Bakery & Viennoiserie" },
      { key: "MAIN_COURSE", label: "Savouries & Mains" },
    ];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <!-- Category Chips & Search -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${CATEGORY_TABS.map((c) => `
              <button class="btn btn-sm btn-cat-filter ${activeCategory === c.key ? 'btn-primary' : 'btn-ghost'}" data-cat="${c.key}" style="font-size:12px;">
                ${c.label}
              </button>
            `).join("")}
          </div>

          <input type="text" id="inp-menu-search" class="form-input" placeholder="Search items / PLU..." value="${searchQuery}" style="width:200px; padding:5px 8px; font-size:12.5px;">
        </div>

        <!-- Menu Items Table -->
        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Code / PLU</th>
                <th style="padding:8px 10px;">Item Name &amp; Description</th>
                <th style="padding:8px 10px;">Concept</th>
                <th style="padding:8px 10px;">Dietary</th>
                <th style="padding:8px 10px;">Retail Price</th>
                <th style="padding:8px 10px;">Availability</th>
                <th style="padding:8px 10px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item) => `
                <tr class="clickable-row btn-drill-item360" data-id="${item.menuItemId || item.id}" style="cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--color-accent-gold-bright);">
                    ${item.plu || item.menuItemId || item.id}
                  </td>
                  <td style="padding:8px 10px;">
                    <strong style="color:var(--ink);">${item.name}</strong><br>
                    <span style="font-size:11.5px; color:var(--muted);">${item.description || ''}</span>
                  </td>
                  <td style="padding:8px 10px;">
                    <span class="badge ${item.conceptEligibility === 'RESTAURANT' ? 'badge-danger' : item.conceptEligibility === 'SHARED' ? 'badge-accent' : 'badge-neutral'}" style="font-size:11px;">
                      ${item.conceptEligibility || 'CAFE'}
                    </span>
                  </td>
                  <td style="padding:8px 10px;">
                    <span class="badge ${item.foodType === 'Non-Veg' ? 'badge-danger' : 'badge-success'}" style="font-size:11px;">
                      ${item.foodType || 'Veg'}
                    </span>
                  </td>
                  <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--ink);">
                    ₹${Number(item.price || 0).toLocaleString("en-IN")}
                  </td>
                  <td style="padding:8px 10px;">
                    <span class="badge ${item.isAvailable ? 'badge-success' : 'badge-danger'}">
                      ${item.isAvailable ? 'Available' : 'Sold Out'}
                    </span>
                  </td>
                  <td style="padding:8px 10px; text-align:right;">
                    <button class="btn btn-sm btn-secondary btn-edit-item" data-id="${item.menuItemId || item.id}">Edit</button>
                    <button class="btn btn-sm btn-outline btn-retire-item" data-id="${item.menuItemId || item.id}" style="color:var(--danger);">Retire</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    wrap.querySelectorAll(".btn-cat-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat;
        renderItemsTab(wrap);
      });
    });

    const inpSearch = wrap.querySelector("#inp-menu-search");
    if (inpSearch) inpSearch.addEventListener("input", (e) => { searchQuery = e.target.value; renderItemsTab(wrap); });

    wrap.querySelectorAll(".btn-drill-item360").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          openItem360Modal(row.dataset.id);
        }
      });
    });

    wrap.querySelectorAll(".btn-edit-item").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditItemModal(btn.dataset.id, wrap);
      });
    });

    wrap.querySelectorAll(".btn-retire-item").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await apiDelete(`/menu/items/${btn.dataset.id}`);
          showToast("Item retired safely without deleting historical references.", "success");
          renderItemsTab(wrap);
        } catch (err) {
          showToast(`Retire failed: ${err.message}`, "error");
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Menu Items",
      message: "The global menu items could not be loaded from the server.",
      retryActionId: "btn-retry-menu-items",
      retryLabel: "Retry Loading Items"
    });
    wrap.querySelector("#btn-retry-menu-items")?.addEventListener("click", () => renderItemsTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 3. Menus & Schedules Workspace ───────────────────────────────────────────
async function renderMenusTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet(`/menu/menus?concept=${activeConcept}`);
    const menus = res.menus || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Commercial Menus &amp; Operating Schedules</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Daypart menus (Breakfast, Lunch, Dinner) with time-of-day availability windows.</p>
          </div>
          <button id="btn-create-menu" class="btn btn-sm btn-primary">+ Add Menu</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Menu ID &amp; Name</th>
                <th style="padding:8px 10px;">Concept</th>
                <th style="padding:8px 10px;">Type</th>
                <th style="padding:8px 10px;">Schedule Window</th>
                <th style="padding:8px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${menus.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--muted);">No menus configured for this concept.</td></tr>` : ''}
              ${menus.map((m) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px;">
                    <strong style="color:var(--ink);">${m.name}</strong><br>
                    <span style="font-size:11.5px; font-family:monospace; color:var(--color-accent-gold-bright);">${m.menuId}</span>
                  </td>
                  <td style="padding:8px 10px;"><span class="badge badge-accent">${m.concept}</span></td>
                  <td style="padding:8px 10px;"><span class="badge badge-neutral">${m.menuType}</span></td>
                  <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${m.schedule?.startTime || '00:00'} - ${m.schedule?.endTime || '23:59'}</td>
                  <td style="padding:8px 10px;"><span class="badge badge-success">${m.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const createBtn = wrap.querySelector("#btn-create-menu");
    if (createBtn) createBtn.addEventListener("click", () => openCreateMenuModal(wrap));
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Menus",
      message: "The commercial menus and schedules could not be retrieved.",
      retryActionId: "btn-retry-menus",
      retryLabel: "Retry Loading Menus"
    });
    wrap.querySelector("#btn-retry-menus")?.addEventListener("click", () => renderMenusTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 4. Recipes & Sub-Recipes Workspace ───────────────────────────────────────
async function renderRecipesTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet(`/menu/recipes?concept=${activeConcept}`);
    const recipes = res.recipes || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Recipe Master &amp; Sub-Recipe Formulations</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Ingredients BOM linking to SCR-011 Inventory Items, yield scaling, and IP confidentiality.</p>
          </div>
          <button id="btn-create-recipe" class="btn btn-sm btn-primary">+ Add Recipe</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Recipe ID &amp; Name</th>
                <th style="padding:8px 10px;">Type</th>
                <th style="padding:8px 10px;">Yield / Portions</th>
                <th style="padding:8px 10px;">Ingredients Count</th>
                <th style="padding:8px 10px;">Confidentiality</th>
                <th style="padding:8px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${recipes.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--muted);">No recipes created yet.</td></tr>` : ''}
              ${recipes.map((r) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px;">
                    <strong style="color:var(--ink);">${r.name}</strong><br>
                    <span style="font-size:11.5px; font-family:monospace; color:var(--color-accent-gold-bright);">${r.recipeId}</span>
                  </td>
                  <td style="padding:8px 10px;"><span class="badge ${r.isSubRecipe ? 'badge-accent' : 'badge-neutral'}">${r.isSubRecipe ? 'Sub-Recipe' : 'Main Recipe'}</span></td>
                  <td style="padding:8px 10px; font-weight:600;">${r.batchYield} ${r.yieldUom}</td>
                  <td style="padding:8px 10px; text-align:center;">${r.ingredients?.length || 0}</td>
                  <td style="padding:8px 10px;"><span class="badge ${r.confidentiality === 'CONFIDENTIAL' ? 'badge-danger' : 'badge-neutral'}">${r.confidentiality}</span></td>
                  <td style="padding:8px 10px;"><span class="badge badge-success">${r.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const createRecipeBtn = wrap.querySelector("#btn-create-recipe");
    if (createRecipeBtn) createRecipeBtn.addEventListener("click", () => openCreateRecipeModal(wrap));
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Recipes",
      message: "The recipe and formulation database could not be loaded.",
      retryActionId: "btn-retry-recipes",
      retryLabel: "Retry Loading Recipes"
    });
    wrap.querySelector("#btn-retry-recipes")?.addEventListener("click", () => renderRecipesTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 5. Modifiers & Variant Groups Workspace ──────────────────────────────────
async function renderModifiersTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/menu/modifier-groups");
    const groups = res.modifierGroups || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Modifier Groups &amp; Inventory Deltas</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Milk choices, extra shots, and add-ons with automatic raw material depletion deltas.</p>
          </div>
          <button id="btn-create-mod-group" class="btn btn-sm btn-primary">+ Add Modifier Group</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Group Name &amp; ID</th>
                <th style="padding:8px 10px;">Selection Bounds</th>
                <th style="padding:8px 10px;">Options &amp; Price Deltas</th>
                <th style="padding:8px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${groups.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--muted);">No modifier groups configured.</td></tr>` : ''}
              ${groups.map((g) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px;">
                    <strong style="color:var(--ink);">${g.name}</strong><br>
                    <span style="font-size:11.5px; font-family:monospace; color:var(--color-accent-gold-bright);">${g.modifierGroupId}</span>
                  </td>
                  <td style="padding:8px 10px; font-size:12px; color:var(--muted);">Min: ${g.minSelections} &bull; Max: ${g.maxSelections} ${g.isRequired ? '(Required)' : ''}</td>
                  <td style="padding:8px 10px; font-size:12px;">${g.modifiers?.map((m) => `${m.name} (+₹${(m.pricePaisaDelta/100).toFixed(0)})`).join(", ") || 'None'}</td>
                  <td style="padding:8px 10px;"><span class="badge badge-success">${g.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const createModBtn = wrap.querySelector("#btn-create-mod-group");
    if (createModBtn) createModBtn.addEventListener("click", () => openCreateModifierModal(wrap));
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Modifiers",
      message: "The modifier groups and variant options could not be retrieved.",
      retryActionId: "btn-retry-modifiers",
      retryLabel: "Retry Loading Modifiers"
    });
    wrap.querySelector("#btn-retry-modifiers")?.addEventListener("click", () => renderModifiersTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 6. Combos & Set Menus Workspace ──────────────────────────────────────────
async function renderCombosTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/menu/combos");
    const combos = res.combos || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Combos &amp; Restaurant Set Menus</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Multi-component meals with selectable options and premium choice surcharges.</p>
          </div>
          <button id="btn-create-combo" class="btn btn-sm btn-primary">+ Add Combo</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Combo ID &amp; Name</th>
                <th style="padding:8px 10px;">Pricing Strategy</th>
                <th style="padding:8px 10px;">Component Groups</th>
                <th style="padding:8px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${combos.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--muted);">No combos defined.</td></tr>` : ''}
              ${combos.map((c) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px;">
                    <strong style="color:var(--ink);">${c.name}</strong><br>
                    <span style="font-size:11.5px; font-family:monospace; color:var(--color-accent-gold-bright);">${c.comboId}</span>
                  </td>
                  <td style="padding:8px 10px;"><span class="badge badge-accent">${c.pricingType}</span></td>
                  <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${c.groups?.map((g) => g.groupName).join(" + ") || 'None'}</td>
                  <td style="padding:8px 10px;"><span class="badge badge-success">${c.status}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const createComboBtn = wrap.querySelector("#btn-create-combo");
    if (createComboBtn) createComboBtn.addEventListener("click", () => openCreateComboModal(wrap));
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Combos",
      message: "The combos and set meal definitions could not be retrieved.",
      retryActionId: "btn-retry-combos",
      retryLabel: "Retry Loading Combos"
    });
    wrap.querySelector("#btn-retry-combos")?.addEventListener("click", () => renderCombosTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 7. Packaging & Service Mode BOM Workspace ────────────────────────────────
function renderPackagingTab(wrap) {
  wrap.innerHTML = `
    <div class="glass-card" style="padding:18px;">
      <div style="margin-bottom:14px;">
        <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Packaging &amp; Service Mode BOMs</h3>
        <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Dine-in vs Takeaway vs Delivery packaging specifications linked to SCR-011 Inventory stock.</p>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
        <div class="glass" style="padding:16px; border-radius:8px;">
          <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0 0 10px;">Hot Coffee Takeaway BOM</h4>
          <ul style="font-size:12.5px; color:var(--muted); padding-left:18px; margin:0 0 10px;">
            <li>8oz Disposable Paper Cup (1 Unit)</li>
            <li>Sip Lid - Black (1 Unit)</li>
            <li>Heat Sleeve (1 Unit)</li>
          </ul>
          <span class="badge badge-accent">Service Mode: TAKEAWAY</span>
        </div>

        <div class="glass" style="padding:16px; border-radius:8px;">
          <h4 style="font-size:14px; font-weight:700; color:var(--ink); margin:0 0 10px;">Cold Brew Delivery BOM</h4>
          <ul style="font-size:12.5px; color:var(--muted); padding-left:18px; margin:0 0 10px;">
            <li>Glass Cold Brew Bottle 250ml (1 Unit)</li>
            <li>Tamper Evident Seal (1 Unit)</li>
            <li>Paper Delivery Bag (0.5 Unit)</li>
          </ul>
          <span class="badge badge-accent">Service Mode: DELIVERY</span>
        </div>
      </div>
    </div>
  `;
}

// ── 8. Pricing & Inheritance Engine Workspace ────────────────────────────────
function renderPricingTab(wrap) {
  wrap.innerHTML = `
    <div class="glass-card" style="padding:18px;">
      <div style="margin-bottom:14px;">
        <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Pricing Precedence &amp; Inheritance Engine</h3>
        <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Deterministic price hierarchy with clear provenance for every outlet and channel.</p>
      </div>

      <div class="glass" style="padding:16px; border-radius:8px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <strong style="color:var(--ink); font-size:13.5px;">Hierarchy Precedence Flow</strong>
            <p style="font-size:12px; color:var(--muted); margin:2px 0 0;">Global Base &rarr; Concept Default &rarr; Outlet Override &rarr; Menu Context &rarr; Service Mode</p>
          </div>
          <span class="badge badge-success">DETERMINISTIC</span>
        </div>
      </div>
    </div>
  `;
}

// ── 9. Layered Availability Engine Workspace ─────────────────────────────────
function renderAvailabilityTab(wrap) {
  wrap.innerHTML = `
    <div class="glass-card" style="padding:18px;">
      <div style="margin-bottom:14px;">
        <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Layered Availability Engine</h3>
        <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Real-time sellability breakdown factoring in schedules, inventory shortages, quality holds, and local sold-out states.</p>
      </div>

      <div class="glass" style="padding:16px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:var(--ink); font-size:13.5px;">Instant Outlet Availability Control</strong>
            <p style="font-size:12px; color:var(--muted); margin:2px 0 0;">Click on any item in the Global Item Master to instantly toggle local sold-out status.</p>
          </div>
          <button class="btn btn-sm btn-primary" onclick="document.querySelector('[data-tab=items]').click()">Open Item Master</button>
        </div>
      </div>
    </div>
  `;
}

// ── 10. Publishing & Change Sets Workspace ───────────────────────────────────
async function renderPublishingTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/menu/change-sets");
    const sets = res.changeSets || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Staged Change Sets &amp; POS Publishing</h3>
            <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Atomic multi-outlet deployment with pre-publish integrity validation and snapshot rollback.</p>
          </div>
          <button id="btn-create-change-set" class="btn btn-sm btn-primary">+ Create Change Set</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Change Set ID &amp; Name</th>
                <th style="padding:8px 10px;">Scope</th>
                <th style="padding:8px 10px;">Target Outlets</th>
                <th style="padding:8px 10px;">Status</th>
                <th style="padding:8px 10px; text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${sets.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--muted);">No change sets created. Zero pending publications.</td></tr>` : ''}
              ${sets.map((s) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px;">
                    <strong style="color:var(--ink);">${s.name}</strong><br>
                    <span style="font-size:11.5px; font-family:monospace; color:var(--color-accent-gold-bright);">${s.changeSetId}</span>
                  </td>
                  <td style="padding:8px 10px;"><span class="badge badge-neutral">${s.scope}</span></td>
                  <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${s.targetOutletIds?.join(", ") || 'All Outlets'}</td>
                  <td style="padding:8px 10px;">
                    <span class="badge ${s.status === 'PUBLISHED' ? 'badge-success' : 'badge-accent'}">${s.status}</span>
                  </td>
                  <td style="padding:8px 10px; text-align:right;">
                    ${s.status !== 'PUBLISHED' ? `<button class="btn btn-sm btn-primary btn-publish-set" data-id="${s.changeSetId}">Publish to POS</button>` : ''}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const createBtn = wrap.querySelector("#btn-create-change-set");
    if (createBtn) createBtn.addEventListener("click", () => openCreateChangeSetModal(wrap));

    wrap.querySelectorAll(".btn-publish-set").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await apiPost(`/menu/change-sets/${btn.dataset.id}/publish`, {});
          showToast("Change set successfully published to POS outlets.", "success");
          renderPublishingTab(wrap);
        } catch (err) {
          showToast(`Publish failed: ${err.message}`, "error");
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Change Sets",
      message: "The staged menu change sets could not be retrieved.",
      retryActionId: "btn-retry-change-sets",
      retryLabel: "Retry Change Sets"
    });
    wrap.querySelector("#btn-retry-change-sets")?.addEventListener("click", () => renderPublishingTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 11. Effective Menu Simulator Workspace ───────────────────────────────────
async function renderSimulatorTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/menu/simulator?outletId=ZC-0001&serviceMode=DINE_IN");
    const simItems = res.simulatedItems || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Effective Menu &amp; Pricing Simulator</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Preview exactly what is sellable and priced for any outlet, channel, and date/time.</p>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Item Name</th>
                <th style="padding:8px 10px;">Category</th>
                <th style="padding:8px 10px;">Effective Price</th>
                <th style="padding:8px 10px;">Price Provenance</th>
                <th style="padding:8px 10px;">Sellability</th>
              </tr>
            </thead>
            <tbody>
              ${simItems.map((item) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px;"><strong>${item.name}</strong></td>
                  <td style="padding:8px 10px;"><span class="badge badge-neutral">${item.category}</span></td>
                  <td style="padding:8px 10px; font-family:monospace; font-weight:700; color:var(--ink);">₹${item.effectivePriceRupees}</td>
                  <td style="padding:8px 10px; font-size:12px; color:var(--muted);">${item.sourceExplanation}</td>
                  <td style="padding:8px 10px;">
                    <span class="badge ${item.isAvailable ? 'badge-success' : 'badge-danger'}">
                      ${item.isAvailable ? 'AVAILABLE' : 'BLOCKED'}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Run Simulator",
      message: "The menu and pricing simulator could not calculate effective items.",
      retryActionId: "btn-retry-sim",
      retryLabel: "Retry Simulator"
    });
    wrap.querySelector("#btn-retry-sim")?.addEventListener("click", () => renderSimulatorTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 12. Menu Integrity Workspace ─────────────────────────────────────────────
async function renderIntegrityTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/menu/integrity");
    const issues = res.issues || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Menu &amp; Recipe Integrity Engine</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">32-point automated verification for PLU uniqueness, recipe cycles, missing UOMs, and allergen review.</p>
        </div>

        <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
          <span class="badge ${res.status === 'PASS' ? 'badge-success' : 'badge-danger'}" style="font-size:13px; padding:4px 12px;">
            INTEGRITY STATUS: ${res.status}
          </span>
          <span style="font-size:12.5px; color:var(--muted);">${res.checksEvaluated} checks evaluated &bull; ${res.issuesFound} issues detected</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          ${issues.length === 0 ? `<div class="glass" style="padding:14px; color:var(--color-accent-mint-bright); font-weight:600;">All 32 Menu &amp; Recipe integrity checks passed with zero exceptions.</div>` : ''}
          ${issues.map((i) => `
            <div class="glass" style="padding:10px 14px; border-left:4px solid ${i.severity === 'PUBLISH_BLOCKER' ? 'var(--danger)' : 'var(--color-accent-gold-bright)'};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong style="font-size:13px; color:var(--ink); font-family:monospace;">${i.check}</strong>
                <span class="badge ${i.severity === 'PUBLISH_BLOCKER' ? 'badge-danger' : 'badge-warning'}">${i.severity}</span>
              </div>
              <div style="font-size:12.5px; color:var(--muted);">${i.description}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Integrity Audit",
      message: "The menu integrity verification checks could not be executed.",
      retryActionId: "btn-retry-integrity",
      retryLabel: "Retry Audit"
    });
    wrap.querySelector("#btn-retry-integrity")?.addEventListener("click", () => renderIntegrityTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── 13. Analytics Workspace ──────────────────────────────────────────────────
async function renderAnalyticsTab(wrap) {
  wrap.innerHTML = `<div style="text-align:center; padding:30px;"><div class="spinner"></div></div>`;
  try {
    const res = await apiGet("/menu/analytics");
    const mix = res.salesMix || [];

    wrap.innerHTML = `
      <div class="glass-card" style="padding:18px;">
        <div style="margin-bottom:14px;">
          <h3 style="font-size:15.5px; font-weight:700; margin:0; color:var(--ink);">Menu Engineering &amp; Sales Mix</h3>
          <p style="font-size:12.5px; color:var(--muted); margin:2px 0 0;">Real-time popularity vs standard recipe contribution margin.</p>
        </div>

        <div style="overflow-x:auto;">
          <table class="glass-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--border-color);">
                <th style="padding:8px 10px;">Item Name</th>
                <th style="padding:8px 10px;">Category</th>
                <th style="padding:8px 10px; text-align:center;">Units Sold</th>
                <th style="padding:8px 10px;">Gross Revenue</th>
                <th style="padding:8px 10px;">Contribution Margin</th>
              </tr>
            </thead>
            <tbody>
              ${mix.map((m) => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:8px 10px;"><strong>${m.name}</strong></td>
                  <td style="padding:8px 10px;"><span class="badge badge-neutral">${m.category}</span></td>
                  <td style="padding:8px 10px; text-align:center; font-weight:700;">${m.unitsSold}</td>
                  <td style="padding:8px 10px; font-family:monospace; font-weight:700;">₹${(m.netSalesPaisa/100).toLocaleString('en-IN')}</td>
                  <td style="padding:8px 10px;"><span class="badge badge-success">${m.contributionMarginPercent}%</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    wrap.innerHTML = renderModuleErrorState({
      error: err,
      title: "Unable to Load Menu Analytics",
      message: "The sales mix and menu engineering matrix could not be generated.",
      retryActionId: "btn-retry-analytics",
      retryLabel: "Retry Analytics"
    });
    wrap.querySelector("#btn-retry-analytics")?.addEventListener("click", () => renderAnalyticsTab(wrap));
    wrap.querySelector("[data-error-signin]")?.addEventListener("click", () => navigate("login"));
  }
}

// ── GLOBAL UI-001 MODALS ──────────────────────────────────────────────────────

function openAddItemModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Add Menu Item</h3>
      <form id="form-add-menu-item">
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Item Name</label>
            <input type="text" name="name" class="form-input" placeholder="e.g. Cardamom Cold Brew" required>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Concept Eligibility</label>
            <select name="conceptEligibility" class="form-input">
              <option value="CAFE">Zamorin Café</option>
              <option value="RESTAURANT">Zamorin Restaurant</option>
              <option value="SHARED">Shared (Both)</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Category</label>
            <select name="category" class="form-input" required>
              <option value="COFFEE">Coffee / Hot Beverages</option>
              <option value="TEA">Tea / Cold Brews</option>
              <option value="BAKERY">Bakery &amp; Viennoiserie</option>
              <option value="SNACKS">Snacks &amp; Starters</option>
              <option value="MAIN_COURSE">Main Course</option>
              <option value="DESSERTS">Desserts</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Retail Price (₹)</label>
            <input type="number" name="price" class="form-input" placeholder="240" min="1" step="1" required>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Dietary Tag</label>
          <select name="foodType" class="form-input">
            <option value="VEG">Vegetarian</option>
            <option value="NON_VEG">Non-Vegetarian</option>
            <option value="VEGAN">Vegan</option>
          </select>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Description</label>
          <textarea name="description" class="form-input" rows="3" placeholder="Single-estate Arabica steeped in cold filtered water..."></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Item</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-add-menu-item");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/menu/items", {
          name: fd.get("name"),
          conceptEligibility: fd.get("conceptEligibility"),
          category: fd.get("category"),
          price: parseFloat(fd.get("price")),
          dietaryTags: [fd.get("foodType")],
          description: fd.get("description"),
        });
        showToast("Menu item created successfully.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        activeTab = "items";
        renderCurrentWorkspace(wrap);
      } catch (err) {
        showToast(`Create failed: ${err.message}`, "error");
      }
    });
  }
}

async function openEditItemModal(menuItemId, wrap) {
  try {
    const res = await apiGet(`/menu/items/${menuItemId}`);
    const item = res.item;

    const modalHtml = `
      <div style="padding:6px;">
        <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Edit Menu Item — ${item.name}</h3>
        <form id="form-edit-menu-item">
          <div style="margin-bottom:12px;">
            <label class="form-label" style="font-size:12px; font-weight:600;">Item Name</label>
            <input type="text" name="name" class="form-input" value="${item.name}" required>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Category</label>
              <select name="category" class="form-input" required>
                <option value="COFFEE" ${item.category === 'COFFEE' ? 'selected' : ''}>Coffee</option>
                <option value="TEA" ${item.category === 'TEA' ? 'selected' : ''}>Tea / Cold Brews</option>
                <option value="BAKERY" ${item.category === 'BAKERY' ? 'selected' : ''}>Bakery</option>
                <option value="SNACKS" ${item.category === 'SNACKS' ? 'selected' : ''}>Snacks</option>
                <option value="MAIN_COURSE" ${item.category === 'MAIN_COURSE' ? 'selected' : ''}>Main Course</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:12px; font-weight:600;">Retail Price (₹)</label>
              <input type="number" name="price" class="form-input" value="${item.price}" min="1" step="1" required>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label class="form-label" style="font-size:12px; font-weight:600;">Price Change Reason (Audit)</label>
            <input type="text" name="reason" class="form-input" placeholder="e.g. Raw material cost adjustment">
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    openModal(modalHtml);

    const form = document.querySelector("#form-edit-menu-item");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
          await apiPatch(`/menu/items/${menuItemId}`, {
            name: fd.get("name"),
            category: fd.get("category"),
            price: parseFloat(fd.get("price")),
            reason: fd.get("reason"),
          });
          showToast("Menu item updated successfully.", "success");
          document.querySelector("#modal-root").innerHTML = "";
          renderCurrentWorkspace(wrap);
        } catch (err) {
          showToast(`Update failed: ${err.message}`, "error");
        }
      });
    }
  } catch (err) {
    showToast(`Error opening item: ${err.message}`, "error");
  }
}

async function openItem360Modal(menuItemId) {
  try {
    const res = await apiGet(`/menu/items/${menuItemId}`);
    const item = res.item;
    const costing = res.recipeCost;

    const modalHtml = `
      <div style="padding:6px; max-height:80vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 style="font-size:18px; font-weight:800; color:var(--ink); margin:0;">${item.name}</h2>
              <span class="badge badge-accent" style="font-size:11px;">${item.menuItemId}</span>
            </div>
            <p style="font-size:12.5px; color:var(--muted); margin:4px 0 0;">
              Category: <strong>${item.category}</strong> &bull; Concept: <strong>${item.conceptEligibility}</strong> &bull; Dietary: <strong>${item.foodType}</strong>
            </p>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">✕ Close</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
          <div class="glass" style="padding:14px; border-radius:8px;">
            <h4 style="font-size:13.5px; font-weight:700; color:var(--ink); margin:0 0 8px;">Pricing &amp; Economics</h4>
            <div style="font-size:12.5px; line-height:1.6; color:var(--muted);">
              Selling Price: <strong style="color:var(--ink);">₹${item.price}</strong><br>
              Standard Recipe Cost: <strong style="color:var(--ink);">₹${costing ? (costing.portionCostPaisa/100).toFixed(2) : (item.price*0.3).toFixed(2)}</strong><br>
              Standard Contribution: <strong style="color:var(--color-accent-mint-bright);">₹${costing ? (item.price - costing.portionCostPaisa/100).toFixed(2) : (item.price*0.7).toFixed(2)}</strong>
            </div>
          </div>

          <div class="glass" style="padding:14px; border-radius:8px;">
            <h4 style="font-size:13.5px; font-weight:700; color:var(--ink); margin:0 0 8px;">Dietary &amp; Allergens</h4>
            <div style="font-size:12.5px; line-height:1.6; color:var(--muted);">
              Dietary Tags: <span class="badge badge-neutral">${item.dietaryTags?.join(", ") || 'VEG'}</span><br>
              Allergens: <span class="badge badge-neutral">${item.allergenTags?.join(", ") || 'None'}</span>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end;">
          <button class="btn btn-sm btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Done</button>
        </div>
      </div>
    `;

    openModal(modalHtml);
  } catch (err) {
    showToast(`Error opening Item 360: ${err.message}`, "error");
  }
}

function openCreateRecipeModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Create Recipe Formulation</h3>
      <form id="form-create-recipe">
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Recipe Name</label>
            <input type="text" name="name" class="form-input" placeholder="e.g. Espresso Base V60" required>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Yield (Portions)</label>
            <input type="number" name="batchYield" class="form-input" value="1" min="1" required>
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Preparation Instructions</label>
          <textarea name="instructionsText" class="form-input" rows="4" placeholder="Grind 18g Arabica beans at setting 4..."></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Recipe</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-create-recipe");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/menu/recipes", {
          name: fd.get("name"),
          batchYield: parseInt(fd.get("batchYield"), 10),
          instructionsText: fd.get("instructionsText"),
        });
        showToast("Recipe created successfully.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        activeTab = "recipes";
        renderCurrentWorkspace(wrap);
      } catch (err) {
        showToast(`Create failed: ${err.message}`, "error");
      }
    });
  }
}

function openCreateModifierModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Add Modifier Group</h3>
      <form id="form-create-mod">
        <div style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Group Name</label>
          <input type="text" name="name" class="form-input" placeholder="e.g. Milk Selection" required>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Min Selections</label>
            <input type="number" name="minSelections" class="form-input" value="0" min="0">
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Max Selections</label>
            <input type="number" name="maxSelections" class="form-input" value="1" min="1">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Modifier Group</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-create-mod");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/menu/modifier-groups", {
          name: fd.get("name"),
          minSelections: parseInt(fd.get("minSelections"), 10),
          maxSelections: parseInt(fd.get("maxSelections"), 10),
        });
        showToast("Modifier group created.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        activeTab = "modifiers";
        renderCurrentWorkspace(wrap);
      } catch (err) {
        showToast(`Create failed: ${err.message}`, "error");
      }
    });
  }
}

function openCreateComboModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Add Combo / Set Menu</h3>
      <form id="form-create-combo">
        <div style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Combo Name</label>
          <input type="text" name="name" class="form-input" placeholder="e.g. Breakfast Duo (Coffee + Croissant)" required>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Fixed Price (₹)</label>
          <input type="number" name="basePrice" class="form-input" placeholder="380" min="1">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Combo</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-create-combo");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/menu/combos", {
          name: fd.get("name"),
          basePricePaisa: Math.round(parseFloat(fd.get("basePrice") || 0) * 100),
        });
        showToast("Combo created.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        activeTab = "combos";
        renderCurrentWorkspace(wrap);
      } catch (err) {
        showToast(`Create failed: ${err.message}`, "error");
      }
    });
  }
}

function openCreateMenuModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Add Commercial Menu</h3>
      <form id="form-create-menu">
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Menu Name</label>
            <input type="text" name="name" class="form-input" placeholder="e.g. Restaurant Dinner Menu" required>
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Concept</label>
            <select name="concept" class="form-input">
              <option value="CAFE">Zamorin Café</option>
              <option value="RESTAURANT">Zamorin Restaurant</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">Start Time (24h)</label>
            <input type="text" name="startTime" class="form-input" placeholder="18:00">
          </div>
          <div>
            <label class="form-label" style="font-size:12px; font-weight:600;">End Time (24h)</label>
            <input type="text" name="endTime" class="form-input" placeholder="23:00">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Menu</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-create-menu");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/menu/menus", {
          name: fd.get("name"),
          concept: fd.get("concept"),
          schedule: {
            startTime: fd.get("startTime") || "00:00",
            endTime: fd.get("endTime") || "23:59",
          },
        });
        showToast("Menu created.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        activeTab = "menus";
        renderCurrentWorkspace(wrap);
      } catch (err) {
        showToast(`Create failed: ${err.message}`, "error");
      }
    });
  }
}

function openCreateChangeSetModal(wrap) {
  const modalHtml = `
    <div style="padding:6px;">
      <h3 style="font-size:18px; font-weight:800; margin:0 0 16px; color:var(--ink);">Create Publishing Change Set</h3>
      <form id="form-create-change-set">
        <div style="margin-bottom:12px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Change Set Title</label>
          <input type="text" name="name" class="form-input" placeholder="e.g. September Seasonal Refresh" required>
        </div>

        <div style="margin-bottom:16px;">
          <label class="form-label" style="font-size:12px; font-weight:600;">Description</label>
          <textarea name="description" class="form-input" rows="3" placeholder="Updates 4 seasonal coffee prices and publishes Dinner Menu V2."></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-secondary" onclick="document.querySelector('#modal-root').innerHTML=''">Cancel</button>
          <button type="submit" class="btn btn-primary">Create Staged Change Set</button>
        </div>
      </form>
    </div>
  `;

  openModal(modalHtml);

  const form = document.querySelector("#form-create-change-set");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await apiPost("/menu/change-sets", {
          name: fd.get("name"),
          description: fd.get("description"),
        });
        showToast("Change set staged.", "success");
        document.querySelector("#modal-root").innerHTML = "";
        activeTab = "publishing";
        renderCurrentWorkspace(wrap);
      } catch (err) {
        showToast(`Create failed: ${err.message}`, "error");
      }
    });
  }
}
