'use strict';

/**
 * ZAMORIN CAFÉ ERP — UNIFIED CLIENT CAPABILITY CONTRACT
 *
 * Implements Section 23 & 24 cross-platform capability abstraction:
 * - One canonical interface for Web/PWA, Android, iOS/iPadOS, macOS, and Windows.
 * - Narrow, origin-gated typed message protocol: { requestId, action, payload } -> { requestId, success, result, errorCode }.
 * - Handshake-based capability detection avoiding brittle user-agent sniffing.
 */

export const PLATFORMS = {
  WEB: 'WEB',
  ANDROID: 'ANDROID',
  IOS: 'IOS',
  MACOS: 'MACOS',
  WINDOWS: 'WINDOWS',
};

export class NativeCapabilities {
  /**
   * Resolves the active native platform and supported device capabilities.
   */
  static getCapabilities() {
    if (typeof window === 'undefined') {
      return {
        platform: PLATFORMS.WEB,
        isNative: false,
        canSaveFile: false,
        canChooseDirectory: false,
        canPrint: false,
        canTakePhoto: false,
        canChoosePhoto: false,
        canChooseFile: false,
        canShare: false,
        canHandleDeepLinks: false,
      };
    }

    // Explicit runtime capability injection from native shells
    if (window.ZamorinNativeCapabilities) {
      return window.ZamorinNativeCapabilities;
    }

    // Windows WebView2 Host Object / WebMessage Bridge
    if (window.chrome && window.chrome.webview) {
      return {
        platform: PLATFORMS.WINDOWS,
        isNative: true,
        canSaveFile: true,
        canChooseDirectory: true,
        canPrint: true,
        canTakePhoto: true,
        canChoosePhoto: true,
        canChooseFile: true,
        canShare: true,
        canHandleDeepLinks: true,
      };
    }

    // Apple WKWebView Script Message Handlers (iOS / macOS)
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ZamorinNativeBridge) {
      const isMac = Boolean(window.ZamorinIsMac || (navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0));
      return {
        platform: isMac ? PLATFORMS.MACOS : PLATFORMS.IOS,
        isNative: true,
        canSaveFile: true,
        canChooseDirectory: isMac,
        canPrint: true,
        canTakePhoto: !isMac,
        canChoosePhoto: true,
        canChooseFile: true,
        canShare: true,
        canHandleDeepLinks: true,
      };
    }

    // Android WebMessageListener / Native SAF Bridge
    if (window.ZamorinNativeBridge || window.ZamorinAndroidSAF || window.AndroidStorageBridge) {
      return {
        platform: PLATFORMS.ANDROID,
        isNative: true,
        canSaveFile: true,
        canChooseDirectory: true,
        canPrint: true,
        canTakePhoto: true,
        canChoosePhoto: true,
        canChooseFile: true,
        canShare: true,
        canHandleDeepLinks: true,
      };
    }

    // Web / PWA fallback
    const hasFsAccess = typeof window.showSaveFilePicker === 'function' && Boolean(window.isSecureContext);
    const hasWebShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

    return {
      platform: PLATFORMS.WEB,
      isNative: false,
      canSaveFile: hasFsAccess,
      canChooseDirectory: false,
      canPrint: typeof window.print === 'function',
      canTakePhoto: false,
      canChoosePhoto: false,
      canChooseFile: true,
      canShare: hasWebShare,
      canHandleDeepLinks: false,
    };
  }

  /**
   * Dispatches a message to the active native shell following the common protocol.
   * Resolves with { requestId, success, result, errorCode, errorMessage }.
   */
  static async sendNativeMessage(action, payload = {}) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = { requestId, action, payload };

    // 1. Windows WebView2
    if (typeof window !== 'undefined' && window.chrome && window.chrome.webview) {
      return new Promise((resolve) => {
        const handler = (event) => {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(data);
            }
          } catch (_) {}
        };
        window.addEventListener('message', handler);
        window.chrome.webview.postMessage(JSON.stringify(message));
      });
    }

    // 2. Apple WKWebView (iOS / macOS)
    if (typeof window !== 'undefined' && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ZamorinNativeBridge) {
      return new Promise((resolve) => {
        const handler = (event) => {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(data);
            }
          } catch (_) {}
        };
        window.addEventListener('message', handler);
        window.webkit.messageHandlers.ZamorinNativeBridge.postMessage(message);
      });
    }

    // 3. Android WebMessageListener
    if (typeof window !== 'undefined' && window.ZamorinNativeBridge && typeof window.ZamorinNativeBridge.postMessage === 'function') {
      return new Promise((resolve) => {
        const handler = (event) => {
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.requestId === requestId) {
              window.removeEventListener('message', handler);
              resolve(data);
            }
          } catch (_) {}
        };
        window.addEventListener('message', handler);
        window.ZamorinNativeBridge.postMessage(JSON.stringify(message));
      });
    }

    return {
      requestId,
      success: false,
      errorCode: 'NATIVE_BRIDGE_UNAVAILABLE',
      errorMessage: 'No native host container detected for platform message dispatch.',
    };
  }
}

if (typeof window !== 'undefined') {
  window.ZamorinNativeCapabilities = NativeCapabilities.getCapabilities();
}
