// =============================================================================
// ZAMORIN CAFE ERP — STAFF DOCUMENT HUB (#staff-documents)
//
// Provides comprehensive employee self-service document view, category filtering,
// secure authenticated downloads, drag-and-drop upload with validation, and
// immutable HR letter protection.
// =============================================================================

import { apiGet, apiDelete } from "../apiClient.js";
import { state } from "../state.js";
import { icon } from "../icons.js";
import { showToast } from "../components.js";
import { setupModalA11y } from "../utils/modalA11y.js";

let cachedDocuments = [];
let activeCategoryFilter = "ALL";
let searchQuery = "";

const CATEGORY_LABELS = {
  APPOINTMENT_LETTER: "Appointment Letter",
  EMPLOYMENT_CONTRACT: "Employment Contract",
  CONFIRMATION_LETTER: "Confirmation Letter",
  TRANSFER_LETTER: "Transfer Letter",
  PROMOTION_LETTER: "Promotion Letter",
  EXPERIENCE_CERTIFICATE: "Experience Certificate",
  POLICY_ACKNOWLEDGEMENT: "Policy Acknowledgement",
  IDENTITY_DOCUMENT: "Identity Document (Aadhaar/PAN/Passport)",
  FOOD_SAFETY_CERTIFICATE: "Food Safety / FSSAI Certificate",
  OTHER: "Other Supporting Document",
};

const IMMUTABLE_CATEGORIES = new Set([
  "APPOINTMENT_LETTER",
  "EMPLOYMENT_CONTRACT",
  "CONFIRMATION_LETTER",
  "TRANSFER_LETTER",
  "PROMOTION_LETTER",
]);

export function renderStaffDocuments() {
  return `
    <div class="staff-docs-page" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary, #1e293b); margin: 0 0 0.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
            ${icon("files", 24)}
            <span>My Documents & HR Records</span>
          </h1>
          <p style="color: var(--text-secondary, #64748b); margin: 0; font-size: 0.875rem;">
            Access and download your employment agreements, statutory compliance proofs, and uploaded credentials.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button id="btn-export-profile-doc" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.875rem; font-size: 0.875rem; border-radius: 6px; cursor: pointer;">
            ${icon("download", 16)}
            <span>Export Profile Summary</span>
          </button>
          <button id="btn-open-upload-modal" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 600; border-radius: 6px; cursor: pointer; background: var(--primary, #6366f1); color: #fff; border: none;">
            ${icon("upload", 16)}
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      <!-- Stats Banner -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="card" style="padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #ffffff);">
          <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary, #64748b); text-transform: uppercase;">Total Documents</div>
          <div id="stat-total-docs" style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary, #1e293b); margin-top: 0.25rem;">—</div>
        </div>
        <div class="card" style="padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #ffffff);">
          <div style="font-size: 0.75rem; font-weight: 600; color: #16a34a; text-transform: uppercase;">Verified Records</div>
          <div id="stat-verified-docs" style="font-size: 1.75rem; font-weight: 700; color: #16a34a; margin-top: 0.25rem;">—</div>
        </div>
        <div class="card" style="padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #ffffff);">
          <div style="font-size: 0.75rem; font-weight: 600; color: #6366f1; text-transform: uppercase;">HR Letters</div>
          <div id="stat-hr-letters" style="font-size: 1.75rem; font-weight: 700; color: #6366f1; margin-top: 0.25rem;">—</div>
        </div>
        <div class="card" style="padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #ffffff);">
          <div style="font-size: 0.75rem; font-weight: 600; color: #ca8a04; text-transform: uppercase;">Awaiting Verification</div>
          <div id="stat-pending-docs" style="font-size: 1.75rem; font-weight: 700; color: #ca8a04; margin-top: 0.25rem;">—</div>
        </div>
      </div>

      <!-- Filters and Search -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="doc-category-pills">
          <button class="pill-btn active" data-cat="ALL" style="padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 500; cursor: pointer; border: 1px solid var(--primary, #6366f1); background: var(--primary, #6366f1); color: #fff;">All Records</button>
          <button class="pill-btn" data-cat="HR_LETTERS" style="padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 500; cursor: pointer; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #fff); color: var(--text-secondary, #64748b);">HR Letters</button>
          <button class="pill-btn" data-cat="STATUTORY" style="padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 500; cursor: pointer; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #fff); color: var(--text-secondary, #64748b);">Statutory & IDs</button>
          <button class="pill-btn" data-cat="CERTIFICATES" style="padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 500; cursor: pointer; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #fff); color: var(--text-secondary, #64748b);">Certificates</button>
        </div>
        <div style="position: relative; min-width: 240px;">
          <input type="text" id="doc-search-input" placeholder="Search by title, number..." style="width: 100%; padding: 0.45rem 0.75rem 0.45rem 2rem; border-radius: 6px; border: 1px solid var(--border-color, #cbd5e1); font-size: 0.875rem; outline: none;" />
          <span style="position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none;">
            ${icon("search", 14)}
          </span>
        </div>
      </div>

      <!-- Document List Table / Container -->
      <div class="card" style="border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #ffffff); overflow: hidden;">
        <div id="docs-loading-state" style="padding: 3rem; text-align: center; color: var(--text-secondary, #64748b);">
          <div style="display: inline-block; width: 2rem; height: 2rem; border: 3px solid #e2e8f0; border-top-color: var(--primary, #6366f1); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <div style="margin-top: 0.75rem; font-size: 0.875rem;">Loading documents...</div>
        </div>
        <div id="docs-empty-state" style="display: none; padding: 4rem 1.5rem; text-align: center;">
          <div style="margin-bottom: 0.75rem; color: #94a3b8;">${icon("files", 48)}</div>
          <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary, #1e293b); margin: 0 0 0.25rem 0;">No documents found</h3>
          <p style="color: var(--text-secondary, #64748b); margin: 0 0 1.25rem 0; font-size: 0.875rem;">Upload your identity documents or certification proofs to keep your file complete.</p>
          <button id="btn-empty-upload" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 6px; background: var(--primary, #6366f1); color: #fff; border: none; cursor: pointer;">
            Upload First Document
          </button>
        </div>
        <table id="docs-table" style="display: none; width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0); background: var(--bg-surface, #f8fafc); color: var(--text-secondary, #64748b);">
              <th style="padding: 0.75rem 1rem; font-weight: 600;">Document Title & Category</th>
              <th style="padding: 0.75rem 1rem; font-weight: 600;">Document ID / Number</th>
              <th style="padding: 0.75rem 1rem; font-weight: 600;">Validity / Issue Date</th>
              <th style="padding: 0.75rem 1rem; font-weight: 600;">Verification Status</th>
              <th style="padding: 0.75rem 1rem; font-weight: 600; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="docs-tbody"></tbody>
        </table>
      </div>

      <!-- Upload Document Modal -->
      <div id="upload-doc-modal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
        <div style="background: #ffffff; border-radius: 12px; width: 100%; max-width: 520px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); overflow: hidden;">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <h3 id="upload-doc-modal-title" style="margin: 0; font-size: 1.125rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
              ${icon("upload", 20)}
              <span>Upload Employee Document</span>
            </h3>
            <button id="btn-close-upload-modal" aria-label="Close upload modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #94a3b8;">&times;</button>
          </div>
          <form id="form-upload-doc" style="padding: 1.5rem;">
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.8125rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">Document Category *</label>
              <select id="upload-category" required style="width: 100%; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.875rem;">
                <option value="IDENTITY_DOCUMENT">Identity Document (Aadhaar / PAN / Passport / Voter ID)</option>
                <option value="FOOD_SAFETY_CERTIFICATE">Food Safety / FSSAI / Hygiene Certificate</option>
                <option value="EXPERIENCE_CERTIFICATE">Experience Certificate / Past Relieving Letter</option>
                <option value="POLICY_ACKNOWLEDGEMENT">Policy Acknowledgement Receipt</option>
                <option value="OTHER">Other Supporting Record</option>
              </select>
            </div>

            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.8125rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">Document Title / Description *</label>
              <input type="text" id="upload-title" placeholder="e.g. Government Aadhaar Card (Masked)" required maxlength="120" style="width: 100%; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.875rem;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">Document Number (Optional)</label>
                <input type="text" id="upload-doc-number" placeholder="e.g. XXXX-XXXX-1234" maxlength="60" style="width: 100%; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.875rem;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8125rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">Expiry Date (If applicable)</label>
                <input type="date" id="upload-expiry-date" style="width: 100%; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.875rem;" />
              </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-size: 0.8125rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem;">Select File (PDF, PNG, JPG — Max 5MB) *</label>
              <div id="dropzone" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; background: #f8fafc; transition: border-color 0.2s;">
                <input type="file" id="upload-file-input" accept=".pdf,.png,.jpg,.jpeg" required style="display: none;" />
                <div style="color: #6366f1; margin-bottom: 0.5rem;">${icon("upload", 28)}</div>
                <div id="file-name-display" style="font-size: 0.875rem; font-weight: 500; color: #1e293b;">Click or drop file here</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">Supported formats: PDF, PNG, JPG up to 5MB</div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
              <button type="button" id="btn-cancel-upload" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 6px; cursor: pointer;">Cancel</button>
              <button type="submit" id="btn-submit-upload" class="btn btn-primary" style="padding: 0.5rem 1.25rem; font-size: 0.875rem; font-weight: 600; border-radius: 6px; background: #6366f1; color: #fff; border: none; cursor: pointer;">Upload File</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function wireStaffDocuments(container) {
  if (!container) return;

  loadDocuments(container);

  // Filter Pills
  const pills = container.querySelectorAll("#doc-category-pills .pill-btn");
  pills.forEach((btn) => {
    btn.addEventListener("click", () => {
      pills.forEach((p) => {
        p.style.background = "var(--card-bg, #fff)";
        p.style.color = "var(--text-secondary, #64748b)";
        p.style.borderColor = "var(--border-color, #e2e8f0)";
      });
      btn.style.background = "var(--primary, #6366f1)";
      btn.style.color = "#fff";
      btn.style.borderColor = "var(--primary, #6366f1)";
      activeCategoryFilter = btn.getAttribute("data-cat");
      renderDocumentsTable(container);
    });
  });

  // Search
  const searchInput = container.querySelector("#doc-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = (e.target.value || "").trim().toLowerCase();
      renderDocumentsTable(container);
    });
  }

  // Profile Export
  const exportBtn = container.querySelector("#btn-export-profile-doc");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      exportBtn.disabled = true;
      try {
        const res = await fetch("/api/v1/employees/me/profile-summary/export", {
          credentials: "include",
          headers: { Accept: "application/pdf, application/json" },
        });
        if (!res.ok) throw new Error("Failed to export profile summary.");
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `Employee_Profile_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        showToast("Profile summary PDF downloaded successfully.", "success");
      } catch (err) {
        showToast(err.message || "Failed to download profile summary.", "error");
      } finally {
        exportBtn.disabled = false;
      }
    });
  }

  // Modal Open / Close
  const modal = container.querySelector("#upload-doc-modal");
  const openModalBtn = container.querySelector("#btn-open-upload-modal");
  const emptyUploadBtn = container.querySelector("#btn-empty-upload");
  const closeModalBtn = container.querySelector("#btn-close-upload-modal");
  const cancelModalBtn = container.querySelector("#btn-cancel-upload");
  const dropzone = container.querySelector("#dropzone");
  const fileInput = container.querySelector("#upload-file-input");
  const fileNameDisplay = container.querySelector("#file-name-display");
  let cleanupModalA11y = null;

  const openModal = () => {
    if (modal) {
      modal.style.display = "flex";
      cleanupModalA11y = setupModalA11y(modal, {
        onClose: closeModal,
        titleId: "upload-doc-modal-title",
      });
    }
  };
  const closeModal = () => {
    if (cleanupModalA11y) {
      cleanupModalA11y();
      cleanupModalA11y = null;
    }
    if (modal) modal.style.display = "none";
    const form = container.querySelector("#form-upload-doc");
    if (form) form.reset();
    if (fileNameDisplay) fileNameDisplay.textContent = "Click or drop file here";
  };

  openModalBtn?.addEventListener("click", openModal);
  emptyUploadBtn?.addEventListener("click", openModal);
  closeModalBtn?.addEventListener("click", closeModal);
  cancelModalBtn?.addEventListener("click", closeModal);

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        fileNameDisplay.textContent = fileInput.files[0].name;
      }
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#6366f1";
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.style.borderColor = "#cbd5e1";
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "#cbd5e1";
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        fileNameDisplay.textContent = e.dataTransfer.files[0].name;
      }
    });
  }

  // Form Submit
  const form = container.querySelector("#form-upload-doc");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = container.querySelector("#btn-submit-upload");
    if (!fileInput.files || !fileInput.files[0]) {
      showToast("Please choose a file to upload.", "error");
      return;
    }

    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size exceeds 5MB limit.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", container.querySelector("#upload-category").value);
    formData.append("title", container.querySelector("#upload-title").value);
    const docNum = container.querySelector("#upload-doc-number").value;
    if (docNum) formData.append("documentNumber", docNum);
    const expDate = container.querySelector("#upload-expiry-date").value;
    if (expDate) formData.append("expiryDate", expDate);

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";

    try {
      const res = await fetch("/api/v1/employees/me/documents/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || "Failed to upload document.");
      }
      showToast("Document uploaded successfully.", "success");
      closeModal();
      await loadDocuments(container);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Upload File";
    }
  });
}

async function loadDocuments(container) {
  const loading = container.querySelector("#docs-loading-state");
  const empty = container.querySelector("#docs-empty-state");
  const table = container.querySelector("#docs-table");

  if (loading) loading.style.display = "block";
  if (empty) empty.style.display = "none";
  if (table) table.style.display = "none";

  try {
    const res = await apiGet("/employees/me/documents");
    cachedDocuments = res?.data?.documents || [];
    updateStats(container, cachedDocuments);
    renderDocumentsTable(container);
  } catch (err) {
    if (loading) loading.innerHTML = `<div style="color: #ef4444;">Failed to load documents: ${err.message}</div>`;
  }
}

function updateStats(container, docs) {
  const total = docs.length;
  const verified = docs.filter((d) => d.verificationStatus === "VERIFIED").length;
  const hrLetters = docs.filter((d) => IMMUTABLE_CATEGORIES.has(d.category)).length;
  const pending = docs.filter((d) => d.verificationStatus === "PENDING_VERIFICATION" || !d.verificationStatus).length;

  const totalEl = container.querySelector("#stat-total-docs");
  const verifiedEl = container.querySelector("#stat-verified-docs");
  const hrLettersEl = container.querySelector("#stat-hr-letters");
  const pendingEl = container.querySelector("#stat-pending-docs");

  if (totalEl) totalEl.textContent = total;
  if (verifiedEl) verifiedEl.textContent = verified;
  if (hrLettersEl) hrLettersEl.textContent = hrLetters;
  if (pendingEl) pendingEl.textContent = pending;
}

function renderDocumentsTable(container) {
  const loading = container.querySelector("#docs-loading-state");
  const empty = container.querySelector("#docs-empty-state");
  const table = container.querySelector("#docs-table");
  const tbody = container.querySelector("#docs-tbody");

  if (loading) loading.style.display = "none";

  let filtered = [...cachedDocuments];

  // Category filter
  if (activeCategoryFilter === "HR_LETTERS") {
    filtered = filtered.filter((d) => IMMUTABLE_CATEGORIES.has(d.category));
  } else if (activeCategoryFilter === "STATUTORY") {
    filtered = filtered.filter((d) => d.category === "IDENTITY_DOCUMENT" || d.category === "POLICY_ACKNOWLEDGEMENT");
  } else if (activeCategoryFilter === "CERTIFICATES") {
    filtered = filtered.filter((d) => d.category === "FOOD_SAFETY_CERTIFICATE" || d.category === "EXPERIENCE_CERTIFICATE");
  }

  // Search filter
  if (searchQuery) {
    filtered = filtered.filter((d) => {
      const title = (d.title || "").toLowerCase();
      const num = (d.documentNumber || "").toLowerCase();
      const cat = (CATEGORY_LABELS[d.category] || d.category || "").toLowerCase();
      return title.includes(searchQuery) || num.includes(searchQuery) || cat.includes(searchQuery);
    });
  }

  if (filtered.length === 0) {
    if (table) table.style.display = "none";
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";
  if (table) table.style.display = "table";

  tbody.innerHTML = filtered
    .map((doc) => {
      const isImmutable = IMMUTABLE_CATEGORIES.has(doc.category);
      const catLabel = CATEGORY_LABELS[doc.category] || doc.category;
      const statusBadge = getStatusBadge(doc.verificationStatus);
      const docId = doc.documentId;

      return `
        <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0);">
          <td style="padding: 0.875rem 1rem;">
            <div style="font-weight: 600; color: var(--text-primary, #1e293b);">${escapeHtml(doc.title || "Untitled Document")}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary, #64748b); margin-top: 0.15rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 500;">${escapeHtml(catLabel)}</span>
              ${isImmutable ? '<span style="color: #6366f1; font-weight: 500;">● Official HR Record</span>' : ""}
            </div>
          </td>
          <td style="padding: 0.875rem 1rem; color: var(--text-secondary, #475569); font-family: monospace; font-size: 0.8125rem;">
            ${escapeHtml(doc.documentNumber || "—")}
          </td>
          <td style="padding: 0.875rem 1rem; color: var(--text-secondary, #475569);">
            <div>${doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : "—"}</div>
            ${doc.expiryDate ? `<div style="font-size: 0.75rem; color: #ea580c;">Expires: ${new Date(doc.expiryDate).toLocaleDateString()}</div>` : ""}
          </td>
          <td style="padding: 0.875rem 1rem;">
            ${statusBadge}
          </td>
          <td style="padding: 0.875rem 1rem; text-align: right; white-space: nowrap;">
            <button class="btn-download-doc" data-id="${docId}" title="Download document" style="padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; cursor: pointer; color: #334155; margin-right: 0.35rem;">
              ${icon("download", 14)}
            </button>
            ${
              isImmutable
                ? `<span title="Official HR records cannot be deleted" style="color: #94a3b8; padding: 0.35rem; display: inline-block;">${icon("lock", 14)}</span>`
                : `<button class="btn-delete-doc" data-id="${docId}" data-title="${escapeHtml(doc.title || "Document")}" title="Delete document" style="padding: 0.35rem 0.6rem; border: 1px solid #fecaca; background: #fff; border-radius: 6px; cursor: pointer; color: #dc2626;">
                    ${icon("trash", 14)}
                  </button>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  // Wire Download and Delete
  tbody.querySelectorAll(".btn-download-doc").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const docId = btn.getAttribute("data-id");
      try {
        btn.disabled = true;
        const res = await fetch(`/api/v1/employees/me/documents/${docId}/download`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Document download failed.");
        const blob = await res.blob();
        const contentDisp = res.headers.get("Content-Disposition") || "";
        let filename = "document";
        const match = contentDisp.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        showToast("Download started.", "success");
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".btn-delete-doc").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const docId = btn.getAttribute("data-id");
      const title = btn.getAttribute("data-title");
      if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;

      try {
        btn.disabled = true;
        await apiDelete(`/employees/me/documents/${docId}`);
        showToast("Document deleted successfully.", "success");
        await loadDocuments(container);
      } catch (err) {
        showToast(err.message, "error");
        btn.disabled = false;
      }
    });
  });
}

function getStatusBadge(status) {
  switch (status) {
    case "VERIFIED":
      return '<span style="background: #dcfce7; color: #166534; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 9999px;">Verified</span>';
    case "REJECTED":
      return '<span style="background: #fee2e2; color: #991b1b; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 9999px;">Rejected</span>';
    case "EXPIRED":
      return '<span style="background: #fef3c7; color: #92400e; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 9999px;">Expired</span>';
    default:
      return '<span style="background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 9999px;">Awaiting Review</span>';
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
