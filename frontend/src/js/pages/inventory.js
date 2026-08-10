// =============================================================================
// PAGE: Inventory — API-wired version
// Stock Overview (list, low-stock flags)
// Fetches global items from GET /api/v1/inventory/items
// and cafe stock from GET /api/v1/inventory/cafes/:cafeId/stock
// =============================================================================
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast, skeleton } from "../components.js";
import { apiGet } from "../apiClient.js";

function stockRow(item) {
  const lowStock = (item.currentQuantityBase || item.onHand || 0) <= (item.reorderLevelBase || item.par || 0) * 0.5;
  const statusPill = lowStock
    ? `<span class="pill pill-coral" style="font-size:10px;">LOW STOCK</span>`
    : `<span class="pill pill-mint" style="font-size:10px;">OK</span>`;

  return `
    <tr>
      <td><strong>${item.name || item.itemId}</strong></td>
      <td>${item.baseUnit || item.unit || "pcs"}</td>
      <td>${item.currentQuantityBase ?? item.onHand ?? 0}</td>
      <td>${item.reorderLevelBase ?? item.par ?? "—"}</td>
      <td>${statusPill}</td>
    </tr>
  `;
}

export function renderInventory() {
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0] || "CAFE-0001";
  const scopeChip = isAdmin
    ? `<div class="pill pill-dark">${cafeId}</div>`
    : `<div class="pill pill-dark">All Cafes</div>`;

  return `
    <div class="page-enter">
      <div class="flex justify-between items-center" style="margin-bottom:18px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">Inventory</div>
          <div class="muted-white" style="font-size:13.5px;">${isAdmin ? `${cafeId} only` : "Aggregated across all cafes"}</div>
        </div>
        ${scopeChip}
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:18px;" id="inventory-kpi-grid">
        ${skeleton("80px")}${skeleton("80px")}${skeleton("80px")}
      </div>

      <div class="glass" style="padding:20px;">
        <div style="color:#fff; font-weight:600; font-size:15px; margin-bottom:14px;">Stock Items</div>
        <div id="inventory-table-wrap">${skeleton("200px")}</div>
      </div>
    </div>
  `;
}

export async function wireInventory(root) {
  const isAdmin = state.role === ROLES.CAFE_ADMIN;
  const cafeId = state.auth?.user?.primaryCafeId || state.auth?.user?.assignedCafeIds?.[0] || "CAFE-0001";

  const tableWrap = root.querySelector("#inventory-table-wrap");
  const kpiGrid = root.querySelector("#inventory-kpi-grid");

  try {
    let items = [];
    if (isAdmin && cafeId) {
      const res = await apiGet(`/inventory/cafes/${cafeId}/stock`);
      items = res?.data?.stock || res?.data || [];
    } else {
      const res = await apiGet("/inventory/items");
      items = res?.data?.items || res?.data || [];
    }

    const lowStockCount = items.filter(
      (i) => (i.currentQuantityBase || 0) <= (i.reorderLevelBase || 0) * 0.5
    ).length;

    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="glass kpi-card">
          <div class="kpi-label">Items tracked</div>
          <div class="kpi-value">${items.length}</div>
        </div>
        <div class="glass kpi-card">
          <div class="kpi-label">Below reorder level</div>
          <div class="kpi-value" style="color:${lowStockCount ? "#FF9E8F" : "#fff"}">${lowStockCount}</div>
        </div>
        <div class="glass kpi-card">
          <div class="kpi-label">Status</div>
          <div class="kpi-value" style="font-size:16px;">${lowStockCount > 0 ? "Action Required" : "Healthy"}</div>
        </div>
      `;
    }

    if (!tableWrap) return;

    if (items.length === 0) {
      tableWrap.innerHTML = `<div class="empty-state"><div class="empty-state-title">No inventory items found</div><div>Add global inventory items to begin tracking.</div></div>`;
      return;
    }

    tableWrap.innerHTML = `
      <table class="glass-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Unit</th>
            <th>On Hand</th>
            <th>Reorder Level</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(stockRow).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    if (tableWrap) {
      tableWrap.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load inventory — ${err.message || "network error"}.</div>`;
    }
  }
}
