'use strict';

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = Number(error.statusCode || error.status || 500);
  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message:
        statusCode === 500 && isProduction
          ? 'An unexpected server error occurred.'
          : error.message || 'An unexpected server error occurred.',
    },
    correlationId: req.correlationId || null,
    ...(!isProduction && error.stack ? { stack: error.stack } : {}),
  });
}

module.exports = { errorHandler };