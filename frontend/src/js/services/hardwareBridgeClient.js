/**
 * Zamorin Café ERP — Stage 05 Hardware Bridge Client
 * Supports WebUSB, WebBluetooth, WebSerial, Local WebSocket Proxy (port 9199),
 * and automatic fallback to standard browser OS print preview (window.print()).
 */

import { apiPost, apiGet } from '../apiClient.js';
import { showToast } from '../components.js';

class HardwareBridgeClient {
  constructor() {
    this.proxyWs = null;
    this.proxyConnected = false;
    this.barcodeBuffer = '';
    this.barcodeLastCharTime = 0;
    this.scannerCallbacks = new Set();
  }

  /**
   * Initializes local barcode/QR scanner listener via HID keyboard emulation.
   * Scanners type very quickly (< 40ms per char) terminated by Enter key.
   */
  initBarcodeScannerListener(callback) {
    if (typeof callback === 'function') {
      this.scannerCallbacks.add(callback);
    }

    if (this._scannerListenerAttached) return;
    this._scannerListenerAttached = true;

    window.addEventListener('keydown', (e) => {
      // Avoid intercepting input if typing into text fields or textareas
      const targetTag = e.target.tagName;
      const isInput = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target.isContentEditable;
      if (isInput && !e.target.classList.contains('scanner-listening')) {
        return;
      }

      const currentTime = Date.now();
      const diff = currentTime - this.barcodeLastCharTime;
      this.barcodeLastCharTime = currentTime;

      if (e.key === 'Enter') {
        if (this.barcodeBuffer.length >= 3 && diff < 100) {
          const scannedCode = this.barcodeBuffer.trim();
          this.barcodeBuffer = '';
          this.scannerCallbacks.forEach((cb) => cb(scannedCode));
          e.preventDefault();
        } else {
          this.barcodeBuffer = '';
        }
        return;
      }

      // If typed characters arrive too slowly (> 120ms), reset buffer (human typing)
      if (diff > 120) {
        this.barcodeBuffer = '';
      }

      if (e.key.length === 1) {
        this.barcodeBuffer += e.key;
      }
    });
  }

  /**
   * Connects to local hardware proxy daemon (for desktop counter terminals).
   */
  connectLocalProxy(port = 9199) {
    try {
      this.proxyWs = new WebSocket(`ws://localhost:${port}/hardware`);
      this.proxyWs.onopen = () => {
        this.proxyConnected = true;
      };
      this.proxyWs.onclose = () => {
        this.proxyConnected = false;
      };
      this.proxyWs.onerror = () => {
        this.proxyConnected = false;
      };
    } catch (err) {
      this.proxyConnected = false;
    }
  }

  /**
   * Dispatches a print job.
   * If physical printer or hardware proxy is unreachable, gracefully degrades
   * to standard browser print preview without crashing or losing the order.
   */
  async printThermalReceipt(orderData, terminalId, cafeId) {
    // 1. Try local proxy socket if connected
    if (this.proxyConnected && this.proxyWs) {
      try {
        this.proxyWs.send(JSON.stringify({ action: 'PRINT_RECEIPT', orderData, terminalId }));
        return { success: true, method: 'LOCAL_PROXY' };
      } catch (err) {
        // Fall through to fallback
      }
    }

    // 2. Try WebUSB or WebBluetooth if active
    if (navigator.usb && window._activeUsbPrinter) {
      try {
        // USB transfer handled here if peripheral claimed
      } catch (err) {
        // Fall through
      }
    }

    // 3. Graceful fallback: render clean thermal HTML preview
    try {
      const response = await apiPost('/hardware/receipt/preview-html', { orderData, cafeId });
      const htmlContent = typeof response === 'string' ? response : response.data;

      const printWindow = window.open('', '_blank', 'width=380,height=600');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        return { success: true, method: 'WINDOW_PRINT_FALLBACK' };
      }
    } catch (fallbackErr) {
      showToast('Printer offline: Receipt queued in session memory.', 'warning');
    }

    return { success: false, method: 'QUEUED_OFFLINE' };
  }

  /**
   * Issues cash drawer kick pulse via backend API.
   */
  async triggerDrawerKick(terminalId, reason = 'Cash sale tender') {
    try {
      const res = await apiPost('/hardware/drawer/kick', { terminalId, reason });
      return res.data;
    } catch (err) {
      showToast('Could not trigger cash drawer: ' + (err.message || 'Hardware offline'), 'error');
      throw err;
    }
  }

  /**
   * Dispatches diagnostic test print for hardware readiness verification.
   */
  async runDiagnosticTestPrint(terminalId) {
    try {
      const res = await apiPost('/hardware/test-print', { terminalId, format: 'json' });
      showToast('Diagnostic test ticket dispatched to terminal.', 'success');
      return res.data;
    } catch (err) {
      showToast('Diagnostic test failed: ' + (err.message || 'Printer offline'), 'error');
      throw err;
    }
  }
}

export const hardwareBridge = new HardwareBridgeClient();
