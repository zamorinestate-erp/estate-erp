'use strict';

/**
 * CONSOLE & TEST EMAIL PROVIDER
 *
 * Deterministic in-memory and development email provider.
 * Allows instant testing of outbox delivery, failure resilience, retry simulation,
 * and rate-limiting without requiring live Google OAuth secrets.
 */

const { EmailProvider } = require('./EmailProvider');

class ConsoleTestEmailProvider extends EmailProvider {
  constructor() {
    super('CONSOLE_TEST');
    this.sentEmails = [];
    this.drafts = [];
    this.shouldSimulateOutage = false;
    this.simulatedErrorCode = 'SIMULATED_PROVIDER_DOWN';
  }

  setOutageSimulation(enabled, errorCode = 'SIMULATED_PROVIDER_DOWN') {
    this.shouldSimulateOutage = Boolean(enabled);
    this.simulatedErrorCode = errorCode;
  }

  clearHistory() {
    this.sentEmails = [];
    this.drafts = [];
  }

  async sendEmail(options) {
    if (this.shouldSimulateOutage) {
      const err = new Error(`Provider outage simulation: ${this.simulatedErrorCode}`);
      err.code = this.simulatedErrorCode;
      throw err;
    }

    const messageId = `TEST-MSG-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    if (options.isDraft) {
      const draftId = `TEST-DRAFT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const draftRecord = {
        draftId,
        messageId,
        options,
        createdAt: new Date(),
      };
      this.drafts.push(draftRecord);
      return {
        delivered: true,
        isDraft: true,
        providerMessageId: messageId,
        providerDraftId: draftId,
      };
    }

    const record = {
      messageId,
      to: options.to,
      from: options.from || 'zamorinestatepvtltd.erp@gmail.com',
      replyTo: options.replyTo || 'zamorinestatepvtltd.erp@gmail.com',
      subject: options.subject,
      html: options.html,
      text: options.text,
      sentAt: new Date(),
    };

    this.sentEmails.push(record);

    return {
      delivered: true,
      providerMessageId: messageId,
      providerDraftId: null,
    };
  }

  async checkHealth() {
    if (this.shouldSimulateOutage) {
      return {
        healthy: false,
        status: 'OUTAGE',
        latencyMs: 10,
        error: this.simulatedErrorCode,
      };
    }
    return {
      healthy: true,
      status: 'HEALTHY',
      latencyMs: 2,
    };
  }
}

module.exports = { ConsoleTestEmailProvider };
