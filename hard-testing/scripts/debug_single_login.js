'use strict';

const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));

const http = require('node:http');
const mongoose = require('mongoose');
const { seedLoadTestData } = require('./seedLoadTestData');
const { createApp } = require('../../backend/src/server');
const { User } = require('../../backend/src/models/User');

async function debugLogin() {
  process.env.NODE_ENV = 'test';
  process.env.LOAD_TEST_ENV = 'true';
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.JWT_ACCESS_SECRET = 'loadtest-jwt-access-secret-32-chars-minimum!';
  process.env.JWT_REFRESH_SECRET = 'loadtest-jwt-refresh-secret-32-chars-minimum!';

  const mongoUri = 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri);
  await seedLoadTestData();

  const app = createApp({ production: false, test: true });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(4009, r));

  const staffUser = await User.findOne({ email: 'staff1@loadtest.internal' }).select('+passwordHash');
  console.log('Seeded User:', {
    userId: staffUser?.userId,
    email: staffUser?.email,
    org: staffUser?.organisationId,
    status: staffUser?.accountStatus,
    hasPasswordHash: !!staffUser?.passwordHash,
  });

  const res = await fetch('http://localhost:4009/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organisationId: 'LOADTEST_ORG',
      email: 'staff1@loadtest.internal',
      password: 'LoadTestPass123!',
      device: {
        deviceId: 'DEV-001',
        deviceName: 'Debug VU',
        deviceType: 'DESKTOP',
      },
    }),
  });

  const body = await res.json();
  console.log('Login Response Status:', res.status);
  console.log('Login Response Body:', JSON.stringify(body, null, 2));

  server.close();
  await mongoose.disconnect();
}

debugLogin().catch(console.error);
