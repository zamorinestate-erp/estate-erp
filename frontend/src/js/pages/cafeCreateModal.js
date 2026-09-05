// =============================================================================
// ZAMORIN CAFÉ ERP — CREATE / ADD NEW CAFÉ SHARED WIZARD & SUCCESS SCREEN
// Supported Roles: Primary Master, Normal Master, Owner
// Design System: Ledger & Roastery Dark / Porcelain Light Theme
// =============================================================================

'use strict';

import { apiPost } from '../apiClient.js';
import { showToast } from '../components.js';
import { icon } from '../icons.js';
import { openCafeAccessManagementModal } from './cafeAccessManagementModal.js';
import { openQrViewerModal, downloadQrSvg, printQrCard } from '../utils/qrCodeGen.js';

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Mounts and opens the canonical Create Café Wizard Modal.
 *
 * @param {HTMLElement} [mountParent=document.body] Container element
 * @param {Object} [opts={}]
 * @param {Function} [opts.onSuccess] Callback when a café is created
 */
export function openCafeCreateModal(mountParent = document.body, opts = {}) {
  let modalMount = document.getElementById('zamorin-cafe-create-modal-mount');
  if (!modalMount) {
    modalMount = document.createElement('div');
    modalMount.id = 'zamorin-cafe-create-modal-mount';
    (mountParent || document.body).appendChild(modalMount);
  }

  renderWizardForm(modalMount, opts);
}

function renderWizardForm(container, opts) {
  container.innerHTML = `
    <div class="modal-backdrop" id="cafe-create-backdrop" style="position:fixed;inset:0;background:rgba(18,17,16,0.78);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);">
      <div class="modal-card card" style="width:840px;max-width:96vw;max-height:90vh;overflow-y:auto;padding:28px;background:var(--surface-raised, #242220);border:1px solid var(--line-strong, #3d3935);box-shadow:var(--shadow-xl);border-radius:var(--radius-lg, 12px);">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:1px solid var(--line, #33302c);padding-bottom:14px;">
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--bronze-500, #b17d38);text-transform:uppercase;margin-bottom:4px;">
              <span>☕</span> CAFÉ PORTFOLIO GOVERNANCE
            </div>
            <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:var(--ink, #ede8e1);">+ Add New Café Location</h2>
            <p style="margin:0;font-size:12.5px;color:var(--muted, #9e978e);">
              Provision an authoritative café branch, automatic Permanent 6-digit PIN, dedicated QR, and Café Operations access.
            </p>
          </div>
          <button class="btn btn-xs btn-ghost" id="cafe-create-close-x-btn" type="button" style="font-size:16px;line-height:1;padding:4px 8px;cursor:pointer;">✕</button>
        </div>

        <!-- Alert Error Banner -->
        <div id="cafe-create-error-banner" style="display:none;margin-bottom:16px;padding:12px 14px;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.3);border-radius:8px;color:#ef4444;font-size:13px;" role="alert"></div>

        <!-- Create Cafe Form -->
        <form id="zamorin-cafe-create-form" autocomplete="off">

          <!-- Section A: Identity -->
          <div style="margin-bottom:22px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:var(--bronze-400, #c89650);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
              <span>1.</span> CAFÉ IDENTITY &amp; OUTLET CLASSIFICATION
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Café Name *</label>
                <input type="text" id="cafe-f-name" class="form-control" placeholder="e.g. Kozhikode Roastery Flagship" required style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Display Name / Branch *</label>
                <input type="text" id="cafe-f-display" class="form-control" placeholder="e.g. Beach Road Branch" required style="width:100%;" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Outlet Type</label>
                <select id="cafe-f-type" class="form-control" style="width:100%;">
                  <option value="STANDARD_CAFE">Standard Café</option>
                  <option value="KIOSK">Kiosk / Express Bar</option>
                  <option value="CAMPUS_CAFE">Campus / Institutional Café</option>
                  <option value="FOOD_COURT">Food Court Counter</option>
                  <option value="OTHER">Other Outlet Format</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Initial Operating Status</label>
                <select id="cafe-f-status" class="form-control" style="width:100%;">
                  <option value="DRAFT">DRAFT (Design / Setup)</option>
                  <option value="PENDING_OPENING">PENDING OPENING (Ready for Launch)</option>
                  <option value="ACTIVE" selected>ACTIVE (Operating Live)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Opening / Effective Date</label>
                <input type="date" id="cafe-f-opening-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" style="width:100%;" />
              </div>
            </div>
          </div>

          <!-- Section B: Location -->
          <div style="margin-bottom:22px;border-top:1px solid var(--line, #33302c);padding-top:16px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:var(--bronze-400, #c89650);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
              <span>2.</span> PHYSICAL LOCATION &amp; REGISTRATION JURISDICTION
            </div>
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Address Line 1 *</label>
                <input type="text" id="cafe-f-addr1" class="form-control" placeholder="Street address, building, premises" required style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Landmark</label>
                <input type="text" id="cafe-f-landmark" class="form-control" placeholder="Opposite / Near landmark" style="width:100%;" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;">
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">City *</label>
                <input type="text" id="cafe-f-city" class="form-control" placeholder="e.g. Kozhikode" required style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">District</label>
                <input type="text" id="cafe-f-district" class="form-control" placeholder="e.g. Kozhikode" style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">State *</label>
                <input type="text" id="cafe-f-state" class="form-control" placeholder="e.g. Kerala" value="Kerala" required style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">PIN Code</label>
                <input type="text" id="cafe-f-pincode" class="form-control" placeholder="673001" maxlength="6" style="width:100%;" />
              </div>
            </div>
          </div>

          <!-- Section C: Contact & Operations -->
          <div style="margin-bottom:22px;border-top:1px solid var(--line, #33302c);padding-top:16px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:var(--bronze-400, #c89650);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
              <span>3.</span> OPERATIONAL CONTACT &amp; TRADING SCHEDULE
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:12px;">
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Operational Phone *</label>
                <input type="text" id="cafe-f-phone" class="form-control" placeholder="+91 98450 00000" required style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Café Email</label>
                <input type="email" id="cafe-f-email" class="form-control" placeholder="calicut.beach@zamorin.cafe" style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Branch Manager / Contact</label>
                <input type="text" id="cafe-f-manager" class="form-control" placeholder="e.g. Rahul K" style="width:100%;" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Opening Time</label>
                <input type="time" id="cafe-f-opening-time" class="form-control" value="07:00" style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">Closing Time</label>
                <input type="time" id="cafe-f-closing-time" class="form-control" value="23:00" style="width:100%;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:12px;font-weight:700;display:block;margin-bottom:4px;color:var(--ink);">GSTIN / Tax ID (Optional)</label>
                <input type="text" id="cafe-f-gstin" class="form-control" placeholder="32AAAAA0000A1Z5" style="width:100%;text-transform:uppercase;" />
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line, #33302c);padding-top:16px;margin-top:10px;">
            <div style="font-size:11.5px;color:var(--muted);">
              🔒 Automatic Permanent PIN, QR credential, and Login Link are created immediately.
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-sm btn-ghost" id="cafe-create-cancel-btn" type="button" style="cursor:pointer;">Cancel</button>
              <button class="btn btn-sm btn-primary" id="cafe-create-submit-btn" type="submit" style="font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;">
                <span>+ Confirm &amp; Create Café</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  `;

  const closeWizard = () => {
    container.innerHTML = '';
  };

  container.querySelector('#cafe-create-close-x-btn')?.addEventListener('click', closeWizard);
  container.querySelector('#cafe-create-cancel-btn')?.addEventListener('click', closeWizard);

  const form = container.querySelector('#zamorin-cafe-create-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = container.querySelector('#cafe-create-submit-btn');
    const errBanner = container.querySelector('#cafe-create-error-banner');
    if (errBanner) errBanner.style.display = 'none';

    // Gather and normalize fields
    const name = container.querySelector('#cafe-f-name')?.value?.trim();
    const displayName = container.querySelector('#cafe-f-display')?.value?.trim() || name;
    const cafeType = container.querySelector('#cafe-f-type')?.value;
    const status = container.querySelector('#cafe-f-status')?.value;
    const openingDate = container.querySelector('#cafe-f-opening-date')?.value;
    const address = container.querySelector('#cafe-f-addr1')?.value?.trim();
    const landmark = container.querySelector('#cafe-f-landmark')?.value?.trim();
    const city = container.querySelector('#cafe-f-city')?.value?.trim();
    const district = container.querySelector('#cafe-f-district')?.value?.trim();
    const state = container.querySelector('#cafe-f-state')?.value?.trim();
    const pincode = container.querySelector('#cafe-f-pincode')?.value?.trim();
    const phone = container.querySelector('#cafe-f-phone')?.value?.trim();
    const email = container.querySelector('#cafe-f-email')?.value?.trim();
    const managerName = container.querySelector('#cafe-f-manager')?.value?.trim();
    const openingTime = container.querySelector('#cafe-f-opening-time')?.value;
    const closingTime = container.querySelector('#cafe-f-closing-time')?.value;
    const gstin = container.querySelector('#cafe-f-gstin')?.value?.trim();

    if (!name) {
      if (errBanner) {
        errBanner.textContent = 'Please enter a valid Café Name.';
        errBanner.style.display = 'block';
      }
      return;
    }

    if (!city) {
      if (errBanner) {
        errBanner.textContent = 'Please enter the City location.';
        errBanner.style.display = 'block';
      }
      return;
    }

    // Disable button & show progress (Double-submit defense)
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;"></span>
        <span>Configuring Café Operations...</span>
      `;
    }

    try {
      const res = await apiPost('/cafes', {
        body: {
          name,
          displayName,
          cafeType,
          status,
          openingDate,
          address,
          landmark,
          city,
          district,
          state,
          pincode,
          phone,
          email,
          managerName,
          openingTime,
          closingTime,
          gstin,
        },
      });

      const cafe = res?.data?.cafe;
      const access = res?.data?.access;

      showToast(`Café "${name}" created and provisioned successfully!`, 'success');

      // Transition into Success Screen
      renderSuccessScreen(container, { cafe, access }, opts);
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>+ Confirm &amp; Create Café</span>`;
      }
      if (errBanner) {
        errBanner.textContent = err?.message || 'Failed to create café. Please check values and retry.';
        errBanner.style.display = 'block';
      }
    }
  });
}

function renderSuccessScreen(container, { cafe, access }, opts) {
  let pinRevealed = false;
  const pin = access?.permanentCafePin || '••••••';
  const cafeId = cafe?.cafeId || access?.cafeId || 'ZC-0000';
  const qrUrl = access?.qrUrl || '';
  const linkUrl = access?.linkUrl || '';

  container.innerHTML = `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(18,17,16,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);">
      <div class="modal-card card" style="width:780px;max-width:96vw;max-height:92vh;overflow-y:auto;padding:28px;background:var(--surface-raised, #242220);border:1px solid var(--bronze-500, #b17d38);box-shadow:var(--shadow-2xl);border-radius:var(--radius-lg, 12px);">

        <!-- Header -->
        <div style="text-align:center;margin-bottom:24px;border-bottom:1px solid var(--line, #33302c);padding-bottom:18px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.3);border-radius:50%;color:#10b981;font-size:24px;margin-bottom:10px;">
            ✓
          </div>
          <h2 style="margin:0 0 6px;font-size:22px;font-weight:800;color:var(--ink, #ede8e1);">Café Created Successfully</h2>
          <div style="font-size:13.5px;color:var(--muted, #9e978e);display:flex;align-items:center;justify-content:center;gap:8px;">
            <strong style="color:var(--ink);">${escHtml(cafe?.name)}</strong>
            <span>·</span>
            <span style="font-family:var(--font-mono);font-weight:700;color:var(--bronze-500);">${escHtml(cafeId)}</span>
            <span>·</span>
            <span class="status success" style="font-size:10.5px;font-weight:700;">ACCESS READY</span>
          </div>
        </div>

        <!-- Credentials Grid -->
        <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:24px;">

          <!-- Card 1: Permanent 6-digit PIN -->
          <div style="background:var(--surface, #1b1a18);border:1px solid var(--line, #33302c);border-radius:10px;padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <div>
                <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--bronze-400);">
                  PERMANENT CAFÉ OPERATIONS PIN
                </div>
                <div style="font-size:11.5px;color:var(--muted);margin-top:2px;">
                  ⚠️ Permanent — cannot be modified or regenerated. Dedicated to this location.
                </div>
              </div>
              <span class="status success" style="font-size:10.5px;font-weight:700;">RESERVED</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface-sunken, #121110);border:1px solid var(--line-strong, #3d3935);border-radius:8px;padding:12px 18px;">
              <div id="succ-pin-display" style="font-family:var(--font-mono);font-size:26px;font-weight:800;letter-spacing:0.25em;color:var(--ink);">
                ••••••
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-xs btn-secondary" id="succ-reveal-pin-btn" type="button">Reveal</button>
                <button class="btn btn-xs btn-primary" id="succ-copy-pin-btn" type="button">Copy PIN</button>
              </div>
            </div>
          </div>

          <!-- Card 2: Dedicated QR Credential -->
          <div style="background:var(--surface, #1b1a18);border:1px solid var(--line, #33302c);border-radius:10px;padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <div>
                <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--bronze-400);">
                  DEDICATED CAFÉ OPERATIONS QR CODE
                </div>
                <div style="font-size:11.5px;color:var(--muted);margin-top:2px;">
                  High-entropy access credential. Resolves directly to the ${escHtml(cafe?.name)} gateway.
                </div>
              </div>
              <span class="status info" style="font-size:10.5px;font-weight:700;">QR v1 ACTIVE</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface-sunken, #121110);border:1px solid var(--line-strong, #3d3935);border-radius:8px;padding:12px 18px;gap:12px;flex-wrap:wrap;">
              <div style="font-family:var(--font-mono);font-size:11.5px;color:var(--muted);word-break:break-all;flex:1;">
                ${escHtml(qrUrl)}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-xs btn-primary" id="succ-view-qr-btn" type="button">View QR</button>
                <button class="btn btn-xs btn-secondary" id="succ-fs-qr-btn" type="button">Full Screen</button>
                <button class="btn btn-xs btn-secondary" id="succ-dl-qr-btn" type="button">Download</button>
                <button class="btn btn-xs btn-secondary" id="succ-print-qr-btn" type="button">Print Card</button>
                <button class="btn btn-xs btn-ghost" id="succ-copy-qr-btn" type="button">Copy URL</button>
              </div>
            </div>
          </div>

          <!-- Card 3: Dedicated Login Link -->
          <div style="background:var(--surface, #1b1a18);border:1px solid var(--line, #33302c);border-radius:10px;padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <div>
                <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--bronze-400);">
                  DEDICATED OPERATIONS LOGIN LINK
                </div>
                <div style="font-size:11.5px;color:var(--muted);margin-top:2px;">
                  Opaque browser link for desktop / register access without typing.
                </div>
              </div>
              <span class="status info" style="font-size:10.5px;font-weight:700;">LINK v1 ACTIVE</span>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface-sunken, #121110);border:1px solid var(--line-strong, #3d3935);border-radius:8px;padding:12px 18px;gap:12px;flex-wrap:wrap;">
              <div style="font-family:var(--font-mono);font-size:11.5px;color:var(--muted);word-break:break-all;flex:1;">
                ${escHtml(linkUrl)}
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-xs btn-secondary" id="succ-copy-link-btn" type="button">Copy Link</button>
                <a href="${escHtml(linkUrl)}" target="_blank" rel="noopener" class="btn btn-xs btn-ghost" style="text-decoration:none;">Open →</a>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer Navigation -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line, #33302c);padding-top:18px;flex-wrap:wrap;gap:10px;">
          <button class="btn btn-sm btn-ghost" id="succ-create-another-btn" type="button">
            + Create Another Café
          </button>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-sm btn-secondary" id="succ-view-access-btn" type="button">
              View Café Access →
            </button>
            <button class="btn btn-sm btn-primary" id="succ-done-btn" type="button" style="font-weight:700;">
              Done / Return to Cafés
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  // Permanent PIN reveal toggle
  const pinDisplay = container.querySelector('#succ-pin-display');
  const revealBtn = container.querySelector('#succ-reveal-pin-btn');
  revealBtn?.addEventListener('click', () => {
    pinRevealed = !pinRevealed;
    if (pinDisplay) {
      pinDisplay.textContent = pinRevealed ? pin : '••••••';
    }
    if (revealBtn) {
      revealBtn.textContent = pinRevealed ? 'Hide' : 'Reveal';
    }
  });

  // Copy PIN
  container.querySelector('#succ-copy-pin-btn')?.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pin);
      showToast('Permanent Café PIN copied to clipboard!', 'info');
    }
  });

  // View QR Modal
  container.querySelector('#succ-view-qr-btn')?.addEventListener('click', () => {
    openQrViewerModal({ cafeName: cafe?.name || 'Zamorin Café', cafeId, qrUrl, qrVersion: 1 });
  });

  // Full Screen QR
  container.querySelector('#succ-fs-qr-btn')?.addEventListener('click', () => {
    openQrViewerModal({ cafeName: cafe?.name || 'Zamorin Café', cafeId, qrUrl, qrVersion: 1, isFullScreen: true });
  });

  // Download QR SVG
  container.querySelector('#succ-dl-qr-btn')?.addEventListener('click', () => {
    downloadQrSvg(qrUrl, { filename: `ZAMORIN_${String(cafeId).replace(/[^A-Za-z0-9_-]/g, '')}_QR_V1.svg` });
  });

  // Print Card
  container.querySelector('#succ-print-qr-btn')?.addEventListener('click', () => {
    printQrCard({ cafeName: cafe?.name || 'Zamorin Café', cafeId, qrUrl, qrVersion: 1 });
  });

  // Copy QR URL
  container.querySelector('#succ-copy-qr-btn')?.addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(qrUrl);
      showToast('QR destination URL copied!', 'info');
    }
  });

  // Create Another
  container.querySelector('#succ-create-another-btn')?.addEventListener('click', () => {
    renderWizardForm(container, opts);
  });

  // View Access Modal
  container.querySelector('#succ-view-access-btn')?.addEventListener('click', () => {
    container.innerHTML = '';
    openCafeAccessManagementModal(document.body, cafeId);
    if (typeof opts?.onSuccess === 'function') {
      opts.onSuccess(cafe);
    }
  });

  // Done
  container.querySelector('#succ-done-btn')?.addEventListener('click', () => {
    container.innerHTML = '';
    if (typeof opts?.onSuccess === 'function') {
      opts.onSuccess(cafe);
    }
  });
}
