'use strict';

/**
 * Start Production Server with Live Atlas MongoDB Cluster & MaxPoolSize=100
 */

const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

process.env.DNS_SERVERS = '8.8.8.8,1.1.1.1';

process.env.MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://zamorin_admin:Zamestpvt2124@zamorin-cluster.maxooka.mongodb.net/zamorin_cafe_erp?retryWrites=true&w=majority&appName=zamorin-cluster';

process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  '307aba8948b816c1915f7f777ffbdcff641261c02ff4d1dff20d414ac961805f302d4e5a9b2b2f28d96acf587534c055';

process.env.MFA_ENCRYPTION_KEY =
  process.env.MFA_ENCRYPTION_KEY ||
  '010ba86a42ea438bdf4653d6266a98af45524e5817f715667c65e87d0ac9b359';

process.env.NODE_ENV = 'production';
process.env.PORT = '4000';
process.env.HOST = '127.0.0.1';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:4000,http://localhost:3000,http://localhost:5173';
process.env.PRIVATE_STORAGE_DRIVER = 'local';
process.env.RATE_LIMIT_MAX = '50000';
process.env.MONGODB_MAX_POOL_SIZE = '100';
process.env.MONGODB_MIN_POOL_SIZE = '20';

const { startProductionServer } = require('./startProd');

startProductionServer().catch((err) => {
  console.error('[ATLAS SERVER FATAL]', err);
  process.exit(1);
});
