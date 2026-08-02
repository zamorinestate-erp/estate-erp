// PAGE: Tasks & Approvals (Part G.16 / M.8) — Cafe Admin's queue, and Owner's
// "Approvals Waiting on You" reuses the exact same inline-card pattern.
import { showToast, confirmAction } from "../components.js";
import { pushNotification } from "../notifications.js";

let QUEUE = [
  { id: "EX-0092", type: "Expense", who: "Ravi Kumar", detail: "₹1,850 — CoolTech AC Service", },
  { id: "LV-0044", type: "Leave", who: "Anjali Rao", detail: "3 days, 24–26 Jul" },
  { id: "PO-202607-0012", type: "Purchase Order", who: "Ravi Kumar", detail: "₹6,200 — Coffee beans restock" },
];

export function renderTasks({ title = "Tasks & Approvals" } = {}) {
  return `
    <div class="page-enter">
      <div style="color:#fff; font-size:22px; font-weight:700; margin-bottom:4px;" class="font-display">${title}</div>
      <div class="muted-white" style="font-size:13.5px; margin-bottom:18px;">${QUEUE.length} item(s) awaiting your decision</div>
      <div class="flex-col gap-md" id="task-list">${QUEUE.map(taskCard).join("") || emptyHtml()}</div>
    </div>
  `;
}

function emptyHtml() {
  return `<div class="glass empty-state"><div class="empty-state-title">Nothing waiting on you</div><div>New approvals will appear here the moment they're submitted.</div></div>`;
}

function taskCard(t) {
  return `
    <div class="glass" style="padding:18px; display:flex; justify-content:space-between; align-items:center;" data-task="${t.id}">
      <div>
        <div class="pill pill-dark" style="margin-bottom:6px; padding:3px 9px; font-size:10.5px;">${t.type}</div>
        <div style="color:#fff; font-weight:600; font-size:13.5px;">${t.detail}</div>
        <div class="muted-white" style="font-size:11.5px;">Submitted by ${t.who} · ${t.id}</div>
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-ghost" style="padding:8px 14px; font-size:12px;" data-reject="${t.id}">Reject</button>
        <button class="btn btn-primary" style="padding:8px 14px; font-size:12px;" data-approve="${t.id}">Approve</button>
      </div>
    </div>
  `;
}

export function wireTasks(root) {
  root.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => resolveTask(root, btn.dataset.approve, "approved"));
  });
  root.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction({
        title: `Reject ${btn.dataset.reject}?`,
        description: "Rejecting requires a reason, which is recorded against this request and shown to whoever submitted it.",
        confirmLabel: "Reject",
        onConfirm: () => resolveTask(root, btn.dataset.reject, "rejected"),
      });
    });
  });
}

function resolveTask(root, id, decision) {
  const task = QUEUE.find((t) => t.id === id);
  QUEUE = QUEUE.filter((t) => t.id !== id);
  const list = root.querySelector("#task-list");
  list.innerHTML = QUEUE.map(taskCard).join("") || emptyHtml();
  wireTasks(root);
  showToast(`${id} ${decision}`, decision === "approved" ? "mint" : "coral");

  if (task) {
    pushNotification({
      category: task.type,
      severity: decision === "approved" ? "success" : "warning",
      title: `${task.type} ${decision}`,
      message: `${task.id} — ${task.detail}`,
      recipientRoles: ["staff", "owner"],
      actionRequired: false,
      popupEligible: true,
      // "notifications" is deliberately used here rather than a module route:
      // this single event fans out to two roles (Staff, Owner) whose
      // navigation menus don't share the same routes, so the only deep link
      // guaranteed valid for both is the Notification Centre itself.
      deepLink: "notifications",
    });
  }
}
