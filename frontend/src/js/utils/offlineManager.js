/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — CLIENT OFFLINE MANAGER (R02-09)
 * ============================================================================
 * Handles degraded / offline operation:
 * - Local storage queue for POS transactions and KDS orders
 * - Connectivity monitoring and visual badge status
 * - Idempotent replay to /api/v1/bills/offline-sync upon network restoration
 */

const STORAGE_KEY = 'zamorin_offline_tx_queue_v1';

class OfflineManager {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.syncing = false;
    this._listeners = [];

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * Generates a unique monotonic offline transaction ID
   */
  generateOfflineId() {
    const d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const r = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `OFF-${d}-${r}`;
  }

  /**
   * Retrieves all queued offline transactions
   */
  getQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * Saves the queue to local storage
   */
  saveQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      this.notifyListeners();
    } catch (_) {}
  }

  /**
   * Resolves risk policy class for offline operations
   */
  resolvePolicy(transaction = {}) {
    const opType = String(transaction.operationType || '').toUpperCase();
    const status = String(transaction.status || '').toUpperCase();
    const paymentMethod = String(transaction.paymentMethod || '').toUpperCase();
    const orderType = String(transaction.orderType || '').toUpperCase();

    if (
      transaction.isRefund === true ||
      ['REFUND', 'CASH_REVERSAL', 'REVERSAL', 'DEVICE_REVOCATION', 'PERMISSION_MUTATION', 'APPROVAL', 'STOCK_CORRECTION'].includes(opType) ||
      ['REFUNDED', 'PARTIALLY_REFUNDED', 'VOIDED', 'PAYMENT_REVERSED'].includes(status) ||
      orderType === 'REVERSAL'
    ) {
      return 'ONLINE_REQUIRED';
    }

    if (['CARD', 'UPI', 'PAYMENT_GATEWAY', 'NETBANKING', 'WALLET'].includes(paymentMethod)) {
      return 'PAYMENT_PROVIDER_DEPENDENT';
    }

    if (transaction.isDraft === true || status === 'DRAFT' || opType === 'LOCAL_DRAFT') {
      return 'LOCAL_DRAFT_ALLOWED';
    }

    if (paymentMethod === 'CASH' || ['QUICK_SALE', 'DINE_IN', 'TAKEAWAY'].includes(orderType)) {
      return 'SAFE_QUEUE_ALLOWED';
    }

    return 'ONLINE_REQUIRED';
  }

  /**
   * Enqueues a transaction while operating in degraded/offline mode.
   * Rejects high-risk mutations and electronic payments according to offline risk policies.
   */
  enqueue(transaction) {
    const policy = this.resolvePolicy(transaction);
    if (policy === 'ONLINE_REQUIRED') {
      throw new Error(`High-risk operation (${transaction.operationType || transaction.status || 'FINANCIAL_MUTATION'}) requires online server authorization and cannot be queued offline.`);
    }
    if (policy === 'PAYMENT_PROVIDER_DEPENDENT') {
      throw new Error(`Electronic payment method (${transaction.paymentMethod}) requires online payment provider authorization and cannot be executed offline.`);
    }

    const queue = this.getQueue();
    const offlineId = transaction.clientOfflineId || this.generateOfflineId();

    const entry = {
      ...transaction,
      clientOfflineId: offlineId,
      policy,
      offlineCreatedAt: transaction.offlineCreatedAt || new Date().toISOString(),
      queuedAt: new Date().toISOString(),
    };

    queue.push(entry);
    this.saveQueue(queue);
    return entry;
  }

  /**
   * Returns current count of queued offline transactions
   */
  getPendingCount() {
    return this.getQueue().length;
  }

  /**
   * Replays queued offline transactions to the backend
   */
  async sync(apiClient) {
    const queue = this.getQueue();
    if (queue.length === 0 || this.syncing) return { syncedCount: 0, queueLength: 0 };

    this.syncing = true;
    try {
      const payload = {
        transactions: queue,
      };

      const response = await (apiClient
        ? apiClient.post('/api/v1/bills/offline-sync', payload)
        : fetch('/api/v1/bills/offline-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).then((r) => r.json()));

      if (response && response.success) {
        // Clear synced items
        const syncedIds = new Set(
          (response.data?.items || [])
            .filter((it) => it.status === 'SYNCED' || it.status === 'ALREADY_SYNCED' || it.status === 'SYNCED_WITH_FLAG')
            .map((it) => it.clientOfflineId)
        );

        const remaining = queue.filter((item) => !syncedIds.has(item.clientOfflineId));
        this.saveQueue(remaining);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('zamorin:offline-sync-complete', {
              detail: response.data,
            })
          );
        }

        return response.data;
      }
    } catch (err) {
      console.warn('Offline sync attempt failed, will retry on next connection event:', err);
    } finally {
      this.syncing = false;
    }

    return { syncedCount: 0, queueLength: this.getQueue().length };
  }

  handleOnline() {
    this.isOnline = true;
    this.notifyListeners();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zamorin:connectivity-changed', { detail: { isOnline: true } }));
    }
    // Attempt background sync
    this.sync();
  }

  handleOffline() {
    this.isOnline = false;
    this.notifyListeners();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zamorin:connectivity-changed', { detail: { isOnline: false } }));
    }
  }

  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter((cb) => cb !== callback);
    };
  }

  notifyListeners() {
    const status = {
      isOnline: this.isOnline,
      pendingCount: this.getPendingCount(),
    };
    this._listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (_) {}
    });
  }
}

const offlineManager = new OfflineManager();

if (typeof window !== 'undefined') {
  window.offlineManager = offlineManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { offlineManager, OfflineManager };
}
