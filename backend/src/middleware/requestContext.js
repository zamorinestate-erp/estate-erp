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

  response.setHeader(
    'x-correlation-id',
    correlationId
  );

  next();
}

module.exports = {
  requestContext,
};