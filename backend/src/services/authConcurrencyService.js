'use strict';

/**
 * Enterprise Authentication KDF Concurrency Limiter & Backpressure Controller
 * 
 * Prevents memory-hard password verification (scrypt) from saturating CPU/RAM
 * and starving the Node.js event loop during burst login storms.
 * 
 * Features:
 * - Bounded concurrency worker pool for cryptographic operations
 * - Bounded FIFO request queue with configurable timeout
 * - Backpressure rejection when queue capacity is exceeded
 * - Observability metrics (activeWorkers, queueDepth, queuedLatencyMs, rejectedCount)
 */

class AuthConcurrencyService {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || Math.max(2, (require('node:os').cpus().length || 4));
    this.maxQueueDepth = options.maxQueueDepth || 500;
    this.timeoutMs = options.timeoutMs || 15000;
    this.activeWorkers = 0;
    this.queue = [];
    this.metrics = {
      totalTasksExecuted: 0,
      totalTasksQueued: 0,
      totalTasksRejected: 0,
      totalTasksTimedOut: 0,
      peakQueueDepth: 0,
      peakActiveWorkers: 0,
    };
  }

  /**
   * Executes a CPU/memory-heavy KDF task with bounded concurrency and queue backpressure.
   * @param {Function} taskFn - Async function performing password hash / verification.
   * @returns {Promise<any>}
   */
  async execute(taskFn) {
    if (this.activeWorkers < this.maxConcurrency && this.queue.length === 0) {
      return this._runTask(taskFn);
    }

    if (this.queue.length >= this.maxQueueDepth) {
      this.metrics.totalTasksRejected++;
      const err = new Error('Authentication KDF queue saturated; please retry shortly.');
      err.code = 'AUTH_KDF_QUEUE_SATURATED';
      err.statusCode = 429;
      throw err;
    }

    this.metrics.totalTasksQueued++;
    const queuedAt = Date.now();

    return new Promise((resolve, reject) => {
      let timer = null;

      const item = {
        taskFn,
        resolve: (val) => {
          if (timer) clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
        queuedAt,
      };

      timer = setTimeout(() => {
        const idx = this.queue.indexOf(item);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.metrics.totalTasksTimedOut++;
          const err = new Error('Authentication request timed out in processing queue.');
          err.code = 'AUTH_KDF_QUEUE_TIMEOUT';
          err.statusCode = 504;
          reject(err);
        }
      }, this.timeoutMs);

      this.queue.push(item);
      if (this.queue.length > this.metrics.peakQueueDepth) {
        this.metrics.peakQueueDepth = this.queue.length;
      }
    });
  }

  async _runTask(taskFn) {
    this.activeWorkers++;
    if (this.activeWorkers > this.metrics.peakActiveWorkers) {
      this.metrics.peakActiveWorkers = this.activeWorkers;
    }

    try {
      const result = await taskFn();
      this.metrics.totalTasksExecuted++;
      return result;
    } finally {
      this.activeWorkers--;
      this._drainNext();
    }
  }

  _drainNext() {
    if (this.activeWorkers < this.maxConcurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this._runTask(next.taskFn)
          .then(next.resolve)
          .catch(next.reject);
      }
    }
  }

  getMetrics() {
    return {
      activeWorkers: this.activeWorkers,
      queueDepth: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueueDepth: this.maxQueueDepth,
      ...this.metrics,
    };
  }

  reset() {
    this.queue = [];
    this.activeWorkers = 0;
    this.metrics = {
      totalTasksExecuted: 0,
      totalTasksQueued: 0,
      totalTasksRejected: 0,
      totalTasksTimedOut: 0,
      peakQueueDepth: 0,
      peakActiveWorkers: 0,
    };
  }
}

const defaultAuthConcurrencyService = new AuthConcurrencyService();

module.exports = {
  AuthConcurrencyService,
  defaultAuthConcurrencyService,
};
