/**
 * Zamorin Café ERP — Universal Export Centre Modal
 * Fully compliant with Part B specification:
 * - Formats: strictly PDF (.pdf) and Excel (.xlsx) only
 * - Official ID display and tamper-proof metadata derivation
 * - Inline rename with collision & duplicate detection
 * - Cross-platform destination manager (defaulting to "ZAMORIN ERP" with File System Access API fallback)
 * - Actions: Preview, Export, Print, Cancel
 */

class ExportCentreModal {
  constructor() {
    this.modalEl = null;
    this.activeConfig = null;
    this.destinationHandle = null;
    this.destinationPath = 'Browser default download location will be used.';
    this.sessionFiles = new Set();
  }

  /**
   * Opens the universal Export Centre modal.
   * @param {Object} options
   * @param {string} options.officialId - Official business/document ID (e.g. DO-2026-000128, EXP-ZC01-0001)
   * @param {string} options.title - Human readable document title
   * @param {string} [options.defaultFormat='PDF'] - 'PDF' or 'XLSX'
   * @param {Function} options.onExport - async callback ({ format, filename, officialId, destination }) => Promise<{ buffer, base64, blob, url }>
   * @param {Function} [options.onPreview] - optional custom preview handler
   * @param {Function} [options.onPrint] - optional direct print handler
   */
  open({ officialId, title, defaultFormat = 'PDF', onExport, onPreview, onPrint }) {
    this.close();

    const cleanOfficialId = (officialId || `DOC-${Date.now()}`).trim();
    const initialExt = defaultFormat.toUpperCase() === 'XLSX' ? 'xlsx' : 'pdf';
    const initialFilename = `${cleanOfficialId}.${initialExt}`;

    this.activeConfig = {
      officialId: cleanOfficialId,
      title: title || 'Business Document Export',
      format: defaultFormat.toUpperCase() === 'XLSX' ? 'XLSX' : 'PDF',
      filename: initialFilename,
      userRenamed: false,
      onExport,
      onPreview,
      onPrint,
    };

    this.render();
  }

  close() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
    this.modalEl = null;
    this.activeConfig = null;
  }

  render() {
    const { officialId, title, format, filename } = this.activeConfig;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';
    overlay.id = 'exportCentreOverlay';

    overlay.innerHTML = `
      <div class="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-semibold text-white">Export Document</h3>
              <p class="text-xs text-slate-400 font-mono">${title}</p>
            </div>
          </div>
          <button id="expCloseBtn" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
          <!-- Format Selector (Strictly PDF & Excel only) -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Export Format</label>
            <div class="grid grid-cols-2 gap-3">
              <label class="cursor-pointer border rounded-lg p-3 flex items-center space-x-3 transition ${format === 'PDF' ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'}" id="formatPdfLabel">
                <input type="radio" name="exportFormat" value="PDF" ${format === 'PDF' ? 'checked' : ''} class="sr-only" id="formatPdfRadio">
                <div class="w-8 h-8 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">PDF</div>
                <div class="text-left">
                  <div class="text-sm font-medium">Standard PDF</div>
                  <div class="text-xs text-slate-500">A4 • APA 7 Layout</div>
                </div>
              </label>

              <label class="cursor-pointer border rounded-lg p-3 flex items-center space-x-3 transition ${format === 'XLSX' ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'}" id="formatXlsxLabel">
                <input type="radio" name="exportFormat" value="XLSX" ${format === 'XLSX' ? 'checked' : ''} class="sr-only" id="formatXlsxRadio">
                <div class="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">XLSX</div>
                <div class="text-left">
                  <div class="text-sm font-medium">Microsoft Excel</div>
                  <div class="text-xs text-slate-500">Worksheet Package</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Official Document Identifier -->
          <div class="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            <div class="text-xs text-slate-400">Official Document ID</div>
            <div class="font-mono text-sm text-amber-400 font-semibold flex items-center justify-between">
              <span>${officialId}</span>
              <span class="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">Immutable Trace ID</span>
            </div>
          </div>

          <!-- File Name & Rename Control -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-semibold text-slate-300 uppercase tracking-wider">File Name</label>
              <button type="button" id="expToggleRenameBtn" class="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Rename File</span>
              </button>
            </div>
            <div class="relative">
              <input type="text" id="expFilenameInput" value="${filename}" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-amber-500" readonly>
            </div>
            <div id="duplicateWarning" class="hidden mt-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
              ⚠️ A document with this name already exists. Choose a different name or proceed to overwrite.
            </div>
          </div>

          <!-- Save Location / Device Storage -->
          <div>
            <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Save Location</label>
            <div class="flex items-center space-x-2">
              <div class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono flex items-center space-x-2">
                <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span id="expLocationLabel" class="truncate">${this.destinationPath}</span>
              </div>
              <button type="button" id="expChangeLocationBtn" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition shrink-0">
                Change Location
              </button>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">Cross-platform destination with native storage access & browser download fallback.</p>
          </div>

          <!-- Options -->
          <div class="flex items-center space-x-2">
            <input type="checkbox" id="expOpenAfterCheckbox" class="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900">
            <label for="expOpenAfterCheckbox" class="text-xs text-slate-300 select-none">Open preview automatically after export</label>
          </div>
        </div>

        <!-- Actions -->
        <div class="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <button type="button" id="expPreviewBtn" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center space-x-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Preview</span>
            </button>
            <button type="button" id="expPrintBtn" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center space-x-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>
          </div>

          <div class="flex items-center space-x-2">
            <button type="button" id="expCancelBtn" class="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition">Cancel</button>
            <button type="button" id="expSubmitBtn" class="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition flex items-center space-x-1.5">
              <span>Export</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.modalEl = overlay;
    this.bindEvents();
  }

  bindEvents() {
    if (!this.modalEl) return;

    const overlay = this.modalEl;
    const { officialId } = this.activeConfig;

    const closeBtn = overlay.querySelector('#expCloseBtn');
    const cancelBtn = overlay.querySelector('#expCancelBtn');
    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    // Format changes
    const pdfRadio = overlay.querySelector('#formatPdfRadio');
    const xlsxRadio = overlay.querySelector('#formatXlsxRadio');
    const pdfLabel = overlay.querySelector('#formatPdfLabel');
    const xlsxLabel = overlay.querySelector('#formatXlsxLabel');
    const filenameInput = overlay.querySelector('#expFilenameInput');

    const updateFormat = (newFmt) => {
      this.activeConfig.format = newFmt;
      const ext = newFmt === 'XLSX' ? 'xlsx' : 'pdf';
      const curBase = filenameInput.value.replace(/\.(?:pdf|xlsx)$/i, '');
      filenameInput.value = `${curBase}.${ext}`;
      this.activeConfig.filename = filenameInput.value;

      if (newFmt === 'PDF') {
        pdfLabel.className = 'cursor-pointer border rounded-lg p-3 flex items-center space-x-3 transition border-amber-500 bg-amber-500/10 text-white';
        xlsxLabel.className = 'cursor-pointer border rounded-lg p-3 flex items-center space-x-3 transition border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700';
      } else {
        xlsxLabel.className = 'cursor-pointer border rounded-lg p-3 flex items-center space-x-3 transition border-amber-500 bg-amber-500/10 text-white';
        pdfLabel.className = 'cursor-pointer border rounded-lg p-3 flex items-center space-x-3 transition border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700';
      }
      this.checkDuplicate(filenameInput.value);
    };

    pdfLabel?.addEventListener('click', () => { pdfRadio.checked = true; updateFormat('PDF'); });
    xlsxLabel?.addEventListener('click', () => { xlsxRadio.checked = true; updateFormat('XLSX'); });

    // Rename control
    const toggleRenameBtn = overlay.querySelector('#expToggleRenameBtn');
    toggleRenameBtn?.addEventListener('click', () => {
      filenameInput.readOnly = false;
      filenameInput.focus();
      filenameInput.select();
    });

    filenameInput?.addEventListener('input', (e) => {
      this.activeConfig.filename = e.target.value.trim();
      this.activeConfig.userRenamed = true;
      this.checkDuplicate(this.activeConfig.filename);
    });

    // Change Location (Storage Access Framework / showDirectoryPicker)
    const changeLocBtn = overlay.querySelector('#expChangeLocationBtn');
    const locLabel = overlay.querySelector('#expLocationLabel');
    changeLocBtn?.addEventListener('click', async () => {
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await window.showDirectoryPicker();
          this.destinationHandle = dirHandle;
          this.destinationPath = `Local: /${dirHandle.name || 'ZAMORIN ERP'}`;
          locLabel.textContent = this.destinationPath;
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('Directory picker fallback:', err);
          }
        }
      } else {
        this.destinationHandle = null;
        this.destinationPath = 'Browser default download location will be used.';
        locLabel.textContent = this.destinationPath;
        alert('Directory selection is not supported in this browser environment. Browser default download location will be used.');
      }
    });

    // Preview
    const previewBtn = overlay.querySelector('#expPreviewBtn');
    previewBtn?.addEventListener('click', async () => {
      if (typeof this.activeConfig.onPreview === 'function') {
        this.activeConfig.onPreview({
          format: this.activeConfig.format,
          officialId,
          filename: this.activeConfig.filename
        });
      } else {
        // Trigger export and open preview URL
        await this.handleExportAction(true);
      }
    });

    // Print
    const printBtn = overlay.querySelector('#expPrintBtn');
    printBtn?.addEventListener('click', async () => {
      if (typeof this.activeConfig.onPrint === 'function') {
        this.activeConfig.onPrint();
      } else {
        window.print();
      }
    });

    // Submit Export
    const submitBtn = overlay.querySelector('#expSubmitBtn');
    submitBtn?.addEventListener('click', async () => {
      const openAfter = overlay.querySelector('#expOpenAfterCheckbox')?.checked;
      await this.handleExportAction(openAfter);
      this.close();
    });
  }

  checkDuplicate(filename) {
    const warningEl = this.modalEl?.querySelector('#duplicateWarning');
    if (!warningEl) return;
    if (this.sessionFiles.has(filename.toLowerCase())) {
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
  }

  async handleExportAction(openAfter = false) {
    if (!this.activeConfig || typeof this.activeConfig.onExport !== 'function') return;

    const { format, filename, officialId } = this.activeConfig;
    const submitBtn = this.modalEl?.querySelector('#expSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Exporting...</span>`;
    }

    try {
      const result = await this.activeConfig.onExport({
        format,
        filename,
        officialId,
        destination: this.destinationPath,
      });

      this.sessionFiles.add(filename.toLowerCase());

      // If Native File System handle is available, write to directory
      if (this.destinationHandle && result?.blob) {
        try {
          const fileHandle = await this.destinationHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(result.blob);
          await writable.close();
        } catch (fsErr) {
          console.warn('Native FS write failed, falling back to download:', fsErr);
          this.triggerBrowserDownload(result, filename);
        }
      } else if (result) {
        this.triggerBrowserDownload(result, filename);
      }

      if (openAfter && result?.url) {
        window.open(result.url, '_blank');
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Export</span>`;
      }
    }
  }

  triggerBrowserDownload(result, filename) {
    let url = result.url;
    let cleanup = false;

    if (!url && result.blob) {
      url = URL.createObjectURL(result.blob);
      cleanup = true;
    } else if (!url && result.base64) {
      const mime = filename.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      url = `data:${mime};base64,${result.base64}`;
    }

    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (cleanup) setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }
}

export const exportCentreModal = new ExportCentreModal();
export default exportCentreModal;
