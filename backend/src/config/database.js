'use strict';

const mongoose = require('mongoose');

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
  maxPoolSize = 10,
  minPoolSize = 0,
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
