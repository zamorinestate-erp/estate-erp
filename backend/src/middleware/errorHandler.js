'use strict';

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = Number(error.statusCode || error.status || 500);
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected server error occurred.';

  // MongoDB E11000 Duplicate Key Error translation
  if (error.code === 11000 || error.name === 'MongoServerError') {
    statusCode = 409;
    code = 'ATTENDANCE_ALREADY_EXISTS';
    message = 'Attendance record already exists for today.';
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message:
        statusCode === 500 && isProduction
          ? 'An unexpected server error occurred.'
          : message,
    },
    correlationId: req.correlationId || null,
    ...(!isProduction && error.stack ? { stack: error.stack } : {}),
  });
}

module.exports = { errorHandler };