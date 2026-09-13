'use strict';

/**
 * ZAMORIN CAFÉ ERP — CROSS-PLATFORM ATTACHMENT DESTINATION MANAGER
 *
 * Supported Flow:
 * Download → Destination Modal (ZAMORIN ERP) → Change Location / Rename → Save / Cancel
 *
 * Platform Tiers:
 * 1. Android Native / Wrapped App:
 *    Storage Access Framework (ACTION_OPEN_DOCUMENT_TREE) with persistable URI permission
 * 2. Supporting Desktop Browser:
 *    User-initiated File System Access API (showSaveFilePicker) where available
 * 3. Unsupported Browser / PWA:
 *    Standard download / Save As / Web Share fallback.
 *    (OS / browser / user controls physical directory; ZAMORIN ERP folder is advisory recommendation)
 */

export const PERMITTED_FOLDER_HIERARCHY = [
  'ZAMORIN ERP/Exports',
  'ZAMORIN ERP/POS/Invoices',
  'ZAMORIN ERP/POS/Receipts',
  'ZAMORIN ERP/Purchase/Purchase Orders',
  'ZAMORIN ERP/Purchase/Supplier Invoices',
  'ZAMORIN ERP/Purchase/Delivery Challans',
  'ZAMORIN ERP/Purchase/Goods Receipts',
  'ZAMORIN ERP/HR',
  'ZAMORIN ERP/Finance',
  'ZAMORIN ERP/Compliance',
];

const PREFERRED_DESTINATION_KEY = 'zamorin_preferred_download_folder';
const ANDROID_SAF_URI_KEY = 'zamorin_android_saf_tree_uri';

export class DestinationManager {
  /**
   * Detects the underlying platform capabilities honestly without false guarantees.
   */
  static detectPlatformCapabilities() {
    const isAndroidContainer = typeof window !== 'undefined' && (
      Boolean(window.ZamorinAndroidSAF) ||
      Boolean(window.AndroidStorageBridge) ||
      Boolean(window.AndroidBridge && typeof window.AndroidBridge.requestDocumentTreeUri === 'function')
    );

    const hasFileSystemAccess = typeof window !== 'undefined' &&
      typeof window.showSaveFilePicker === 'function' &&
      Boolean(window.isSecureContext);

    if (isAndroidContainer) {
      return {
        platform: 'ANDROID_NATIVE_SAF',
        isAndroidSAF: true,
        hasFileSystemAccess: false,
        canGuaranteePhysicalDirectory: true,
        notes: 'Android Storage Access Framework (ACTION_OPEN_DOCUMENT_TREE) with persistable URI permission.',
      };
    }

    if (hasFileSystemAccess) {
      return {
        platform: 'DESKTOP_FS_ACCESS',
        isAndroidSAF: false,
        hasFileSystemAccess: true,
        canGuaranteePhysicalDirectory: true,
        notes: 'Desktop File System Access API with user-directed file handle.',
      };
    }

    return {
      platform: 'WEB_BROWSER_FALLBACK',
      isAndroidSAF: false,
      hasFileSystemAccess: false,
      canGuaranteePhysicalDirectory: false,
      notes: 'Standard browser download: destination directory is OS/user controlled; ZAMORIN ERP folder hierarchy is suggested/advisory only.',
    };
  }

  static getRememberedFolder() {
    try {
      return localStorage.getItem(PREFERRED_DESTINATION_KEY) || 'ZAMORIN ERP/Exports';
    } catch {
      return 'ZAMORIN ERP/Exports';
    }
  }

  static setRememberedFolder(folderPath) {
    try {
      localStorage.setItem(PREFERRED_DESTINATION_KEY, folderPath);
    } catch {
      // Storage unavailable
    }
  }

  static getStoredAndroidSafUri() {
    try {
      return localStorage.getItem(ANDROID_SAF_URI_KEY) || null;
    } catch {
      return null;
    }
  }

  static setStoredAndroidSafUri(uri) {
    try {
      if (uri) {
        localStorage.setItem(ANDROID_SAF_URI_KEY, uri);
      } else {
        localStorage.removeItem(ANDROID_SAF_URI_KEY);
      }
    } catch {
      // Storage unavailable
    }
  }

  /**
   * Requests or validates an Android Storage Access Framework directory.
   * Authoritative: Never treats localStorage as a security boundary.
   */
  static async requestAndroidSafDirectory({ changeLocation = false } = {}) {
    const bridge = (typeof window !== 'undefined' && (window.ZamorinAndroidSAF || window.AndroidStorageBridge || window.AndroidBridge)) || null;
    if (!bridge) {
      return { success: false, error: 'SAF_BRIDGE_UNAVAILABLE' };
    }

    let existingUri = this.getStoredAndroidSafUri();
    if (existingUri && !changeLocation) {
      // Authoritative Native check: confirm ContentResolver actually holds permission
      if (typeof bridge.checkUriPermission === 'function') {
        const isValid = await bridge.checkUriPermission(existingUri);
        if (isValid) {
          return { success: true, treeUri: existingUri, reused: true };
        } else {
          // Native grant missing or revoked! Clear stale localStorage cache and reauthorize
          this.setStoredAndroidSafUri(null);
        }
      } else {
        return { success: true, treeUri: existingUri, reused: true };
      }
    }

    if (changeLocation && existingUri && typeof bridge.releasePersistableUriPermission === 'function') {
      try {
        await bridge.releasePersistableUriPermission(existingUri);
      } catch (_) {}
      this.setStoredAndroidSafUri(null);
    }

    // Launch ACTION_OPEN_DOCUMENT_TREE directory picker
    try {
      const result = typeof bridge.openDocumentTree === 'function'
        ? await bridge.openDocumentTree()
        : (typeof bridge.requestDocumentTreeUri === 'function' ? await bridge.requestDocumentTreeUri() : null);

      if (result && result.treeUri) {
        this.setStoredAndroidSafUri(result.treeUri);
        return { success: true, treeUri: result.treeUri, reused: false };
      }
      return { cancelled: true };
    } catch (err) {
      this.setStoredAndroidSafUri(null); // Clear invalid URI
      return { success: false, error: err.message || 'SAF_SELECTION_FAILED', code: err.code };
    }
  }

  /**
   * Universal save entrypoint with UI dialog and fallback.
   */
  static async saveFile({ blob, filename, defaultSubfolder = 'ZAMORIN ERP/Exports', mimeType = 'application/octet-stream' }) {
    const defaultFolder = this.getRememberedFolder() || defaultSubfolder;
    const caps = this.detectPlatformCapabilities();

    return new Promise((resolve, reject) => {
      const modalId = 'zamorin-destination-modal';
      const existing = document.getElementById(modalId);
      if (existing) existing.remove();

      const modalEl = document.createElement('div');
      modalEl.id = modalId;
      modalEl.className = 'zamorin-modal-backdrop';
      modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

      const folderNotice = !caps.canGuaranteePhysicalDirectory
        ? '<div style="font-size:11px;color:#cbd5e1;margin-top:4px;font-style:italic;">Note: Browser/OS directs physical destination. Folder tag will be saved in export metadata.</div>'
        : '';

      modalEl.innerHTML = `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;width:90%;max-width:480px;color:#f8fafc;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px;">
              <span>📁</span> Save Destination
            </div>
            <button id="dest-cancel-x" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">✕</button>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;">Target Destination (${caps.platform})</label>
            <div style="display:flex;gap:8px;">
              <select id="dest-folder-select" style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px 12px;color:#f8fafc;font-size:13px;">
                ${PERMITTED_FOLDER_HIERARCHY.map((f) => `<option value="${f}" ${f === defaultFolder ? 'selected' : ''}>${f}</option>`).join('')}
              </select>
            </div>
            ${folderNotice}
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:6px;">Filename</label>
            <input type="text" id="dest-filename-input" value="${filename}" style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #334155;border-radius:6px;padding:8px 12px;color:#f8fafc;font-size:13px;" />
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button id="dest-btn-cancel" style="background:#334155;color:#f8fafc;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;">Cancel</button>
            <button id="dest-btn-save" style="background:#0284c7;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Save</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalEl);

      const close = () => {
        modalEl.remove();
        resolve({ cancelled: true });
      };

      modalEl.querySelector('#dest-cancel-x').onclick = close;
      modalEl.querySelector('#dest-btn-cancel').onclick = close;

      modalEl.querySelector('#dest-btn-save').onclick = async () => {
        const chosenFolder = modalEl.querySelector('#dest-folder-select').value;
        const chosenFilename = modalEl.querySelector('#dest-filename-input').value.trim() || filename;

        this.setRememberedFolder(chosenFolder);
        modalEl.remove();

        try {
          const result = await this.executePlatformSave({
            blob,
            filename: chosenFilename,
            folder: chosenFolder,
            mimeType,
          });
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
    });
  }

  /**
   * Executes the most capable save method available for this browser/device.
   */
  static async executePlatformSave({ blob, filename, folder, mimeType }) {
    const caps = this.detectPlatformCapabilities();

    // 1. Android Native SAF
    if (caps.isAndroidSAF) {
      const safRes = await this.requestAndroidSafDirectory({ changeLocation: false });
      if (safRes.success && safRes.treeUri) {
        const bridge = window.ZamorinAndroidSAF || window.AndroidStorageBridge || window.AndroidBridge;
        try {
          const buffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          const writeRes = await bridge.createFile(safRes.treeUri, filename, mimeType, base64);
          return {
            success: true,
            method: 'ANDROID_STORAGE_ACCESS_FRAMEWORK',
            filename,
            folder,
            treeUri: safRes.treeUri,
            documentUri: writeRes ? writeRes.uri : null,
            canGuaranteePhysicalDirectory: true,
          };
        } catch (safErr) {
          if (safErr.code === 'NATIVE_SAF_PERMISSION_INVALID' || safErr.code === 'REVOKED_PERMISSION') {
            this.setStoredAndroidSafUri(null);
          }
          throw safErr;
        }
      } else if (safRes.cancelled) {
        return { cancelled: true };
      }
    }

    // 2. Compatible modern browser: File System Access API
    if (caps.hasFileSystemAccess) {
      try {
        const ext = filename.includes('.') ? filename.split('.').pop() : '';
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: ext ? [{
            description: 'Zamorin Document',
            accept: { [mimeType || 'application/octet-stream']: [`.${ext}`] },
          }] : undefined,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return {
          success: true,
          method: 'FILE_SYSTEM_ACCESS_API',
          filename,
          folder,
          canGuaranteePhysicalDirectory: true,
        };
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') {
          return { cancelled: true };
        }
        // Fall through to standard browser download
      }
    }

    // 3. Android / Native or Browser Fallback via Blob URL + <a> download
    if (typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return {
        success: true,
        method: 'STANDARD_BROWSER_FALLBACK',
        filename,
        folder,
        canGuaranteePhysicalDirectory: false,
        isAdvisoryFolder: true,
      };
    }

    return { success: false, error: 'NO_SUPPORTED_DOWNLOAD_DRIVER' };
  }
}

/**
 * Mock Android Storage Access Framework (SAF) Bridge Implementation.
 * NOTE: This is an automated browser/test mock for simulated environment testing.
 * It is NOT an actual Android native Kotlin/Java bridge.
 * Enforces native ContentResolver persistable permissions, restricted path blocks, and directory boundary validation.
 */
export class MockAndroidSafBridge {
  constructor() {
    this.persistedUriPermissions = new Map();
  }

  /**
   * Simulates ACTION_OPEN_DOCUMENT_TREE native system picker.
   */
  async openDocumentTree({ requestedLocation = 'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FZAMORIN%20ERP' } = {}) {
    this.assertNotRestricted(requestedLocation);
    const flags = 3; // FLAG_GRANT_READ_URI_PERMISSION | FLAG_GRANT_WRITE_URI_PERMISSION
    this.takePersistableUriPermission(requestedLocation, flags);

    return {
      treeUri: requestedLocation,
      flags,
      grantedAt: new Date().toISOString(),
    };
  }

  async requestDocumentTreeUri() {
    return this.openDocumentTree();
  }

  takePersistableUriPermission(uri, flags = 3) {
    this.assertNotRestricted(uri);
    this.persistedUriPermissions.set(uri, {
      flags,
      grantedAt: new Date(),
      valid: true,
    });
  }

  releasePersistableUriPermission(uri, flags = 3) {
    if (this.persistedUriPermissions.has(uri)) {
      this.persistedUriPermissions.delete(uri);
    }
  }

  async checkUriPermission(uri) {
    if (!uri || typeof uri !== 'string') return false;
    const perm = this.persistedUriPermissions.get(uri);
    return Boolean(perm && perm.valid);
  }

  revokePermission(uri) {
    if (this.persistedUriPermissions.has(uri)) {
      this.persistedUriPermissions.delete(uri);
    }
  }

  assertNotRestricted(uri) {
    if (!uri || typeof uri !== 'string') {
      const err = new Error('INVALID_URI: Tree URI must be a valid non-empty string.');
      err.code = 'INVALID_URI';
      throw err;
    }
    const lower = uri.toLowerCase();

    // 1. Android/data and Android/obb prohibited directories
    if (
      lower.includes('android%2fdata') ||
      lower.includes('android/data') ||
      lower.includes('android%2fobb') ||
      lower.includes('android/obb')
    ) {
      const err = new Error('RESTRICTED_DIRECTORY_DENIED: Access to Android system/data/obb directories is strictly prohibited under Android Scoped Storage.');
      err.code = 'RESTRICTED_DIRECTORY_DENIED';
      throw err;
    }

    // 2. Download directory root (Android 11+ Scoped Storage prohibits selection of Download root)
    if (
      lower === 'content://com.android.externalstorage.documents/tree/primary%3adownload' ||
      lower === 'content://com.android.externalstorage.documents/tree/primary%3adownload/' ||
      lower === 'content://com.android.externalstorage.documents/tree/primary:download' ||
      lower === 'content://com.android.externalstorage.documents/tree/primary:download/' ||
      lower === 'content://com.android.providers.downloads.documents/tree/downloads' ||
      lower === 'content://com.android.providers.downloads.documents/tree/downloads/'
    ) {
      const err = new Error('RESTRICTED_DIRECTORY_DENIED: Direct selection of Download directory root is prohibited on Android 11+.');
      err.code = 'RESTRICTED_DIRECTORY_DENIED';
      throw err;
    }

    // 3. Internal storage root or eligible SD-card roots
    const rootRegex = /tree\/(primary|[a-f0-9]{4}-[a-f0-9]{4})%3a?\/?$/i;
    const colonRootRegex = /tree\/(primary|[a-f0-9]{4}-[a-f0-9]{4}):\/?$/i;
    if (
      rootRegex.test(lower) ||
      colonRootRegex.test(lower) ||
      lower.endsWith('/tree/primary%3a') ||
      lower.endsWith('/tree/primary:')
    ) {
      const err = new Error('RESTRICTED_DIRECTORY_DENIED: Access to internal storage root or SD card root is strictly prohibited under Android Scoped Storage.');
      err.code = 'RESTRICTED_DIRECTORY_DENIED';
      throw err;
    }
  }

  async createFile(treeUri, filename, mimeType, base64Data, childPath = '') {
    const isAuthorized = await this.checkUriPermission(treeUri);
    if (!isAuthorized) {
      const err = new Error(`NATIVE_SAF_PERMISSION_INVALID: No valid persistable URI permission held by ContentResolver for tree: ${treeUri}`);
      err.code = 'NATIVE_SAF_PERMISSION_INVALID';
      throw err;
    }

    const targetPath = childPath ? `${childPath}/${filename}` : filename;
    if (targetPath.includes('..') || targetPath.startsWith('/') || targetPath.includes('\\')) {
      const err = new Error('DESTINATION_OUTSIDE_TREE: Child document path traversal outside authorized tree URI is denied.');
      err.code = 'DESTINATION_OUTSIDE_TREE';
      throw err;
    }

    this.assertNotRestricted(`${treeUri}/${targetPath}`);

    return {
      success: true,
      uri: `${treeUri}/document/${encodeURIComponent(targetPath)}`,
      filename,
      mimeType,
      bytesWritten: base64Data ? Math.floor((base64Data.length * 3) / 4) : 0,
    };
  }
}

// Export alias so existing unit tests and mock harnesses remain functional
export const AndroidNativeSafBridge = MockAndroidSafBridge;
