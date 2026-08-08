// PAGE: My Loans & Advances — authenticated employee self-service.
import {ApiClientError,apiGet} from "../apiClient.js";
import {emptyState,skeleton} from "../components.js";

let activeRequest=null;
const money=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2});
const dateTime=new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"});

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function amount(v){return Number.isSafeInteger(v)?money.format(v/100):"—";}
function when(v){const d=new Date(v);return Number.isNaN(d.getTime())?"—":dateTime.format(d);}
function type(v){return v==="SALARY_ADVANCE"?"Salary advance":"Loan";}
function pill(v){v=String(v||"REQUESTED").toUpperCase();const k=v==="APPROVED"?"mint":v==="REJECTED"?"dark":"amber";return `<span class="pill pill-${k}">${esc(v)}</span>`;}
function loading(){return `<div class="flex-col gap-md" aria-live="polite">${skeleton("92px")}${skeleton("92px")}${skeleton("92px")}</div>`;}
function failure(e){const m=e instanceof ApiClientError?e.message:"Your loan and advance records could not be loaded.";const r=e instanceof ApiClientError&&e.correlationId?`<div class="muted-white" style="font-size:11px;margin-top:8px;">Reference: ${esc(e.correlationId)}</div>`:"";return `<div class="empty-state" role="alert"><div class="empty-state-title">Unable to load loans & advances</div><div style="font-size:13px;max-width:440px;">${esc(m)}</div>${r}<button class="btn btn-primary" type="button" data-retry-loans style="margin-top:14px;">Try again</button></div>`;}
function cards(rows){if(!rows.length)return emptyState({title:"No loan or advance records",body:"Your authenticated employee account has no loan or salary advance records to display."});return `<div class="flex-col gap-md">${rows.map(r=>`<article class="glass" style="padding:16px;"><div class="flex justify-between items-start" style="gap:14px;flex-wrap:wrap;"><div><div style="color:#fff;font-weight:700;font-size:14px;">${esc(type(r.requestType))}</div><div class="muted-white" style="font-size:11.5px;margin-top:3px;">${esc(r.loanAdvanceId)} · Requested ${esc(when(r.requestedAt))}</div></div>${pill(r.status)}</div><div style="color:#fff;font-size:15px;margin-top:12px;">Requested amount: <strong>${esc(amount(r.requestedAmountPaise))}</strong></div>${r.requestReason?`<div class="muted-white" style="font-size:12px;margin-top:8px;">${esc(r.requestReason)}</div>`:""}</article>`).join("")}</div>`;}

async function load(root){
  activeRequest?.abort();
  const controller=new AbortController();
  activeRequest=controller;
  const content=root.querySelector("[data-loans-advances-content]");
  if(!content)return;
  content.innerHTML=loading();
  try{
    const payload=await apiGet("/loan-advances/me?limit=24",{signal:controller.signal});
    const rows=payload?.data?.loanAdvances;
    if(!Array.isArray(rows))throw new Error("The loans and advances response was incomplete.");
    if(controller.signal.aborted||!root.isConnected)return;
    content.innerHTML=cards(rows);
  }catch(e){
    if(e?.name==="AbortError"||!root.isConnected)return;
    content.innerHTML=failure(e);
    content.querySelector("[data-retry-loans]")?.addEventListener("click",()=>load(root));
  }finally{if(activeRequest===controller)activeRequest=null;}
}

export function renderStaffLoansAdvances(){return `<div class="page-enter" style="padding:8px 4px;"><div class="flex justify-between items-center" style="gap:12px;margin-bottom:18px;flex-wrap:wrap;"><div><div class="font-display" style="color:#fff;font-weight:700;font-size:17px;">My Loans & Advances</div><div class="muted-white" style="font-size:11.5px;margin-top:3px;">Only records linked to your authenticated employee account are shown.</div></div><button class="btn btn-ghost" type="button" data-refresh-loans style="padding:8px 14px;font-size:12px;">Refresh</button></div><div data-loans-advances-content>${loading()}</div></div>`;}
export function wireStaffLoansAdvances(root){root.querySelector("[data-refresh-loans]")?.addEventListener("click",()=>load(root));load(root);}
