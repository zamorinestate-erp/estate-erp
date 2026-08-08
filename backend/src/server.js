'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const {
  connectDatabase,
  disconnectDatabase,
  getDatabaseState,
} = require('./config/database');

const {
  loadEnvironment,
} = require('./config/environment');

const {
  requestContext,
} = require('./middleware/requestContext');

const {
  notFound,
} = require('./middleware/notFound');

const {
  errorHandler,
} = require('./middleware/errorHandler');

const apiRouter = require('./routes');

const SERVICE_NAME =
  'zamorin-cafe-erp-api';

function createCorsOptions(environment) {
  const allowedOrigins =
    new Set(environment.allowedOrigins);

  return {
    credentials: true,

    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.has(origin)
      ) {
        callback(null, true);
        return;
      }

      const error = new Error(
        'The request origin is not allowed.'
      );

      error.statusCode = 403;
      error.code = 'CORS_ORIGIN_DENIED';

      callback(error);
    },

    optionsSuccessStatus: 204,
  };
}

const CSRF_SAFE_METHODS = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
]);

const AUTHENTICATION_COOKIE_NAMES = [
  'zamorin_access_token',
  'zamorin_refresh_token',
  'zamorin_session_id',
];

function sendCsrfOriginError(response, request, code, message) {
  return response.status(403).json({
    success: false,
    error: {
      code,
      message,
    },
    correlationId:
      request.correlationId || null,
  });
}

function createCsrfOriginProtection(environment) {
  const allowedOrigins = new Set(
    environment.allowedOrigins || []
  );

  return function csrfOriginProtection(request, response, next) {
    if (CSRF_SAFE_METHODS.has(request.method)) {
      return next();
    }

    const hasAuthenticationCookie =
      AUTHENTICATION_COOKIE_NAMES.some(function hasCookie(name) {
        return Boolean(
          request.cookies && request.cookies[name]
        );
      });

    if (!hasAuthenticationCookie) {
      return next();
    }

    const origin = request.get('origin');

    if (!origin) {
      return sendCsrfOriginError(
        response,
        request,
        'CSRF_ORIGIN_REQUIRED',
        'An allowed request origin is required for cookie-authenticated state changes.'
      );
    }

    let normalizedOrigin;

    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      return sendCsrfOriginError(
        response,
        request,
        'CSRF_ORIGIN_DENIED',
        'The request origin is not allowed.'
      );
    }

    if (!allowedOrigins.has(normalizedOrigin)) {
      return sendCsrfOriginError(
        response,
        request,
        'CSRF_ORIGIN_DENIED',
        'The request origin is not allowed.'
      );
    }

    return next();
  };
}

function createApp(environment) {
  const app = express();

  app.disable('x-powered-by');

  if (environment.production) {
    app.set('trust proxy', 1);
  }

  app.use(requestContext);
  app.use(cookieParser());
  app.use(helmet());
  app.use(
    express.json({
      limit: '1mb',
    })
  );
  app.use(
    cors(
      createCorsOptions(environment)
    )
  );
  app.use(
    createCsrfOriginProtection(environment)
  );

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  app.get(
    '/api/v1/health',
    (request, response) =>
      response.status(200).json({
        success: true,
        status: 'ok',
        service: SERVICE_NAME,
        timestamp:
          new Date().toISOString(),
        correlationId:
          request.correlationId || null,
      })
  );

  app.get(
    '/api/v1/readiness',
    (request, response) => {
      const database =
        getDatabaseState();

      const ready =
        database.readyState === 1;

      return response
        .status(ready ? 200 : 503)
        .json({
          success: ready,
          status: ready
            ? 'ready'
            : 'not_ready',
          service: SERVICE_NAME,
          database: database.status,
          timestamp:
            new Date().toISOString(),
          correlationId:
            request.correlationId || null,
        });
    }
  );

  app.use('/api/', apiLimiter);
  app.use('/api/v1', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

async function listen(
  app,
  {
    host,
    port,
  }
) {
  return new Promise(
    (resolve, reject) => {
      const server = app.listen(
        port,
        host,
        () => resolve(server)
      );

      server.once('error', reject);
    }
  );
}

async function startServer() {
  const environment =
    loadEnvironment();

  await connectDatabase({
    uri: environment.mongodbUri,
    serverSelectionTimeoutMs:
      environment
        .mongodbServerSelectionTimeoutMs,
    maxPoolSize:
      environment.mongodbMaxPoolSize,
    minPoolSize:
      environment.mongodbMinPoolSize,
  });

  const app =
    createApp(environment);

  const server =
    await listen(app, {
      host: environment.host,
      port: environment.port,
    });

  console.log(
    `Zamorin Cafe ERP API running on ${environment.host}:${environment.port} in ${environment.nodeEnvironment} mode.`
  );

  return {
    app,
    server,
    environment,
  };
}

function closeHttpServer(
  server,
  timeoutMs = 10000
) {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise(
    (resolve, reject) => {
      const forceCloseTimer =
        setTimeout(() => {
          if (
            typeof server
              .closeAllConnections ===
            'function'
          ) {
            server
              .closeAllConnections();
          }
        }, timeoutMs);

      forceCloseTimer.unref();

      server.close((error) => {
        clearTimeout(
          forceCloseTimer
        );

        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    }
  );
}

function registerShutdownHandlers(
  server
) {
  let shutdownPromise = null;

  const shutdown = (signal) => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      console.log(
        `${signal} received; shutting down safely.`
      );

      await closeHttpServer(server);
      await disconnectDatabase();

      console.log(
        'Zamorin Cafe ERP API stopped.'
      );
    })();

    return shutdownPromise;
  };

  for (const signal of [
    'SIGTERM',
    'SIGINT',
  ]) {
    process.once(signal, () => {
      shutdown(signal)
        .then(() => {
          process.exitCode = 0;
        })
        .catch((error) => {
          console.error(
            'Backend shutdown failed:',
            error.message
          );

          process.exitCode = 1;
        });
    });
  }

  return shutdown;
}

async function runMain() {
  try {
    const {
      server,
    } = await startServer();

    registerShutdownHandlers(
      server
    );
  } catch (error) {
    try {
      await disconnectDatabase();
    } catch (disconnectError) {
      console.error(
        'Database cleanup failed:',
        disconnectError.message
      );
    }

    console.error(
      'Backend startup failed:',
      error.message
    );

    process.exitCode = 1;
  }
}

if (require.main === module) {
  runMain();
}

module.exports = {
  createApp,
  createCorsOptions,
  closeHttpServer,
  registerShutdownHandlers,
  startServer,
};
