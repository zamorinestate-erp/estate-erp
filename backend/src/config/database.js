'use strict';

const dns = require('dns');
const mongoose = require('mongoose');

// Force IPv4-first DNS resolution order (required for MongoDB Atlas SRV on some
// platforms where IPv6-first ordering causes ECONNREFUSED on the SRV query).
dns.setDefaultResultOrder('ipv4first');

// Optional: allow the operator to override DNS servers via environment variable
// e.g. DNS_SERVERS=8.8.8.8,1.1.1.1
const customDnsServers = (process.env.DNS_SERVERS || '').split(',').map(s => s.trim()).filter(Boolean);
if (customDnsServers.length > 0) {
  dns.setServers(customDnsServers);
}

const DATABASE_STATES = Object.freeze({
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
});

function getDatabaseState() {
  const readyState = mongoose.connection.readyState;

  return {
    readyState,
    status:
      DATABASE_STATES[readyState] ||
      'unknown',
  };
}

async function connectDatabase({
  uri,
  serverSelectionTimeoutMs = 10000,
  maxPoolSize = 100,
  minPoolSize = 10,
} = {}) {
  if (
    typeof uri !== 'string' ||
    !uri.trim()
  ) {
    throw new Error(
      'MONGODB_URI is required.'
    );
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS:
      serverSelectionTimeoutMs,
    maxPoolSize,
    minPoolSize,
  });

  return mongoose.connection;
}

async function disconnectDatabase() {
  if (
    mongoose.connection.readyState === 0
  ) {
    return;
  }

  await mongoose.disconnect();
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseState,
};
