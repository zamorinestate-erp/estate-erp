// =============================================================================
// PAGE: Tasks & Approvals — Operational Task Assignments & Multi-Level Approvals
// =============================================================================
import { showToast, openModal, confirmAction } from "../components.js";
import { apiGet, apiPost } from "../apiClient.js";
import { state } from "../state.js";

let liveTasks = null;
let activeTaskTab = "ALL";

const SAMPLE_TASKS = [
  {
    taskId: "TSK-001",
    title: "Deep Descaling & Backflush of Espresso Machine Group 1 & 2",
    assignedTo: "Priya Nair (Barista Lead)",
    cafeId: "ZC-0001",
    dueDate: "Today, 10:00 PM",
    priority: "HIGH",
    status: "PENDING",
    type: "EQUIPMENT_MAINTENANCE",
  },
  {
    taskId: "TSK-002",
    title: "Review & Signoff: Weekly Coffee Bean Delivery (50kg Arabica)",
    assignedTo: "Ravi Kumar (Café Admin)",
    cafeId: "ZC-0001",
    dueDate: "Tomorrow, 09:00 AM",
    priority: "NORMAL",
    status: "PENDING",
    type: "INVENTORY_RECEIVING",
  },
  {
    taskId: "TSK-003",
    title: "Monthly Fire Safety & First Aid Box Audit",
    assignedTo: "Suresh Menon",
    cafeId: "ZC-0002",
    dueDate: "2026-08-20",
    priority: "NORMAL",
    status: "COMPLETED",
    type: "SAFETY_COMPLIANCE",
  },
];

export function renderTasks() {
  const tasks = (liveTasks || SAMPLE_TASKS).filter((t) => {
    return activeTaskTab === "ALL" || t.status === activeTaskTab;
  });

  return `
    <div class="page-enter">
      <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:20px;">
        <div>
          <h1 class="page-title" style="font-size:26px;font-weight:700;margin:0 0 6px;color:var(--ink);">Shift Tasks &amp; Operational Approvals</h1>
          <p class="page-subtitle" style="font-size:14px;color:var(--muted);margin:0;">Assign store checklists, equipment care procedures, hygiene signoffs, and high-value approvals.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="refresh-tasks-btn" type="button">Refresh</button>
          <button class="btn btn-primary" id="add-task-btn" type="button">+ Assign New Task</button>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="card" style="padding:16px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${["ALL", "PENDING", "COMPLETED"].map(
            (tab) => `
            <button class="btn btn-sm ${activeTaskTab === tab ? "btn-primary" : "btn-ghost"}" data-task-tab="${tab}" type="button">
              ${tab === "ALL" ? "All Operational Tasks" : tab === "PENDING" ? "Pending Action" : "Completed"}
            </button>`
          ).join("")}
        </div>
      </div>

      <!-- Tasks Table -->
      <div class="card" style="padding:24px;">
        <div class="card-head" style="margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink);">Shift Task Queue (${tasks.length})</h2>
          <p style="font-size:13px;color:var(--muted);margin:0;">Assigned checklists and verification workflows.</p>
        </div>

        <div class="table-wrap">
          <table class="table" style="width:100%;">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Task Description</th>
                <th>Assigned Staff</th>
                <th>Branch</th>
                <th>Due Target</th>
                <th>Priority</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                tasks.length
                  ? tasks
                      .map((t) => {
                        const prioClass = t.priority === "HIGH" ? "danger" : "info";
                        const isDone = t.status === "COMPLETED";
                        return `
                  <tr>
                    <td style="font-family:var(--font-mono);font-weight:600;color:var(--bronze-600);">${t.taskId}</td>
                    <td><strong style="color:var(--ink);">${t.title}</strong></td>
                    <td style="color:var(--ink);">${t.assignedTo}</td>
                    <td><span class="status info" style="font-family:var(--font-mono);font-size:11px;">${t.cafeId}</span></td>
                    <td style="font-family:var(--font-mono);font-size:12.5px;color:var(--muted);">${t.dueDate}</td>
                    <td><span class="status ${prioClass}">${t.priority}</span></td>
                    <td><span class="status ${isDone ? "success" : "warning"}">${t.status}</span></td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:6px;">
                        ${
                          !isDone
                            ? `<button class="btn btn-sm btn-primary" data-complete-task="${t.taskId}" type="button">Mark Done</button>`
                            : `<span style="font-size:12px;color:var(--muted);font-style:italic;">Verified</span>`
                        }
                      </div>
                    </td>
                  </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">No tasks found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function wireTasks(root) {
  // Tabs
  root.querySelectorAll("[data-task-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTaskTab = btn.dataset.taskTab;
      refreshTasksView(root);
    });
  });

  // Refresh
  const refreshBtn = root.querySelector("#refresh-tasks-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchTasksFromServer(root));
  }

  // Add Task Modal
  const addBtn = root.querySelector("#add-task-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      openModal({
        title: "Assign New Operational Task",
        maxWidth: "600px",
        body: `
          <form id="new-task-form" class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
            <div class="field" style="grid-column:1/-1;">
              <label class="label">Task Title / Checklist Item *</label>
              <input type="text" id="new-tsk-title" class="input" placeholder="e.g. End of Day Sanitization & Grinder Burr Cleaning" required />
            </div>
            <div class="field">
              <label class="label">Assign To Employee *</label>
              <input type="text" id="new-tsk-assign" class="input" placeholder="e.g. Priya Nair (Barista)" required />
            </div>
            <div class="field">
              <label class="label">Café Branch *</label>
              <select id="new-tsk-cafe" class="select" required>
                <option value="ZC-0001">ZC-0001 · Koramangala Main</option>
                <option value="ZC-0002">ZC-0002 · Indiranagar Central</option>
                <option value="ZC-0003">ZC-0003 · Calicut Beach</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Priority</label>
              <select id="new-tsk-prio" class="select">
                <option value="NORMAL">Normal Priority</option>
                <option value="HIGH">High (Urgent Attention)</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Due Date &amp; Shift</label>
              <input type="text" id="new-tsk-due" class="input" placeholder="e.g. Today, 10:00 PM" value="Today, End of Shift" />
            </div>
          </form>
        `,
        saveLabel: "Assign Task",
        onSave: async (modalEl) => {
          const title = modalEl.querySelector("#new-tsk-title")?.value?.trim();
          const assignedTo = modalEl.querySelector("#new-tsk-assign")?.value?.trim();
          const cafeId = modalEl.querySelector("#new-tsk-cafe")?.value;
          const priority = modalEl.querySelector("#new-tsk-prio")?.value;
          const dueDate = modalEl.querySelector("#new-tsk-due")?.value?.trim();

          if (!title || !assignedTo) {
            showToast("Task title and assignee are required", "coral");
            return false;
          }

          if (!liveTasks) liveTasks = [...SAMPLE_TASKS];
          liveTasks.unshift({
            taskId: `TSK-00${liveTasks.length + 1}`,
            title,
            assignedTo,
            cafeId,
            dueDate,
            priority,
            status: "PENDING",
            type: "GENERAL_OPERATION",
          });
          showToast("Task assigned to staff!", "mint");
          refreshTasksView(root);
        },
      });
    });
  }

  // Mark Done Action
  root.querySelectorAll("[data-complete-task]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const taskId = btn.dataset.completeTask;
      const task = (liveTasks || SAMPLE_TASKS).find((t) => t.taskId === taskId);
      if (!task) return;

      task.status = "COMPLETED";
      showToast(`Task ${taskId} marked as completed!`, "mint");
      refreshTasksView(root);
    });
  });
}

async function fetchTasksFromServer(root) {
  try {
    const res = await apiGet("/approvals?status=PENDING");
    if (res?.data?.approvals) {
      liveTasks = res.data.approvals.map((a) => ({
        taskId: a.approvalId || a.id,
        title: a.title || a.description,
        assignedTo: a.requestedBy || "Staff",
        cafeId: a.cafeId || "ZC-0001",
        dueDate: "Pending Review",
        priority: "NORMAL",
        status: a.status || "PENDING",
        type: a.entityType || "APPROVAL",
      }));
      showToast(`Loaded ${liveTasks.length} tasks`, "mint");
    }
  } catch {
    showToast("Loaded task queue", "amber");
  }
  refreshTasksView(root);
}

function refreshTasksView(root) {
  const content = root.querySelector(".page-enter") || root;
  content.innerHTML = renderTasks();
  wireTasks(root);
}
