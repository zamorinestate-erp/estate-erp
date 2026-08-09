// PAGE: My Profile — authenticated employee self-service.
import { ApiClientError, apiGet } from "../apiClient.js";
import { skeleton } from "../components.js";

let activeRequest = null;
const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const show = (v) => v === null || v === undefined || v === "" ? "—" : esc(v);
const list = (v) => Array.isArray(v) && v.length ? v.map(esc).join(", ") : "—";
const row = (label, value) => `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)"><div class="muted-white" style="font-size:10.5px">${esc(label)}</div><div style="color:#fff;font-size:13px;margin-top:2px">${value}</div></div>`;
const loading = () => `<div class="flex-col gap-md">${skeleton("100px")}${skeleton("170px")}${skeleton("120px")}</div>`;

function view(p) {
  const i=p.identity||{}, e=p.employment||{}, c=p.contact||{}, a=p.availability||{};
  return `<div class="flex-col gap-md">
    <div class="glass" style="padding:20px"><div style="color:#fff;font-size:20px;font-weight:700">${show(i.preferredName||i.name)}</div><div class="muted-white" style="font-size:12px;margin-top:4px">${show(i.userId)} · ${show(i.role)} · ${show(i.accountStatus)}</div></div>
    <div class="glass" style="padding:20px"><div style="color:#fff;font-weight:700">Employment</div>${row("Legal name",show(i.name))}${row("Employment type",show(e.employmentType))}${row("Department",show(e.department))}${row("Designation",show(e.designation))}${row("Primary cafe",show(e.primaryCafeId))}${row("Assigned cafes",list(e.assignedCafeIds))}</div>
    <div class="glass" style="padding:20px"><div style="color:#fff;font-weight:700">Contact</div>${row("Email",show(c.email))}${row("Phone",show(c.phone))}</div>
    <div class="glass" style="padding:20px"><div style="color:#fff;font-weight:700">Integrated services</div>${Object.entries(a).map(([k,v])=>row(k.replace(/([A-Z])/g," $1"),show(v))).join("")}</div>
  </div>`;
}

function failure(e) {
  const message=e instanceof ApiClientError?e.message:"Your employee profile could not be loaded.";
  return `<div class="empty-state" role="alert"><div class="empty-state-title">Unable to load profile</div><div style="font-size:13px">${esc(message)}</div><button class="btn btn-primary" type="button" data-retry-profile style="margin-top:14px">Try again</button></div>`;
}

async function load(root) {
  activeRequest?.abort();
  const controller=new AbortController();
  activeRequest=controller;
  const host=root.querySelector("[data-profile-content]");
  if(!host)return;
  host.innerHTML=loading();
  try {
    const payload=await apiGet("/employees/me",{signal:controller.signal});
    const profile=payload?.data?.profile;
    if(!profile?.identity)throw new Error("The employee profile response was incomplete.");
    if(controller.signal.aborted||!root.isConnected)return;
    host.innerHTML=view(profile);
  } catch(e) {
    if(e?.name==="AbortError"||!root.isConnected)return;
    host.innerHTML=failure(e);
    host.querySelector("[data-retry-profile]")?.addEventListener("click",()=>load(root));
  } finally {
    if(activeRequest===controller)activeRequest=null;
  }
}

export function renderEmployeeProfile() {
  return `<div class="page-enter"><div class="flex justify-between items-center" style="gap:12px;margin-bottom:18px;flex-wrap:wrap"><div><div class="font-display" style="color:#fff;font-size:22px;font-weight:700">My Profile</div><div class="muted-white" style="font-size:12px;margin-top:3px">Authoritative employee information from your authenticated account.</div></div><button class="btn btn-ghost" type="button" data-refresh-profile>Refresh</button></div><div data-profile-content>${loading()}</div></div>`;
}
export function wireEmployeeProfile(root) {
  root.querySelector("[data-refresh-profile]")?.addEventListener("click",()=>load(root));
  load(root);
}
