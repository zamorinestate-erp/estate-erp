'use strict';

/**
 * EMAIL PROVIDER — BASE ABSTRACT ADAPTER
 *
 * Provides a uniform contract for email providers (Gmail API, Test/Mock,
 * future professional transactional providers like Amazon SES / SendGrid / Resend).
 * Allows switching providers without altering business domain controllers.
 */

class EmailProvider {
  constructor(name = 'BASE_EMAIL_PROVIDER') {
    this.name = name;
  }

  /**
   * Sends an email or creates a draft.
   * @param {Object} options
   * @param {string} options.to
   * @param {string} options.subject
   * @param {string} options.html
   * @param {string} options.text
   * @param {string} [options.from]
   * @param {string} [options.replyTo]
   * @param {Array} [options.attachments]
   * @param {boolean} [options.isDraft]
   * @returns {Promise<{ delivered: boolean, providerMessageId: string, providerDraftId?: string, rawResponse?: any }>}
   */
  async sendEmail(options) {
    throw new Error(`sendEmail not implemented on ${this.name}`);
  }

  /**
   * Health check for provider connectivity.
   * @returns {Promise<{ healthy: boolean, status: string, latencyMs: number, error?: string }>}
   */
  async checkHealth() {
    throw new Error(`checkHealth not implemented on ${this.name}`);
  }
}

module.exports = { EmailProvider };
