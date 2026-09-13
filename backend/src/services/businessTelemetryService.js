'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — BUSINESS PROCESS TELEMETRY SERVICE
 * ============================================================================
 * Aggregates live business process operational signals (failures, bottlenecks,
 * drop-offs) across all core ERP subsystems without exposing sensitive financials.
 */

class BusinessTelemetryService {
  constructor() {
    this.counters = {
      posTransactionFailures: 0,
      invoiceGenerationFailures: 0,
      saveAndPrintFailures: 0,
      exportFailures: 0,
      attachmentUploadFailures: 0,
      documentVerificationFailures: 0,
      employeeProvisioningFailures: 0,
      cafeOnboardingFailures: 0,
      qrResolutionFailures: 0,
      scheduledJobFailures: 0,
    };

    this.recentFailures = [];
    this.maxRecent = 50;
  }

  /**
   * Records a business process failure signal.
   */
  recordSignal(signalKey, { cafeId = null, organisationId = 'ZAMORIN', error = null, correlationId = null } = {}) {
    if (this.counters[signalKey] !== undefined) {
      this.counters[signalKey] += 1;
    }

    const event = {
      timestamp: new Date().toISOString(),
      signalKey,
      organisationId,
      cafeId,
      correlationId,
      errorCode: error?.code || 'UNKNOWN_ERROR',
      errorMessage: error?.message ? String(error.message).slice(0, 200) : 'None',
    };

    this.recentFailures.push(event);
    if (this.recentFailures.length > this.maxRecent) {
      this.recentFailures.shift();
    }

    return event;
  }

  /**
   * Returns sanitized telemetry metrics for administrative health view.
   */
  getTelemetrySummary() {
    return {
      timestamp: new Date().toISOString(),
      counters: { ...this.counters },
      totalFailuresRecorded: Object.values(this.counters).reduce((sum, count) => sum + count, 0),
      recentFailureCount: this.recentFailures.length,
      recentFailures: this.recentFailures.slice(-10),
    };
  }

  reset() {
    for (const key of Object.keys(this.counters)) {
      this.counters[key] = 0;
    }
    this.recentFailures = [];
  }
}

const businessTelemetryService = new BusinessTelemetryService();

module.exports = {
  BusinessTelemetryService,
  businessTelemetryService,
};
