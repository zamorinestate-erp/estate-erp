'use strict';

const crypto = require('crypto');

function normalizeCorrelationId(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();

  if (
    !normalizedValue ||
    normalizedValue.length > 150 ||
    !/^[A-Za-z0-9._:-]+$/.test(normalizedValue)
  ) {
    return null;
  }

  return normalizedValue;
}

function requestContext(request, response, next) {
  const suppliedCorrelationId =
    normalizeCorrelationId(
      request.get('x-correlation-id')
    );

  const correlationId =
    suppliedCorrelationId ||
    crypto.randomUUID();

  request.correlationId = correlationId;
  request.requestStartedAt = new Date();

  const startTime = process.hrtime.bigint();
  const originalEnd = response.end;
  response.end = function (...args) {
    if (!response.headersSent) {
      const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      response.setHeader('Server-Timing', `total;dur=${elapsedMs.toFixed(2)}`);
    }
    return originalEnd.apply(this, args);
  };

  next();
}

module.exports = {
  requestContext,
};