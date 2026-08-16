// =============================================================================
// PAGE: MailOps Command Centre — System & Operations Communication Hub
// GET   /api/v1/mailops/status  — High-level telemetry, queues, quota
// GET   /api/v1/mailops/outbox  — Outbound delivery queue
// GET   /api/v1/mailops/inbound — Inbound review queue & quarantine
// POST  /api/v1/mailops/outbox/:id/retry — Retry failed outbox item
// =============================================================================

import { apiGet, apiPost } from "../apiClient.js";
import { showToast } from "../components.js";

let _statusData = null;
let _outboxItems = [];
let _inboundItems = [];

export function renderMailOpsCommandCentre() {
  return `
    <div class="page-enter">
      <!-- Top Title Bar -->
      <div class="flex justify-between items-center" style="margin-bottom: 20px;">
        <div>
          <div style="color:#fff; font-size:22px; font-weight:700;" class="font-display">MailOps Command Centre</div>
          <div class="muted-white" style="font-size:13.5px;">
            Machine-connected Operations Nerve Centre &bull; <span style="color:#d4af37; font-weight:600;">zamorinestatepvtltd.erp@gmail.com</span>
          </div>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-ghost" id="refresh-mailops-btn">Refresh Telemetry</button>
        </div>
      </div>

      <!-- Provider Status & Quota Banner -->
      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px;">
        <div class="card glass" style="padding: 16px;">
          <div class="muted-white" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Provider Health</div>
          <div id="provider-health-val" style="font-size:20px; font-weight:700; color:#10b981; margin-top:4px;">Checking…</div>
          <div class="muted-white" style="font-size:12px; margin-top:2px;" id="provider-name-val">GMAIL_API (OAuth 2.0)</div>
        </div>

        <div class="card glass" style="padding: 16px;">
          <div class="muted-white" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Daily Quota Budget</div>
          <div id="quota-usage-val" style="font-size:20px; font-weight:700; color:#d4af37; margin-top:4px;">0 / 500 (0%)</div>
          <div class="muted-white" style="font-size:12px; margin-top:2px;" id="quota-status-val">Status: SAFE</div>
        </div>

        <div class="card glass" style="padding: 16px;">
          <div class="muted-white" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Outbound Outbox</div>
          <div id="outbound-counts-val" style="font-size:20px; font-weight:700; color:#38bdf8; margin-top:4px;">0 Queued &bull; 0 Failed</div>
          <div class="muted-white" style="font-size:12px; margin-top:2px;" id="outbound-sub-val">0 Retrying</div>
        </div>

        <div class="card glass" style="padding: 16px;">
          <div class="muted-white" style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Inbound Review & Quarantine</div>
          <div id="inbound-counts-val" style="font-size:20px; font-weight:700; color:#f59e0b; margin-top:4px;">0 Pending &bull; 0 Quarantined</div>
          <div class="muted-white" style="font-size:12px; margin-top:2px;" id="bec-count-val">0 BEC Flags</div>
        </div>
      </div>

      <!-- Action Queues & Telemetry Tables -->
      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Outbox Queue Card -->
        <div class="card glass" style="padding: 20px;">
          <div class="flex justify-between items-center" style="margin-bottom: 14px;">
            <div style="font-weight:700; font-size:16px; color:#fff;">Outbound Notification Outbox</div>
            <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8;" id="outbox-badge">0 items</span>
          </div>
          <div id="outbox-list-container" style="max-height: 380px; overflow-y: auto;">
            <div class="muted-white" style="text-align:center; padding: 24px;">Loading outbox…</div>
          </div>
        </div>

        <!-- Inbound Message Review Card -->
        <div class="card glass" style="padding: 20px;">
          <div class="flex justify-between items-center" style="margin-bottom: 14px;">
            <div style="font-weight:700; font-size:16px; color:#fff;">Inbound Review & Quarantine Queue</div>
            <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b;" id="inbound-badge">0 items</span>
          </div>
          <div id="inbound-list-container" style="max-height: 380px; overflow-y: auto;">
            <div class="muted-white" style="text-align:center; padding: 24px;">Loading inbound messages…</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function wireMailOpsCommandCentre(root) {
  await loadMailOpsData(root);

  root.querySelector("#refresh-mailops-btn")?.addEventListener("click", async () => {
    await loadMailOpsData(root);
    showToast("MailOps telemetry refreshed", "mint");
  });
}

async function loadMailOpsData(root) {
  try {
    const statusRes = await apiGet("/mailops/status");
    if (statusRes?.success) {
      _statusData = statusRes.data;
      updateStatusUI(root, _statusData);
    }
  } catch (err) {
    console.error("Failed to load MailOps status:", err);
  }

  try {
    const outboxRes = await apiGet("/mailops/outbox?limit=20");
    if (outboxRes?.success) {
      _outboxItems = outboxRes.data?.items || [];
      renderOutboxList(root, _outboxItems);
    }
  } catch (err) {
    console.error("Failed to load Outbox items:", err);
  }

  try {
    const inboundRes = await apiGet("/mailops/inbound?limit=20");
    if (inboundRes?.success) {
      _inboundItems = inboundRes.data?.items || [];
      renderInboundList(root, _inboundItems);
    }
  } catch (err) {
    console.error("Failed to load Inbound items:", err);
  }
}

function updateStatusUI(root, data) {
  const healthVal = root.querySelector("#provider-health-val");
  if (healthVal) {
    const healthy = data.providerHealth?.healthy;
    healthVal.textContent = healthy ? "HEALTHY" : (data.providerHealth?.status || "DEGRADED");
    healthVal.style.color = healthy ? "#10b981" : "#ef4444";
  }

  const quotaVal = root.querySelector("#quota-usage-val");
  const quotaStatusVal = root.querySelector("#quota-status-val");
  if (quotaVal && data.quota) {
    quotaVal.textContent = `${data.quota.sentToday} / ${data.quota.dailyLimit} (${data.quota.usagePercent}%)`;
    if (quotaStatusVal) quotaStatusVal.textContent = `Migration Status: ${data.quota.migrationStatus}`;
  }

  const outVal = root.querySelector("#outbound-counts-val");
  const outSub = root.querySelector("#outbound-sub-val");
  if (outVal && data.outbound) {
    outVal.textContent = `${data.outbound.queued} Queued • ${data.outbound.failed} Failed`;
    if (outSub) outSub.textContent = `${data.outbound.retrying} Retrying • ${data.outbound.draftsAwaitingReview} Drafts`;
  }

  const inVal = root.querySelector("#inbound-counts-val");
  const becVal = root.querySelector("#bec-count-val");
  if (inVal && data.inbound) {
    inVal.textContent = `${data.inbound.pending} Pending • ${data.inbound.quarantined} Quarantined`;
    if (becVal) becVal.textContent = `${data.inbound.becIncidents} High-Risk BEC Flags`;
  }
}

function renderOutboxList(root, items) {
  const container = root.querySelector("#outbox-list-container");
  const badge = root.querySelector("#outbox-badge");
  if (badge) badge.textContent = `${items.length} items`;
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="muted-white" style="text-align:center; padding: 24px;">Outbox queue is empty.</div>`;
    return;
  }

  container.innerHTML = items.map((item) => `
    <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight:600; color:#fff; font-size:13px;">${escapeHtml(item.subject)}</div>
        <div class="muted-white" style="font-size:11.5px; margin-top:2px;">
          To: ${escapeHtml(item.recipientEmail)} &bull; ${item.eventType} &bull; ${new Date(item.createdAt).toLocaleTimeString()}
        </div>
        ${item.lastErrorSafeMessage ? `<div style="color:#ef4444; font-size:11px; margin-top:2px;">${escapeHtml(item.lastErrorSafeMessage)}</div>` : ""}
      </div>
      <div style="text-align:right;">
        <span class="badge" style="font-size:10px; ${item.status === 'SENT' ? 'background:rgba(16,185,129,0.2); color:#10b981;' : (item.status === 'FAILED' ? 'background:rgba(239,68,68,0.2); color:#ef4444;' : 'background:rgba(56,189,248,0.2); color:#38bdf8;')}">
          ${item.status}
        </span>
        ${item.status === 'FAILED' || item.status === 'RETRY' ? `
          <button class="btn btn-ghost btn-sm retry-btn" data-outbox-id="${item.outboxId}" style="margin-top:4px; font-size:11px; padding:2px 8px;">Retry</button>
        ` : ""}
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".retry-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const outboxId = btn.dataset.outboxId;
      try {
        await apiPost(`/mailops/outbox/${outboxId}/retry`);
        showToast(`Retrying outbox ${outboxId}`, "mint");
        await loadMailOpsData(root);
      } catch {
        showToast(`Retry failed`, "amber");
      }
    });
  });
}

function renderInboundList(root, items) {
  const container = root.querySelector("#inbound-list-container");
  const badge = root.querySelector("#inbound-badge");
  if (badge) badge.textContent = `${items.length} items`;
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="muted-white" style="text-align:center; padding: 24px;">No inbound review items pending.</div>`;
    return;
  }

  container.innerHTML = items.map((item) => `
    <div style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <div class="flex justify-between items-center">
        <div style="font-weight:600; color:#fff; font-size:13px;">${escapeHtml(item.subject)}</div>
        <span class="badge" style="font-size:10px; ${item.riskScore === 'CRITICAL' ? 'background:rgba(239,68,68,0.2); color:#ef4444;' : 'background:rgba(245,158,11,0.2); color:#f59e0b;'}">
          ${item.classification} &bull; ${item.riskScore}
        </span>
      </div>
      <div class="muted-white" style="font-size:11.5px; margin-top:2px;">
        From: ${escapeHtml(item.senderEmail)} &bull; ${new Date(item.receivedAt).toLocaleTimeString()}
      </div>
      ${item.isBecSuspected ? `<div style="color:#ef4444; font-weight:bold; font-size:11px; margin-top:2px;">[BEC WARNING] ${escapeHtml(item.becReason || 'Suspicious payment modification attempt')}</div>` : ""}
      ${item.isQuarantined ? `<div style="color:#f59e0b; font-size:11px; margin-top:2px;">[QUARANTINED] ${escapeHtml(item.quarantineReason || 'Quarantined for review')}</div>` : ""}
    </div>
  `).join("");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
