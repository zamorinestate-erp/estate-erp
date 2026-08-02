// =============================================================================
// PAGE: Inventory (Part G.8 of the guideline)
// Stock Overview (list, low-stock flags) + Stock Count (counted vs system,
// live variance calculation) — both role-scoped: Master sees a cafe
// selector across all cafes, Cafe Admin is locked to their own cafe only.
// =============================================================================
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast, confirmAction } from "../components.js";

const STOCK = [
  { id: "milk", name: "Whole Milk", unit: "L", onHand: 8, par: 30, cost: 62 },
  { id: "oatmilk", name: "Oat Milk", unit: "L", onHand: 3, par: 15, cost: 145 },
  { id: "cups", name: "12oz Cups", unit: "pcs", onHand: 140, par: 500, cost: 3.2 },
  { id: "beans", name: "Espresso Beans", unit: "kg", onHand: 22, par: 20, cost: 780 },
  { id: "syrup-vanilla", name: "Vanilla Syrup", unit: "btl", onHand: 6, par: 8, cost: 340 },
  { id: "croissant-frozen", name: "Frozen Croissant Dough", unit: "pcs", onHand: 48, par: 60, cost: 22 },
  { id: "sugar", name: "Sugar Sachets", unit: "pcs", onHand: 900, par: 1000, cost: 0.6 },
  { id: "tea-leaves", name: "Masala Chai Mix", unit: "kg", onHand: 4, par: 6, cost: 410 },
];

let countDraft = {}; // itemId -> counted qty typed by the user

export function renderInventory() {
  countDraft = {};
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  const scopeChip = isAdmin
    ? `<div class="pill pill-dark">Dawn Roast — Koramangala</div>`
    : `<div class="pill pill-dark">All Cafes ▾</div>`;

  const lowStockCount = STOCK.filter((s) => s.onHand < s.par * 0.5).length;

  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Inventory</div>
          <div class="muted-white" style="font-size:13.5px;">${isAdmin ? "Dawn Roast — Koramangala, only" : "Aggregated across all cafes — switch scope to drill down"}</div>
        </div>
        ${scopeChip}
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:18px;">
        <div class="glass kpi-card">
          <div class="kpi-label">Items tracked</div>
          <div class="kpi-value">${STOCK.length}</div>
        </div>
        <div class="glass kpi-card">
          <div class="kpi-label">Below 50% of par</div>
          <div class="kpi-value" style="color:${lowStockCount ? "#FF9E8F" : "#fff"}">${lowStockCount}</div>
          <div class="kpi-trend-down">${lowStockCount ? "Needs a reorder" : "All healthy"}</div>
        </div>
        <div class="glass kpi-card">
          <div class="kpi-label">Est. stock value</div>
          <div class="kpi-value">₹${STOCK.reduce((s, i) => s + i.onHand * i.cost, 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      <div class="glass" style="padding:20px;">
        <div class="flex justify-between items-center" style="margin-bottom:14px;">
          <div style="color:#fff; font-weight:600; font-size:15px;">Stock count — today</div>
          <button class="btn btn-primary" id="submit-count-btn" style="padding:9px 16px; font-size:13px;">Submit count</button>
        </div>
        <table class="glass-table">
          <thead>
            <tr><th>Item</th><th>System qty</th><th>Counted qty</th><th>Variance</th></tr>
          </thead>
          <tbody id="stock-rows">
            ${STOCK.map(stockRow).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function stockRow(item) {
  const low = item.onHand < item.par * 0.5;
  return `
    <tr data-row="${item.id}">
      <td>${item.name} <span class="muted-white" style="font-size:11px;">(${item.unit})</span> ${low ? '<span class="pill pill-coral" style="padding:2px 8px; font-size:10px; margin-left:6px;">Low</span>' : ""}</td>
      <td>${item.onHand}</td>
      <td>
        <input type="number" class="count-input" data-count="${item.id}" placeholder="—"
          style="width:70px; padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; font-size:13px;" />
      </td>
      <td class="variance-cell" data-variance="${item.id}" style="color:rgba(255,255,255,0.5);">—</td>
    </tr>
  `;
}

export function wireInventory(root) {
  root.querySelectorAll(".count-input").forEach((input) => {
    input.addEventListener("input", () => {
      const id = input.dataset.count;
      const item = STOCK.find((s) => s.id === id);
      const val = input.value === "" ? null : Number(input.value);
      const cell = root.querySelector(`[data-variance="${id}"]`);
      if (val === null || Number.isNaN(val)) {
        delete countDraft[id];
        cell.textContent = "—";
        cell.style.color = "rgba(255,255,255,0.5)";
        return;
      }
      countDraft[id] = val;
      const variance = val - item.onHand;
      cell.textContent = (variance > 0 ? "+" : "") + variance;
      cell.style.color = variance === 0 ? "var(--color-accent-mint-bright)" : variance < 0 ? "#FF9E8F" : "#FFD98A";
    });
  });

  root.querySelector("#submit-count-btn").addEventListener("click", () => {
    const counted = Object.keys(countDraft).length;
    if (counted === 0) {
      showToast("Enter at least one counted quantity first", "amber");
      return;
    }
    const bigVariances = Object.entries(countDraft).filter(([id, val]) => {
      const item = STOCK.find((s) => s.id === id);
      return Math.abs(val - item.onHand) / Math.max(item.onHand, 1) > 0.2;
    });
    confirmAction({
      title: `Submit count for ${counted} item(s)?`,
      description: bigVariances.length
        ? `${bigVariances.length} item(s) show a variance over 20% and will be flagged for review — this matches the evidence-required rule for large stock variances.`
        : `This will post the counted quantities and lock them from further edits.`,
      confirmLabel: "Submit count",
      onConfirm: () => {
        showToast("Stock count submitted and locked", "mint");
        countDraft = {};
        root.querySelectorAll(".count-input").forEach((i) => (i.value = ""));
        root.querySelectorAll(".variance-cell").forEach((c) => {
          c.textContent = "—";
          c.style.color = "rgba(255,255,255,0.5)";
        });
      },
    });
  });
}
