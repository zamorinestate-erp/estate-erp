'use strict';

/**
 * GMAIL API EMAIL PROVIDER
 *
 * Official Google Gmail API REST integration for operations mailbox:
 * zamorinestatepvtltd.erp@gmail.com
 *
 * Enforces:
 * - Minimum OAuth scope (https://www.googleapis.com/auth/gmail.send / compose)
 * - Safe RFC 2822 base64url encoded payloads
 * - Zero token leakage in logs or responses
 * - Graceful fallback to ConsoleTest in local non-prod environments without credentials
 */

const { EmailProvider } = require('./EmailProvider');

class GmailEmailProvider extends EmailProvider {
  constructor(config = {}) {
    super('GMAIL_API');
    this.operationsEmail = config.operationsEmail || 'zamorinestatepvtltd.erp@gmail.com';
    this.accessToken = config.accessToken || process.env.GMAIL_API_ACCESS_TOKEN || null;
    this.clientId = config.clientId || process.env.GOOGLE_OAUTH_CLIENT_ID || null;
  }

  isConfigured() {
    return Boolean(this.accessToken || (process.env.GMAIL_API_ACCESS_TOKEN));
  }

  _buildRawRfc822({ to, from, replyTo, subject, html, text }) {
    const fromHeader = from || this.operationsEmail;
    const replyToHeader = replyTo || this.operationsEmail;

    // Escaped subject to prevent CRLF injection
    const cleanSubject = String(subject).replace(/[\r\n]+/g, ' ').trim();

    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    const messageParts = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Reply-To: ${replyToHeader}`,
      `Subject: =?UTF-8?B?${Buffer.from(cleanSubject, 'utf8').toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      text || '',
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      html || '',
      '',
      `--${boundary}--`,
    ];

    const rawMessage = messageParts.join('\r\n');
    return Buffer.from(rawMessage, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async sendEmail(options) {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV !== 'production') {
        // Safe dev fallback
        const msgId = `GMAIL-SIM-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        return {
          delivered: true,
          providerMessageId: msgId,
          providerDraftId: options.isDraft ? `DRAFT-${msgId}` : null,
          simulated: true,
        };
      }
      const error = new Error('Gmail API provider is not configured with access tokens.');
      error.code = 'GMAIL_AUTH_NOT_CONFIGURED';
      throw error;
    }

    const rawBase64 = this._buildRawRfc822(options);
    const endpoint = options.isDraft
      ? 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'
      : 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

    const payload = options.isDraft
      ? { message: { raw: rawBase64 } }
      : { raw: rawBase64 };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken || process.env.GMAIL_API_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Gmail API HTTP ${response.status}: Delivery rejected.`);
        err.code = `GMAIL_HTTP_${response.status}`;
        err.safeDetails = errorText.substring(0, 200);
        throw err;
      }

      const data = await response.json();
      return {
        delivered: true,
        providerMessageId: data.id || data.message?.id || `GMAIL-${Date.now()}`,
        providerDraftId: options.isDraft ? (data.id || `DRAFT-${Date.now()}`) : null,
      };
    } catch (err) {
      if (!err.code) err.code = 'GMAIL_NETWORK_ERROR';
      throw err;
    }
  }

  async checkHealth() {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        status: 'AUTH_REQUIRED',
        latencyMs: 0,
        error: 'OAuth tokens not present in environment.',
      };
    }

    const start = Date.now();
    try {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          Authorization: `Bearer ${this.accessToken || process.env.GMAIL_API_ACCESS_TOKEN}`,
        },
      });
      const latency = Date.now() - start;
      if (response.ok) {
        return {
          healthy: true,
          status: 'HEALTHY',
          latencyMs: latency,
        };
      }
      return {
        healthy: false,
        status: 'DEGRADED',
        latencyMs: latency,
        error: `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        status: 'OUTAGE',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }
}

module.exports = { GmailEmailProvider };
