'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const router =
  require('../src/routes/userRoutes');

const routeSource =
  fs.readFileSync(
    path.join(
      __dirname,
      '../src/routes/userRoutes.js'
    ),
    'utf8'
  );

function getMethodHandlers(
  routePath,
  method
) {
  const layer =
    router.stack.find(
      (candidate) =>
        candidate.route &&
        candidate.route.path ===
          routePath &&
        candidate.route.methods?.[
          method
        ]
    );

  assert.ok(
    layer,
    `Missing ${method.toUpperCase()} ${routePath}`
  );

  return layer.route.stack
    .filter(
      (candidate) =>
        candidate.method === method
    )
    .map(
      (candidate) =>
        candidate.handle
    );
}

function assertSecureMutationRoute({
  routePath,
  method,
}) {
  const handlers =
    getMethodHandlers(
      routePath,
      method
    );

  assert.ok(
    handlers.length >= 4,
    `${method.toUpperCase()} ${routePath} must include all security guards and its controller.`
  );

  assert.equal(
    handlers[0].name,
    'authorizationMiddleware'
  );

  assert.equal(
    handlers[1].name,
    'requireStepUpAuthentication'
  );

  assert.equal(
    handlers[2].name,
    'requireReason'
  );
}

test('user administration authorization is permanently restricted to MASTER with USER:MANAGE', () => {
  assert.match(
    routeSource,
    /authorize\(\s*'USER:MANAGE'/
  );

  assert.match(
    routeSource,
    /allowedRoles:\s*\['MASTER'\]/
  );

  assert.match(
    routeSource,
    /absoluteRestriction:\s*'MASTER_USER_ADMINISTRATION'/
  );

  assert.match(
    routeSource,
    /targetUserIdResolver:/
  );
});

test('user creation uses the secure user-administration guard chain', () => {
  assertSecureMutationRoute({
    routePath: '/',
    method: 'post',
  });
});

test('user profile updates use the secure user-administration guard chain', () => {
  assertSecureMutationRoute({
    routePath: '/:userId',
    method: 'patch',
  });
});

test('user status changes use the secure user-administration guard chain', () => {
  assertSecureMutationRoute({
    routePath: '/:userId/status',
    method: 'patch',
  });
});

test('user archival uses the secure user-administration guard chain', () => {
  assertSecureMutationRoute({
    routePath: '/:userId/archive',
    method: 'post',
  });
});
