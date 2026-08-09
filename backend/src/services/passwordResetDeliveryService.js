'use strict';

function isDevelopmentCodeLoggingEnabled() {
  return process.env.NODE_ENV !== 'production' &&
    String(process.env.PASSWORD_RESET_DEV_LOG_CODE || '').trim().toLowerCase() === 'true';
}

function isPasswordResetDeliveryAvailable() {
  return isDevelopmentCodeLoggingEnabled();
}

async function deliverPasswordResetCode({ recipientEmail, code, challengeId }) {
  if (!recipientEmail || !code || !challengeId) {
    throw new Error('Password reset delivery requires recipient email, code and challenge ID.');
  }

  if (isDevelopmentCodeLoggingEnabled()) {
    console.info('[PASSWORD_RESET_DEV] challenge=%s recipient=%s code=%s', challengeId, recipientEmail, code);
    return {
      delivered: true,
      channel: 'DEVELOPMENT_LOG',
      providerMessageId: null,
    };
  }

  return {
    delivered: false,
    channel: null,
    providerMessageId: null,
    reason: 'PASSWORD_RESET_DELIVERY_NOT_CONFIGURED',
  };
}

module.exports = {
  isDevelopmentCodeLoggingEnabled,
  isPasswordResetDeliveryAvailable,
  deliverPasswordResetCode,
};
