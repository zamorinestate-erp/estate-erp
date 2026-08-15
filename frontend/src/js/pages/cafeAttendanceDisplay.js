'use strict';

/**
 * Dedicated Safe Kiosk Attendance Display Mode for Cafe-Owned Hardware.
 *
 * PRIVACY & SECURITY INVARIANT:
 * This display renders ONLY the cafe name, current IST date/time, rotating QR code,
 * 6-digit fallback PIN, countdown timer, and connectivity status.
 *
 * It NEVER exposes employee rosters, payroll/salary, cashbook balances, POS history,
 * inventory stock, vendor contacts, or administrative secrets.
 */

class CafeAttendanceDisplayPage {
  constructor() {
    this.cafeId = null;
    this.cafeName = 'Flagship Beach Road Cafe';
    this.deviceId = null;
    this.activeChallenge = null;
    this.rotationTimer = null;
    this.countdownSeconds = 20;
  }

  async init(containerElement, deviceContext) {
    this.container = containerElement;
    this.deviceId = deviceContext.deviceId;
    this.cafeId = deviceContext.boundCafeId || 'ZC-0001';

    this.render();
    await this.fetchNewChallenge();
    this.startRotationTimer();
  }

  render() {
    this.container.innerHTML = `
      <div class="kiosk-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#0f172a; color:#f8fafc; font-family:sans-serif; text-align:center; padding:2rem;">
        <header style="margin-bottom:2rem;">
          <h1 style="font-size:2rem; margin:0 0 0.5rem 0; color:#38bdf8;" id="kiosk-cafe-name">${this.cafeName}</h1>
          <p style="margin:0; font-size:1.1rem; color:#94a3b8;" id="kiosk-clock">Loading IST Clock...</p>
          <div style="display:inline-block; margin-top:0.5rem; padding:0.25rem 0.75rem; border-radius:9999px; background:#065f46; color:#34d399; font-size:0.85rem; font-weight:600;">
            ● DEVICE BOUND: ${this.cafeId} (${this.deviceId || 'ACTIVE_KIOSK'})
          </div>
        </header>

        <main style="background:#1e293b; border-radius:1rem; padding:2.5rem; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border:1px solid #334155; max-width:480px; width:100%;">
          <div id="qr-code-wrapper" style="background:#ffffff; padding:1.5rem; border-radius:0.75rem; display:inline-block; margin-bottom:1.5rem;" aria-label="QR code for staff attendance">
            <div id="qr-placeholder" style="width:240px; height:240px; display:flex; align-items:center; justify-content:center; color:#0f172a; font-weight:bold;">
              [ ROTATING QR CODE ]
            </div>
          </div>

          <div style="margin-bottom:1.5rem;">
            <p style="margin:0 0 0.5rem 0; font-size:0.95rem; color:#cbd5e1;">Scan with your personal Zamorin App</p>
            <div style="font-size:1.25rem; font-weight:700; color:#fbbf24;">
              Fallback PIN: <span id="kiosk-fallback-pin">------</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:#64748b; border-top:1px solid #334155; padding-top:1rem;">
            <span>Auto-rotates in: <strong id="kiosk-countdown" style="color:#38bdf8;">20s</strong></span>
            <span id="kiosk-network-status" style="color:#22c55e;">Online (Atlas Synced)</span>
          </div>
        </main>

        <footer style="margin-top:2.5rem;">
          <button id="btn-admin-unlock" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:0.5rem 1.25rem; border-radius:0.5rem; cursor:pointer; font-size:0.85rem;" onclick="window.location.hash='#/login'">
            🔒 Manager Login
          </button>
        </footer>
      </div>
    `;

    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
  }

  updateClock() {
    const clockEl = document.getElementById('kiosk-clock');
    if (clockEl) {
      clockEl.textContent = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(new Date());
    }
  }

  async fetchNewChallenge() {
    try {
      const pinEl = document.getElementById('kiosk-fallback-pin');
      const mockPin = Math.floor(100000 + Math.random() * 900000).toString();
      if (pinEl) pinEl.textContent = mockPin;
      this.countdownSeconds = 20;
    } catch (err) {
      console.error('Failed to fetch new QR challenge:', err);
    }
  }

  startRotationTimer() {
    this.rotationTimer = setInterval(() => {
      this.countdownSeconds -= 1;
      const countEl = document.getElementById('kiosk-countdown');
      if (countEl) countEl.textContent = `${this.countdownSeconds}s`;

      if (this.countdownSeconds <= 0) {
        this.fetchNewChallenge();
      }
    }, 1000);
  }

  destroy() {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CafeAttendanceDisplayPage };
}
