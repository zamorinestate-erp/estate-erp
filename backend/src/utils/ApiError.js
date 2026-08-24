'use strict';

class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message, code = 'UNAUTHORIZED', details = null) {
    return new ApiError(401, code, message, details);
  }

  static forbidden(message, code = 'FORBIDDEN', details = null) {
    return new ApiError(403, code, message, details);
  }

  static notFound(message, code = 'NOT_FOUND', details = null) {
    return new ApiError(404, code, message, details);
  }

  static conflict(message, code = 'CONFLICT', details = null) {
    return new ApiError(409, code, message, details);
  }

  static internal(message, code = 'INTERNAL_ERROR', details = null) {
    return new ApiError(500, code, message, details);
  }
}

module.exports = { ApiError };