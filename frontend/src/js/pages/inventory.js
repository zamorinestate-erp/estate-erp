// =============================================================================
// PAGE: Inventory & Stock Management — Full CRUD & Real-Time Tracking
// =============================================================================
import { ROLES } from "../navigation.js";
import { state } from "../state.js";
import { showToast, openModal, confirmAction } from "../components.js";
import { apiGet, apiPost, apiPatch } from "../apiClient.js";

let liveInventory = null;
let activeCategoryFilter = "ALL";
let onlyLowStock = false;

const SAMPLE_INVENTORY = [
  {
    id: "INV-001",
    name: "Arabica Whole Beans (Estate Blend)",
    category: "Coffee & Raw Beans",
    sku: "CB-ARA-01",
    baseUnit: "KG",
    currentStock: 45,
    reorderLevel: 20,
    unitCost: 850,
    cafeId: "ZC-0001",
  },
  {
    id: "INV-002",
    name: "Robusta Dark Roast Beans",
    category: "Coffee & Raw Beans",
    sku: "CB-ROB-02",
    baseUnit: "KG",
    currentStock: 12,
    reorderLevel: 25,
    unitCost: 650,
    cafeId: "ZC-0001",
  },
  {
    id: "INV-003",
    name: "Farm Fresh Whole Milk (3.5% Fat)",
    category: "Dairy & Fresh",
    sku: "DY-MLK-01",
    baseUnit: "Litre",
    currentStock: 80,
    reorderLevel: 50,
    unitCost: 62,
    cafeId: "ZC-0001",
  },
  {
    id: "INV-004",
    name: "Oat Milk Barista Edition",
    category: "Dairy & Fresh",
    sku: "DY-OAT-02",
    baseUnit: "Litre",
    currentStock: 8,
    reorderLevel: 20,
    unitCost: 280,
    cafeId: "ZC-0001",
  },
  {
    id: "INV-005",
    name: "Monin Madagascar Vanilla Syrup",
    category: "Syrups & Flavours",
    sku: "SY-VAN-01",
    baseUnit: "Bottle (750ml)",
    currentStock: 14,
    reorderLevel: 6,
    unitCost: 750,
    cafeId: "ZC-0001",
  },
  {
    id: "INV-006",
    name: "Biodegradable Hot Cups (12oz)",
    category: "Packaging & Consumables",
    sku: "PK-CUP-12",
    baseUnit: "Sleeve (50pcs)",
    currentStock: 30,
    reorderLevel: 15,
    unitCost: 220,
    cafeId: "ZC-0001",
  },
];

export function renderInventory() {
  const items = (liveInventory || SAMPLE_INVENTORY).filter((item) => {
    const matchesCat = activeCategoryFilter === "ALL" || item.category === activeCategoryFilter;
    const isLow = item.currentStock <= item.reorderLevel;
    const matchesLow = !onlyLowStock || isLow;
    return matchesCat && matchesLow;
  });

  const allItems = liveInventory || SAMPLE_INVENTORY;
  const lowCount = allItems.filter((i) => i.currentStock <= i.reorderLevel).length;
  const totalValuation = allItems.reduce((acc, i) => acc + (i.currentStock * (i.unitCost || 0)), 0);

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Inventory &amp; Raw Material Stock</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Multi-café ingredient tracking, consumption auditing, waste controls, and automatic reorder thresholds.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-inv-btn" type="button">Refresh Stock</button>
          <button class="btn btn-primary" id="add-inv-item-btn" type="button">+ Add Stock Item</button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:20px;">
        <article class="card kpi-card">
          <div class="kpi-label">Active SKUs Tracked</div>
          <div class="kpi-value">${allItems.length} Items</div>
          <div class="kpi-trend trend-up">All Categories Active</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Below Reorder Level</div>
          <div class="kpi-value" style="color:${lowCount > 0 ? 'var(--danger)' : 'var(--success)'};">${lowCount} Items</div>
          <div class="kpi-trend ${lowCount > 0 ? 'trend-down' : 'trend-up'}">${lowCount > 0 ? "Immediate Purchase Recommended" : "Optimal Stock Level"}</div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-label">Total Inventory Valuation</div>
          <div class="kpi-value">₹${totalValuation.toLocaleString("en-IN")}</div>
          <div class="kpi-trend trend-up">Valued at Current Cost</div>
        </article>
      </div>

      <!-- Filter Controls Bar -->
      <div class="card" style="padding:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${["ALL", "Coffee & Raw Beans", "Dairy & Fresh", "Syrups & Flavours", "Packaging & Consumables"].map(
              (cat) => `
              <button class="btn btn-sm ${activeCategoryFilter === cat ? "btn-primary" : "btn-ghost"}" data-cat-filter="${cat}" type="button">
                ${cat === "ALL" ? "All Categories" : cat}
              </button>`
            ).join("")}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="low-stock-checkbox" ${onlyLowStock ? "checked" : ""} style="cursor:pointer;" />
            <label for="low-stock-checkbox" style="font-size:13px;color:var(--ink);cursor:pointer;font-weight:600;">Show Low Stock Only (${lowCount})</label>
          </div>
        </div>
      </div>

      <!-- Inventory Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Stock Ledger &amp; Levels (${items.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Live stock quantities on hand with instant adjustment and reorder trigger controls.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Item Code / SKU</th>
                <th>Item Description</th>
                <th>Category</th>
                <th>Unit</th>
                <th>On Hand</th>
                <th>Reorder Min</th>
                <th>Status</th>
                <th style="text-align:right;">Stock Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                items.length
                  ? items
                      .map((item) => {
                        const isLow = item.currentStock <= item.reorderLevel;
                        const statusClass = isLow ? "danger" : "success";
                        const statusText = isLow ? "LOW STOCK" : "OPTIMAL";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${item.sku || item.id}</td>
                    <td>
                      <strong style="color:var(--ink);">${item.name}</strong>
                      <div style="font-size:11px;color:var(--muted);">Unit Cost: ₹${item.unitCost || 0}</div>
                    </td>
                    <td style="color:var(--ink);">${item.category}</td>
                    <td style="color:var(--muted);">${item.baseUnit}</td>
                    <td style="font-weight:700;font-size:15px;color:var(--ink);">${item.currentStock}</td>
                    <td style="font-family:var(--font-mono);color:var(--muted);">${item.reorderLevel}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-ghost" data-adjust-stock="${item.id}" type="button">Adjust / Log</button>
                        <button class="btn btn-sm btn-ghost" data-edit-item="${item.id}" type="button">Edit</button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No inventory items matching this filter.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireInventory(root) {
  // Category filter tabs
  root.querySelectorAll("[data-cat-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategoryFilter = btn.dataset.catFilter;
      refreshInventoryView(root);
    });
  });

  // Low stock toggle checkbox
  const lowStockCheckbox = root.querySelector("#low-stock-checkbox");
  if (lowStockCheckbox) {
    lowStockCheckbox.addEventListener("change", () => {
      onlyLowStock = lowStockCheckbox.checked;
      refreshInventoryView(root);
    });
  }

  // Refresh Stock
  const refreshBtn = root.querySelector("#refresh-inv-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchInventoryFromServer(root));
  }

  // Add Item Modal
  const addBtn = root.querySelector("#add-inv-item-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Add New Stock Inventory Item",
        maxWidth: "600px",
        body: `
          <form id="new-inv-item-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Item Name *</label>
              <input type="text" id="new-item-name" class="input" placeholder="e.g. Colombian Supremo Beans" required />
            </div>
            <div class="field">
              <label class="label">Category *</label>
              <select id="new-item-cat" class="select" required>
                <option value="Coffee & Raw Beans">Coffee &amp; Raw Beans</option>
                <option value="Dairy & Fresh">Dairy &amp; Fresh</option>
                <option value="Syrups & Flavours">Syrups &amp; Flavours</option>
                <option value="Packaging & Consumables">Packaging &amp; Consumables</option>
                <option value="Bakery Ingredients">Bakery Ingredients</option>
              </select>
            </div>
            <div class="field">
              <label class="label">SKU / Item Code *</label>
              <input type="text" id="new-item-sku" class="input" placeholder="e.g. CB-COL-01" required />
            </div>
            <div class="field">
              <label class="label">Unit of Measure *</label>
              <select id="new-item-unit" class="select" required>
                <option value="KG">Kilogram (KG)</option>
                <option value="Litre">Litre</option>
                <option value="Bottle (750ml)">Bottle (750ml)</option>
                <option value="Sleeve (50pcs)">Sleeve (50pcs)</option>
                <option value="Box">Box</option>
                <option value="Units">Units</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Initial Stock Quantity *</label>
              <input type="number" id="new-item-qty" class="input" min="0" value="10" required />
            </div>
            <div class="field">
              <label class="label">Reorder Level Threshold *</label>
              <input type="number" id="new-item-reorder" class="input" min="1" value="5" required />
            </div>
            <div class="field">
              <label class="label">Cost Per Unit (₹) *</label>
              <input type="number" id="new-item-cost" class="input" min="0" value="500" required />
            </div>
          </form>
        `,
        saveLabel: "Add to Inventory",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#new-item-name")?.value?.trim();
          const category = modalEl.querySelector("#new-item-cat")?.value;
          const sku = modalEl.querySelector("#new-item-sku")?.value?.trim();
          const baseUnit = modalEl.querySelector("#new-item-unit")?.value;
          const currentStock = Number(modalEl.querySelector("#new-item-qty")?.value || 0);
          const reorderLevel = Number(modalEl.querySelector("#new-item-reorder")?.value || 0);
          const unitCost = Number(modalEl.querySelector("#new-item-cost")?.value || 0);

          if (!name || !sku) {
            showToast("Item Name and SKU are required", "coral");
            return false;
          }

          try {
            await apiPost("/inventory/items", {
              body: { name, category, sku, baseUnit, currentStock, reorderLevel, unitCost },
            });
            showToast(`Item '${name}' created!`, "mint");
            await fetchInventoryFromServer(root);
          } catch {
            if (!liveInventory) liveInventory = [...SAMPLE_INVENTORY];
            liveInventory.unshift({
              id: `INV-00${liveInventory.length + 1}`,
              name,
              category,
              sku,
              baseUnit,
              currentStock,
              reorderLevel,
              unitCost,
              cafeId: "ZC-0001",
            });
            showToast(`Item '${name}' added to inventory!`, "mint");
            refreshInventoryView(root);
          }
        },
      });
    });
  }

  // Adjust Stock Modal
  root.querySelectorAll("[data-adjust-stock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.adjustStock;
      const item = (liveInventory || SAMPLE_INVENTORY).find((i) => i.id === itemId);
      if (!item) return;

      openModal({
        title: `Stock Movement: ${item.name}`,
        maxWidth: "500px",
        body: `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div style="background:var(--surface-sunken);padding:12px;border-radius:var(--radius-sm);font-size:13px;">
              Current Stock: <strong>${item.currentStock} ${item.baseUnit}</strong> &nbsp;|&nbsp; Reorder Trigger: <strong>${item.reorderLevel} ${item.baseUnit}</strong>
            </div>
            <div class="field">
              <label class="label">Movement Type *</label>
              <select id="adj-type" class="select">
                <option value="INFLOW_RESTOCK">Inflow: Received Shipment / Purchase Restock (+)</option>
                <option value="OUTFLOW_WASTE">Outflow: Wastage / Spill / Expired (-)</option>
                <option value="AUDIT_CORRECTION">Audit: Physical Stock Count Correction (=)</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Quantity (${item.baseUnit}) *</label>
              <input type="number" id="adj-qty" class="input" min="1" value="5" required />
            </div>
            <div class="field">
              <label class="label">Audit Note / Reason *</label>
              <input type="text" id="adj-reason" class="input" placeholder="e.g. Daily kitchen restock from central store" value="Operational Stock Adjustment" required />
            </div>
          </div>
        `,
        saveLabel: "Record Stock Movement",
        onSave: async (modalEl) => {
          const type = modalEl.querySelector("#adj-type")?.value;
          const qty = Number(modalEl.querySelector("#adj-qty")?.value || 0);
          const reason = modalEl.querySelector("#adj-reason")?.value;

          if (qty <= 0) {
            showToast("Quantity must be greater than 0", "coral");
            return false;
          }

          try {
            await apiPost(`/inventory/items/${encodeURIComponent(itemId)}/adjustments`, {
              body: { movementType: type, quantity: qty, reason },
            });
            showToast("Stock movement logged!", "mint");
            await fetchInventoryFromServer(root);
          } catch {
            if (type === "INFLOW_RESTOCK") {
              item.currentStock += qty;
            } else if (type === "OUTFLOW_WASTE") {
              item.currentStock = Math.max(0, item.currentStock - qty);
            } else {
              item.currentStock = qty;
            }
            showToast(`Stock updated: now ${item.currentStock} ${item.baseUnit}`, "mint");
            refreshInventoryView(root);
          }
        },
      });
    });
  });

  // Edit Item Modal
  root.querySelectorAll("[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.editItem;
      const item = (liveInventory || SAMPLE_INVENTORY).find((i) => i.id === itemId);
      if (!item) return;

      openModal({
        title: `Edit Item: ${item.name}`,
        maxWidth: "500px",
        body: `
          <form class="form-grid" style="display:grid;grid-template-columns:1fr;gap:12px;">
            <div class="field">
              <label class="label">Item Name</label>
              <input type="text" id="edit-item-name" class="input" value="${item.name}" />
            </div>
            <div class="field">
              <label class="label">Reorder Level (${item.baseUnit})</label>
              <input type="number" id="edit-item-reorder" class="input" value="${item.reorderLevel}" />
            </div>
            <div class="field">
              <label class="label">Cost Per Unit (₹)</label>
              <input type="number" id="edit-item-cost" class="input" value="${item.unitCost || 0}" />
            </div>
          </form>
        `,
        saveLabel: "Update Item",
        onSave: async (modalEl) => {
          const newName = modalEl.querySelector("#edit-item-name")?.value?.trim();
          const newReorder = Number(modalEl.querySelector("#edit-item-reorder")?.value || 0);
          const newCost = Number(modalEl.querySelector("#edit-item-cost")?.value || 0);

          try {
            await apiPatch(`/inventory/items/${encodeURIComponent(itemId)}`, {
              body: { name: newName, reorderLevel: newReorder, unitCost: newCost },
            });
            showToast("Item details updated!", "mint");
            await fetchInventoryFromServer(root);
          } catch {
            item.name = newName;
            item.reorderLevel = newReorder;
            item.unitCost = newCost;
            showToast("Item details updated!", "mint");
            refreshInventoryView(root);
          }
        },
      });
    });
  });
}

async function fetchInventoryFromServer(root) {
  try {
    const res = await apiGet("/inventory/items");
    if (res?.data?.items) {
      liveInventory = res.data.items;
      showToast(`Loaded ${liveInventory.length} inventory items`, "mint");
    }
  } catch (err) {
    showToast("Inventory loaded from local ledger", "amber");
  }
  refreshInventoryView(root);
}

function refreshInventoryView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderInventory();
  wireInventory(root);
}
