'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { connectDatabase } = require('./config/database');
const { requestContext } = require('./middleware/requestContext');
const { notFound } = require('./middleware/notFound');
const app = express();
const PORT = Number(process.env.PORT) || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
app.disable('x-powered-by');
app.use(requestContext);
app.use(cookieParser());
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true }));
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api/', apiLimiter);
app.get('/api/v1/health', (req, res) => res.status(200).json({ status: 'ok', service: 'zamorin-cafe-erp-api' }));
app.get('/api/v1/readiness', (req, res) => { const ready = mongoose.connection.readyState === 1; res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected' }); });
app.use(notFound);
const MONGODB_URI = process.env.MONGODB_URI || '';
async function startServer() {
      if (!MONGODB_URI) throw new Error('MONGODB_URI is required.');
        await connectDatabase(MONGODB_URI);
          app.listen(PORT, () => console.log(`Zamorin Cafe ERP API running on port ${PORT} in ${NODE_ENV} mode.`));
          }
          startServer().catch((error) => {
              console.error('Backend startup failed:', error.message);
                process.exitCode = 1;
                });
