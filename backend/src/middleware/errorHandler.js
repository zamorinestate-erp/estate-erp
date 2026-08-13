'use strict';

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = Number(error.statusCode || error.status || 500);
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected server error occurred.';

  // MongoDB E11000 Duplicate Key Error domain-aware translation
  if (error.code === 11000 || error.name === 'MongoServerError') {
    statusCode = 409;
    const errStr = String(error.message || '').toLowerCase();
    const reqPath = String(req.originalUrl || req.url || '').toLowerCase();

    if (errStr.includes('attendance') || errStr.includes('businessdate') || reqPath.includes('/attendance')) {
      code = 'ATTENDANCE_ALREADY_EXISTS';
      message = 'Attendance record already exists for today.';
    } else if (errStr.includes('email') || errStr.includes('userid') || reqPath.includes('/users')) {
      code = 'USER_ALREADY_EXISTS';
      message = 'A user account with this email or ID already exists.';
    } else if (errStr.includes('vendorid') || reqPath.includes('/vendors')) {
      code = 'VENDOR_ALREADY_EXISTS';
      message = 'A vendor record with this ID already exists.';
    } else {
      code = 'DUPLICATE_KEY_CONFLICT';
      message = 'A record with this unique key already exists.';
    }
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