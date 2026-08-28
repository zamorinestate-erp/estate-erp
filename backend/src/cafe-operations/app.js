'use strict';
const express = require('express');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/cafe-ops', routes);

  // Never leak stack traces / internal errors to the client (login spec
  // Section 117 / master spec Section 131).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[cafe-ops]', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
  });
  return app;
}

module.exports = { createApp };
