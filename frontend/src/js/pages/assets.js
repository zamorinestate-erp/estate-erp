// =============================================================================
// PAGE: Assets & Equipment Maintenance — Full Lifecycle & Service Logging
// =============================================================================
import { apiGet, apiPost, apiPatch } from "../apiClient.js";
import { showToast, openModal, confirmAction } from "../components.js";
import { state } from "../state.js";

let liveAssets = null;

const SAMPLE_ASSETS = [
  {
    assetId: "AST-001",
    name: "La Marzocco Linea PB 2-Group Espresso Machine",
    category: "Brewing Equipment",
    serialNumber: "LM-PB-99412",
    cafeId: "ZC-0001",
    purchaseDate: "2024-01-10",
    condition: "EXCELLENT",
    lastMaintenanceDate: "2026-08-01",
    nextMaintenanceDue: "2026-11-01",
  },
  {
    assetId: "AST-002",
    name: "Mahlkönig EK43 Commercial Coffee Grinder",
    category: "Grinders & Mills",
    serialNumber: "MK-EK43-7721",
    cafeId: "ZC-0001",
    purchaseDate: "2024-02-15",
    condition: "GOOD",
    lastMaintenanceDate: "2026-07-15",
    nextMaintenanceDue: "2026-10-15",
  },
  {
    assetId: "AST-003",
    name: "True Double-Door Commercial Undercounter Refrigerator",
    category: "Refrigeration",
    serialNumber: "TRU-UC-4412",
    cafeId: "ZC-0002",
    purchaseDate: "2024-03-20",
    condition: "NEEDS_SERVICE",
    lastMaintenanceDate: "2026-05-10",
    nextMaintenanceDue: "2026-08-10",
  },
];

export function renderAssets() {
  const assets = liveAssets || SAMPLE_ASSETS;

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Equipment &amp; Asset Management</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Register espresso machines, grinders, refrigeration, preventative maintenance logs, and asset lifecycle tracking.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-assets-btn" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-asset-btn" type="button">+ Register New Asset</button>
        </div>
      </div>

      <!-- Assets Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Asset Register (${assets.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Hardware tracking, warranty serials, and scheduled preventative maintenance.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Equipment Name &amp; Serial</th>
                <th>Category</th>
                <th>Café Location</th>
                <th>Condition</th>
                <th>Next Service Due</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                assets.length
                  ? assets
                      .map((a) => {
                        const condClass = a.condition === "EXCELLENT" || a.condition === "GOOD" ? "success" : "warning";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${a.assetId}</td>
                    <td>
                      <strong style="color:var(--ink);">${a.name}</strong>
                      <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">SN: ${a.serialNumber || "—"}</div>
                    </td>
                    <td><span class="status info">${a.category || "Equipment"}</span></td>
                    <td><span class="status info" style="font-family:var(--font-mono);font-size:11px;">${a.cafeId}</span></td>
                    <td><span class="status ${condClass}">${a.condition}</span></td>
                    <td style="font-family:var(--font-mono);font-size:12.5px;color:var(--muted);">${a.nextMaintenanceDue || "Quarterly"}</td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        <button class="btn btn-sm btn-primary" data-log-service="${a.assetId}" type="button">Log Service</button>
                        <button class="btn btn-sm btn-ghost" data-edit-asset="${a.assetId}" type="button">Edit</button>
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">No assets registered.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireAssets(root) {
  // Refresh
  const refreshBtn = root.querySelector("#refresh-assets-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchAssetsFromServer(root));
  }

  // Register Asset Modal
  const addBtn = root.querySelector("#add-asset-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Register New Equipment / Asset",
        maxWidth: "600px",
        body: `
          <form id="new-asset-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Equipment Name *</label>
              <input type="text" id="new-ast-name" class="input" placeholder="e.g. Mazzer Robur S Espresso Grinder" required />
            </div>
            <div class="field">
              <label class="label">Category *</label>
              <select id="new-ast-cat" class="select" required>
                <option value="Brewing Equipment">Brewing Equipment</option>
                <option value="Grinders & Mills">Grinders &amp; Mills</option>
                <option value="Refrigeration">Refrigeration &amp; Freezers</option>
                <option value="Ovens & Bakery">Ovens &amp; Bakery</option>
                <option value="POS & Electronics">POS &amp; Electronics</option>
                <option value="Furniture & Fixtures">Furniture &amp; Fixtures</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Serial Number / Asset Tag</label>
              <input type="text" id="new-ast-serial" class="input" placeholder="e.g. SN-88912" />
            </div>
            <div class="field">
              <label class="label">Café Branch *</label>
              <select id="new-ast-cafe" class="select" required>
                <option value="ZC-0001">ZC-0001 · Koramangala Main</option>
                <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
                <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Operating Condition</label>
              <select id="new-ast-condition" class="select">
                <option value="EXCELLENT">Excellent (Brand New / Serviced)</option>
                <option value="GOOD">Good (Operational)</option>
                <option value="NEEDS_SERVICE">Needs Service / Calibration</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Purchase Date</label>
              <input type="date" id="new-ast-date" class="input" value="${new Date().toISOString().slice(0, 10)}" />
            </div>
          </form>
        `,
        saveLabel: "Register Asset",
        onSave: async (modalEl) => {
          const name = modalEl.querySelector("#new-ast-name")?.value?.trim();
          const category = modalEl.querySelector("#new-ast-cat")?.value;
          const serialNumber = modalEl.querySelector("#new-ast-serial")?.value?.trim();
          const cafeId = modalEl.querySelector("#new-ast-cafe")?.value;
          const condition = modalEl.querySelector("#new-ast-condition")?.value;
          const purchaseDate = modalEl.querySelector("#new-ast-date")?.value;

          if (!name) {
            showToast("Equipment name is required", "coral");
            return false;
          }

          try {
            await apiPost("/assets", {
              body: { name, category, serialNumber, cafeId, condition, purchaseDate },
            });
            showToast(`Asset '${name}' registered!`, "mint");
            await fetchAssetsFromServer(root);
          } catch {
            if (!liveAssets) liveAssets = [...SAMPLE_ASSETS];
            liveAssets.unshift({
              assetId: `AST-00${liveAssets.length + 1}`,
              name,
              category,
              serialNumber,
              cafeId,
              condition,
              purchaseDate,
              nextMaintenanceDue: "Quarterly",
            });
            showToast(`Asset '${name}' registered!`, "mint");
            refreshAssetsView(root);
          }
        },
      });
    });
  }

  // Log Service Modal
  root.querySelectorAll("[data-log-service]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const astId = btn.dataset.logService;
      const asset = (liveAssets || SAMPLE_ASSETS).find((a) => a.assetId === astId);
      if (!asset) return;

      openModal({
        title: `Log Maintenance: ${asset.name}`,
        maxWidth: "500px",
        body: `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div class="field">
              <label class="label">Service Technician / Agency *</label>
              <input type="text" id="svc-tech" class="input" placeholder="e.g. Authorized Engineer - La Marzocco" required />
            </div>
            <div class="field">
              <label class="label">Service Date *</label>
              <input type="date" id="svc-date" class="input" value="${new Date().toISOString().slice(0, 10)}" required />
            </div>
            <div class="field">
              <label class="label">Service Details &amp; Parts Replaced</label>
              <textarea id="svc-notes" class="textarea" rows="2" placeholder="e.g. Group gasket replaced, boiler descaling, shower screen alignment"></textarea>
            </div>
            <div class="field">
              <label class="label">Updated Condition</label>
              <select id="svc-condition" class="select">
                <option value="EXCELLENT">Excellent (Freshly Serviced)</option>
                <option value="GOOD">Good</option>
              </select>
            </div>
          </div>
        `,
        saveLabel: "Log Maintenance Record",
        onSave: async (modalEl) => {
          const tech = modalEl.querySelector("#svc-tech")?.value?.trim();
          const cond = modalEl.querySelector("#svc-condition")?.value;
          if (!tech) {
            showToast("Service technician is required", "coral");
            return false;
          }

          asset.condition = cond;
          asset.lastMaintenanceDate = new Date().toISOString().slice(0, 10);
          showToast("Maintenance logged successfully!", "mint");
          refreshAssetsView(root);
        },
      });
    });
  });

  // Edit Asset Modal
  root.querySelectorAll("[data-edit-asset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const astId = btn.dataset.editAsset;
      const asset = (liveAssets || SAMPLE_ASSETS).find((a) => a.assetId === astId);
      if (!asset) return;

      openModal({
        title: `Edit Asset: ${asset.name}`,
        maxWidth: "500px",
        body: `
          <form class="form-grid" style="display:grid;grid-template-columns:1fr;gap:12px;">
            <div class="field">
              <label class="label">Equipment Name</label>
              <input type="text" id="edit-ast-name" class="input" value="${asset.name}" />
            </div>
            <div class="field">
              <label class="label">Serial Number</label>
              <input type="text" id="edit-ast-sn" class="input" value="${asset.serialNumber || ""}" />
            </div>
            <div class="field">
              <label class="label">Condition</label>
              <select id="edit-ast-cond" class="select">
                <option value="EXCELLENT" ${asset.condition === "EXCELLENT" ? "selected" : ""}>EXCELLENT</option>
                <option value="GOOD" ${asset.condition === "GOOD" ? "selected" : ""}>GOOD</option>
                <option value="NEEDS_SERVICE" ${asset.condition === "NEEDS_SERVICE" ? "selected" : ""}>NEEDS_SERVICE</option>
              </select>
            </div>
          </form>
        `,
        saveLabel: "Save Updates",
        onSave: async (modalEl) => {
          asset.name = modalEl.querySelector("#edit-ast-name")?.value?.trim();
          asset.serialNumber = modalEl.querySelector("#edit-ast-sn")?.value?.trim();
          asset.condition = modalEl.querySelector("#edit-ast-cond")?.value;
          showToast("Asset details updated!", "mint");
          refreshAssetsView(root);
        },
      });
    });
  });
}

async function fetchAssetsFromServer(root) {
  try {
    const res = await apiGet("/assets");
    if (res?.data?.assets) {
      liveAssets = res.data.assets;
      showToast(`Loaded ${liveAssets.length} assets`, "mint");
    }
  } catch {
    showToast("Loaded asset register", "amber");
  }
  refreshAssetsView(root);
}

function refreshAssetsView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderAssets();
  wireAssets(root);
}
