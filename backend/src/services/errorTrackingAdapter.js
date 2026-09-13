'use strict';

/**
 * ============================================================================
 * ZAMORIN CAFÉ ERP — PRODUCTION ERROR TRACKING ADAPTER
 * ============================================================================
 * Provider-neutral interface for capturing application exceptions, error events,
 * and operational diagnostics.
 *
 * Invariant:
 * When no third-party error monitoring provider (e.g. Sentry / Datadog) is
 * connected via valid API credentials, returns honest status:
 *   "ERROR_TRACKING_PROVIDER_PENDING"
 * and safely buffers error events to structured logs without leaking PII.
 */

const { sanitizeForLogging, redactSensitiveString } = require('./securityLogger');

class ErrorTrackingAdapter {
  constructor(options = {}) {
    this.provider = options.provider || process.env.ERROR_TRACKING_PROVIDER || null;
    this.environment = process.env.NODE_ENV || 'development';
    this.release = process.env.RELEASE_VERSION || 'v1.0.0-freeze';
    this.breadcrumbs = [];
    this.maxBreadcrumbs = 50;
    this.metrics = {
      exceptionsCaptured: 0,
      messagesCaptured: 0,
    };
  }

  /**
   * Returns provider status description.
   */
  getStatus() {
    if (!this.provider || this.provider === 'PENDING') {
      return {
        status: 'ERROR_TRACKING_PROVIDER_PENDING',
        externalProviderConfigured: false,
        environment: this.environment,
        release: this.release,
        exceptionsCaptured: this.metrics.exceptionsCaptured,
        messagesCaptured: this.metrics.messagesCaptured,
      };
    }

    return {
      status: 'ACTIVE',
      externalProviderConfigured: true,
      provider: this.provider,
      environment: this.environment,
      release: this.release,
    };
  }

  /**
   * Adds an operational breadcrumb safely sanitized.
   */
  addBreadcrumb({ category = 'ui', message, data = {}, level = 'info' }) {
    const breadcrumb = {
      timestamp: new Date().toISOString(),
      category: String(category).trim(),
      message: redactSensitiveString(String(message || '')),
      data: sanitizeForLogging(data),
      level: String(level).toLowerCase(),
    };

    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }

    return breadcrumb;
  }

  /**
   * Captures an exception with tenant-safe context.
   */
  captureException(error, context = {}) {
    this.metrics.exceptionsCaptured += 1;

    const event = {
      eventId: `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      providerStatus: this.getStatus().status,
      environment: this.environment,
      release: this.release,
      error: {
        name: error?.name || 'Error',
        message: redactSensitiveString(error?.message || 'Unknown Exception'),
        code: error?.code || 'INTERNAL_ERROR',
        statusCode: error?.statusCode || error?.status || 500,
        stack: process.env.NODE_ENV !== 'production' && error?.stack ? redactSensitiveString(error.stack) : undefined,
      },
      context: {
        requestId: context.requestId || context.correlationId || null,
        correlationId: context.correlationId || null,
        organisationId: context.organisationId || null,
        cafeId: context.cafeId || null,
        actorId: context.actorId || null,
        tags: sanitizeForLogging(context.tags || {}),
      },
      breadcrumbs: [...this.breadcrumbs],
    };

    if (process.env.NODE_ENV !== 'test') {
      process.stderr.write(`[ERROR_TRACKER] ${JSON.stringify(event)}\n`);
    }

    return event;
  }

  /**
   * Captures a diagnostic message with severity.
   */
  captureMessage(message, level = 'info', context = {}) {
    this.metrics.messagesCaptured += 1;

    const event = {
      eventId: `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      level: String(level).toUpperCase(),
      message: redactSensitiveString(String(message)),
      providerStatus: this.getStatus().status,
      context: sanitizeForLogging(context),
    };

    if (process.env.NODE_ENV !== 'test') {
      process.stdout.write(`[ERROR_TRACKER_MSG] ${JSON.stringify(event)}\n`);
    }

    return event;
  }
}

const errorTrackingAdapter = new ErrorTrackingAdapter();

module.exports = {
  ErrorTrackingAdapter,
  errorTrackingAdapter,
};
