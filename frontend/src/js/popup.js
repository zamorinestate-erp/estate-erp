// =============================================================================
// ZAMORIN CAFE ERP — GLASS-FROST ACTION POPUP (ActionNotificationModal)
//
// Centred, high-priority popup for events that need immediate awareness or
// action (approvals, critical variances, results). Low-priority events never
// come through here — they go to the toast + Notification Centre only. Per
// the spec: never show more than one centred popup at a time — this module
// owns a queue and shows "1 of N" when several are waiting.
// =============================================================================
import { markRead, markDelivered } from "./notifications.js";
import { navigate } from "./router.js";

let queue = [];
let showing = false;

export function enqueuePopup(notification) {
  queue.push(notification);
  markDelivered(notification.id);
  if (!showing) renderNext();
}

function severityAccent(sev) {
  if (sev === "critical" || sev === "high") return "pill-coral";
  if (sev === "warning") return "pill-amber";
  return "pill-mint";
}

function renderNext() {
  if (queue.length === 0) {
    showing = false;
    return;
  }
  showing = true;
  const n = queue.shift();
  const remaining = queue.length;

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  overlay.innerHTML = `
    <div class="glass-dark dialog-box" style="width:480px; max-width:calc(100vw - 40px);">
      ${remaining > 0 ? `<div class="muted-white" style="font-size:11px; margin-bottom:10px;">1 of ${remaining + 1}</div>` : ""}
      <div class="pill ${severityAccent(n.severity)}" style="margin-bottom:12px;">${n.category}</div>
      <h3>${n.title}</h3>
      <p>${n.message}</p>
      <div class="dialog-actions">
        <button class="btn btn-ghost" data-act="dismiss">Dismiss</button>
        ${n.actionRequired ? `<button class="btn btn-primary" data-act="review">Review</button>` : `<button class="btn btn-primary" data-act="ack">Acknowledge</button>`}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    markRead(n.id);
    overlay.remove();
    renderNext();
  };

  overlay.querySelector('[data-act="dismiss"]')?.addEventListener("click", close);
  overlay.querySelector('[data-act="ack"]')?.addEventListener("click", close);
  overlay.querySelector('[data-act="review"]')?.addEventListener("click", () => {
    markRead(n.id);
    overlay.remove();
    navigate(n.deepLink);
    renderNext();
  });
}
