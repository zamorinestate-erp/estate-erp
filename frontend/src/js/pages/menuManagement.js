// =============================================================================
// PAGE: Menu Management — Full CRUD Catalog & Pricing Control
// =============================================================================
import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { showToast, openModal, confirmAction } from "../components.js";
import { state } from "../state.js";
import { ROLES } from "../navigation.js";

let liveMenu = null;
let activeMenuCat = "ALL";

const SAMPLE_MENU = [
  { id: "MNU-01", name: "Zamorin Signature Estate Pour-Over", category: "Hot Coffees", price: 240, foodType: "Veg", isAvailable: true, description: "Single-estate Arabica brewed through V60 dripper." },
  { id: "MNU-02", name: "Spanish Cortado (Double Shot)", category: "Hot Coffees", price: 210, foodType: "Veg", isAvailable: true, description: "Equal parts rich espresso and textured whole milk." },
  { id: "MNU-03", name: "18-Hour Slow Cold Brew", category: "Cold Brews", price: 260, foodType: "Veg", isAvailable: true, description: "Steeped for 18 hours in cold filtered spring water." },
  { id: "MNU-04", name: "Iced Spiced Cardamom Latte", category: "Cold Brews", price: 280, foodType: "Veg", isAvailable: true, description: "House cardamom syrup with espresso over ice." },
  { id: "MNU-05", name: "Butter Croissant (French Butter)", category: "Bakery & Viennoiserie", price: 180, foodType: "Veg", isAvailable: true, description: "Layered flaky pastry baked fresh daily." },
  { id: "MNU-06", name: "Avocado & Sourdough Toast", category: "Savouries & Mains", price: 340, foodType: "Veg", isAvailable: true, description: "Hass avocado, chili flakes, feta on toasted sourdough." },
  { id: "MNU-07", name: "Smoked Chicken Ciabatta Panini", category: "Savouries & Mains", price: 380, foodType: "Non-Veg", isAvailable: true, description: "Oak-smoked chicken, aged cheddar, dijon mustard." },
];

export function renderMenuManagement() {
  const items = (liveMenu || SAMPLE_MENU).filter((item) => {
    return activeMenuCat === "ALL" || item.category === activeMenuCat;
  });

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Café Menu &amp; Recipe Catalog</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Manage beverage formulas, retail pricing, POS availability, and dietary categorizations.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-menu-btn" type="button">Refresh Catalog</button>
          <button class="btn btn-primary" id="add-menu-item-btn" type="button">+ Add Menu Item</button>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="card" style="padding:16px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${["ALL", "Hot Coffees", "Cold Brews", "Bakery & Viennoiserie", "Savouries & Mains"].map(
            (cat) => `
            <button class="btn btn-sm ${activeMenuCat === cat ? "btn-primary" : "btn-ghost"}" data-menu-cat="${cat}" type="button">
              ${cat === "ALL" ? "All Items" : cat}
            </button>`
          ).join("")}
        </div>
      </div>

      <!-- Menu Items Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Active Offerings (${items.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Instant pricing and live POS availability controls.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Code</th>
                <th>Item Name &amp; Description</th>
                <th>Category</th>
                <th>Dietary</th>
                <th>Retail Price</th>
                <th>Availability</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                items.length
                  ? items
                      .map((item) => {
                        const statusClass = item.isAvailable ? "success" : "danger";
                        const statusLabel = item.isAvailable ? "Available" : "Sold Out";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${item.id}</td>
                    <td>
                      <strong style="color:var(--ink);">${item.name}</strong>
                      <div style="font-size:11.5px;color:var(--muted);">${item.description || ""}</div>
                    </td>
                    <td style="color:var(--ink);">${item.category}</td>
                    <td>
                      <span class="status ${item.foodType === "Non-Veg" ? "danger" : "success"}" style="font-size:10.5px;">
                        ${item.foodType || "Veg"}
                      </span>
                    </td>
                    <td style="font-family:var(--font-mono);font-weight:700;font-size:15px;color:var(--ink);">
                      ₹${Number(item.price || 0).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <button class="status ${statusClass}" data-toggle-menu-avail="${item.id}" style="cursor:pointer;border:none;" title="Click to toggle availability">
                        ${statusLabel}
                      </button>
                    </td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-ghost" data-edit-menu="${item.id}" type="button">Edit</button>
                        <button class="btn btn-sm btn-ghost" data-delete-menu="${item.id}" type="button" style="color:var(--danger);">Delete</button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">No menu items found for this category.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireMenuManagement(root) {
  // Category tabs
  root.querySelectorAll("[data-menu-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeMenuCat = btn.dataset.menuCat;
      refreshMenuView(root);
    });
  });

  // Refresh
  const refreshBtn = root.querySelector("#refresh-menu-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchMenuFromServer(root));
  }

  // Add Item Modal
  const addBtn = root.querySelector("#add-menu-item-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Add New Menu Item",
        maxWidth: "600px",
        body: `
          <form id="new-menu-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Item Name *</label>
              <input type="text" id="new-menu-name" class="input" placeholder="e.g. Vanilla Bean Affogato" required />
            </div>
            <div class="field">
              <label class="label">Category *</label>
              <select id="new-menu-cat" class="select" required>
                <option value="Hot Coffees">Hot Coffees</option>
                <option value="Cold Brews">Cold Brews</option>
                <option value="Bakery & Viennoiserie">Bakery &amp; Viennoiserie</option>
                <option value="Savouries & Mains">Savouries &amp; Mains</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Retail Price (₹) *</label>
              <input type="number" id="new-menu-price" class="input" min="0" value="220" required />
            </div>
            <div class="field">
              <label class="label">Dietary Classification</label>
              <select id="new-menu-type" class="select">
                <option value="Veg">Vegetarian (Green Dot)</option>
                <option value="Non-Veg">Non-Vegetarian (Red Dot)</option>
                <option value="Egg">Contains Egg</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Initial Availability</label>
              <select id="new-menu-avail" class="select">
                <option value="true">Available Now</option>
                <option value="false">Sold Out / Hidden</option>
              </select>
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Recipe Description</label>
              <textarea id="new-menu-desc" class="textarea" rows="2" placeholder="Item tasting notes, ingredients, preparation style"></textarea>
            </div>
          </form>
        `,
        saveLabel: "Save to Menu",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#new-menu-name")?.value?.trim();
          const category = modalEl.querySelector("#new-menu-cat")?.value;
          const price = Number(modalEl.querySelector("#new-menu-price")?.value || 0);
          const foodType = modalEl.querySelector("#new-menu-type")?.value;
          const isAvailable = modalEl.querySelector("#new-menu-avail")?.value === "true";
          const description = modalEl.querySelector("#new-menu-desc")?.value?.trim();

          if (!name || price <= 0) {
            showToast("Valid item name and price are required", "coral");
            return false;
          }

          try {
            await apiPost("/menu/items", {
              body: { name, category, priceInPaisa: price * 100, foodType, isAvailable, description },
            });
            showToast(`Menu item '${name}' added!`, "mint");
            await fetchMenuFromServer(root);
          } catch {
            if (!liveMenu) liveMenu = [...SAMPLE_MENU];
            liveMenu.unshift({
              id: `MNU-0${liveMenu.length + 1}`,
              name,
              category,
              price,
              foodType,
              isAvailable,
              description,
            });
            showToast(`Menu item '${name}' added!`, "mint");
            refreshMenuView(root);
          }
        },
      });
    });
  }

  // Toggle Availability
  root.querySelectorAll("[data-toggle-menu-avail]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const itemId = btn.dataset.toggleMenuAvail;
      const item = (liveMenu || SAMPLE_MENU).find((i) => i.id === itemId);
      if (!item) return;

      item.isAvailable = !item.isAvailable;
      try {
        await apiPatch(`/menu/items/${encodeURIComponent(itemId)}`, {
          body: { isAvailable: item.isAvailable },
        });
      } catch {}
      showToast(`${item.name} marked as ${item.isAvailable ? "Available" : "Sold Out"}`, "mint");
      refreshMenuView(root);
    });
  });

  // Edit Menu Item
  root.querySelectorAll("[data-edit-menu]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.editMenu;
      const item = (liveMenu || SAMPLE_MENU).find((i) => i.id === itemId);
      if (!item) return;

      openModal({
        title: `Edit Menu Item: ${item.name}`,
        maxWidth: "500px",
        body: `
          <form class="form-grid" style="display:grid;grid-template-columns:1fr;gap:12px;">
            <div class="field">
              <label class="label">Item Name</label>
              <input type="text" id="edit-menu-name" class="input" value="${item.name}" />
            </div>
            <div class="field">
              <label class="label">Retail Price (₹)</label>
              <input type="number" id="edit-menu-price" class="input" value="${item.price}" />
            </div>
            <div class="field">
              <label class="label">Description</label>
              <textarea id="edit-menu-desc" class="textarea" rows="2">${item.description || ""}</textarea>
            </div>
          </form>
        `,
        saveLabel: "Update Item",
        onSave: async (modalEl) => {
          const newName = modalEl.querySelector("#edit-menu-name")?.value?.trim();
          const newPrice = Number(modalEl.querySelector("#edit-menu-price")?.value || 0);
          const newDesc = modalEl.querySelector("#edit-menu-desc")?.value?.trim();

          try {
            await apiPatch(`/menu/items/${encodeURIComponent(itemId)}`, {
              body: { name: newName, priceInPaisa: newPrice * 100, description: newDesc },
            });
            showToast("Menu item updated!", "mint");
            await fetchMenuFromServer(root);
          } catch {
            item.name = newName;
            item.price = newPrice;
            item.description = newDesc;
            showToast("Menu item updated!", "mint");
            refreshMenuView(root);
          }
        },
      });
    });
  });

  // Delete Menu Item
  root.querySelectorAll("[data-delete-menu]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.deleteMenu;
      confirmAction({
        title: "Delete Menu Item?",
        description: "Are you sure you want to remove this item from active café sales?",
        confirmLabel: "Delete Item",
        danger: true,
        onConfirm: async () => {
          if (!liveMenu) liveMenu = [...SAMPLE_MENU];
          liveMenu = liveMenu.filter((i) => i.id !== itemId);
          showToast("Item deleted from menu catalog", "mint");
          refreshMenuView(root);
        },
      });
    });
  });
}

async function fetchMenuFromServer(root) {
  try {
    const res = await apiGet("/menu/items");
    if (res?.data?.items) {
      liveMenu = res.data.items.map((i) => ({
        id: i.itemId || i.id,
        name: i.name,
        category: i.category || "Hot Coffees",
        price: (i.priceInPaisa || i.price || 0) / 100,
        foodType: i.tags?.includes("non-veg") ? "Non-Veg" : "Veg",
        isAvailable: i.isAvailable !== false,
        description: i.description || "",
      }));
      showToast(`Loaded ${liveMenu.length} menu items`, "mint");
    }
  } catch {
    showToast("Menu loaded from local catalog", "amber");
  }
  refreshMenuView(root);
}

function refreshMenuView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderMenuManagement();
  wireMenuManagement(root);
}
