// =============================================================================
// PAGE: Tasks & Approvals — API-wired version
// Reads live approval queue from GET /api/v1/approvals.
// Actions post decisions to POST /api/v1/approvals/:approvalId/decide.
// =============================================================================
import { showToast, confirmAction, skeleton } from "../components.js";
import { apiGet, apiPost } from "../apiClient.js";

function emptyHtml() {
  return `<div class="glass empty-state"><div class="empty-state-title">Nothing waiting on you</div><div>New approvals will appear here the moment they're submitted.</div></div>`;
}

function taskCard(t) {
  const entityId = t.entityId || t.approvalId;
  return `
    <div class="glass" style="padding:18px; display:flex; justify-content:space-between; align-items:center;" data-approval-id="${t.approvalId}">
      <div>
        <div class="pill pill-dark" style="margin-bottom:6px; padding:3px 9px; font-size:10.5px;">${t.entityType}</div>
        <div style="color:#fff; font-weight:600; font-size:13.5px;">${t.description || t.title || "Pending Approval"}</div>
        <div class="muted-white" style="font-size:11.5px;">Submitted by ${t.requestedBy || "User"} · ${entityId}</div>
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-ghost" style="padding:8px 14px; font-size:12px;" data-reject="${t.approvalId}">Reject</button>
        <button class="btn btn-primary" style="padding:8px 14px; font-size:12px;" data-approve="${t.approvalId}">Approve</button>
      </div>
    </div>
  `;
}

export function renderTasks({ title = "Tasks & Approvals" } = {}) {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">${title}</div>
      <div class="muted-white" id="tasks-subtitle" style="font-size:13.5px; margin-bottom:18px;">Loading pending approvals…</div>
      <div class="flex-col gap-md" id="task-list">${skeleton("80px")}${skeleton("80px")}</div>
    </div>
  `;
}

export async function wireTasks(root) {
  await loadApprovals(root);
}

async function loadApprovals(root) {
  const listEl = root.querySelector("#task-list");
  const subtitle = root.querySelector("#tasks-subtitle");

  try {
    const res = await apiGet("/approvals?status=PENDING");
    const approvals = res?.data?.approvals || res?.data || [];

    if (subtitle) {
      subtitle.textContent = `${approvals.length} item(s) awaiting your decision`;
    }

    if (!listEl) return;

    if (approvals.length === 0) {
      listEl.innerHTML = emptyHtml();
      return;
    }

    listEl.innerHTML = approvals.map(taskCard).join("");

    root.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", () => handleDecision(root, btn.dataset.approve, "APPROVED"));
    });

    root.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", () => {
        confirmAction({
          title: `Reject approval ${btn.dataset.reject}?`,
          description: "Rejecting requires a reason, which is recorded against this request and shown to whoever submitted it.",
          confirmLabel: "Reject",
          onConfirm: () => handleDecision(root, btn.dataset.reject, "REJECTED"),
        });
      });
    });
  } catch (err) {
    if (subtitle) subtitle.textContent = "Could not load approvals";
    if (listEl) {
      listEl.innerHTML = `<div class="muted-white" style="padding:16px;">Failed to load approvals — ${err.message || "network error"}.</div>`;
    }
  }
}

async function handleDecision(root, approvalId, decision) {
  const actionLabel = decision === "APPROVED" ? "approved" : "rejected";
  try {
    await apiPost(`/approvals/${approvalId}/decide`, {
      body: { decision, reason: decision === "REJECTED" ? "Rejected by manager" : undefined },
    });
    showToast(`Approval ${actionLabel}`, decision === "APPROVED" ? "mint" : "coral");
    await loadApprovals(root);
  } catch (err) {
    showToast(err.message || "Failed to submit decision", "coral");
  }
}
