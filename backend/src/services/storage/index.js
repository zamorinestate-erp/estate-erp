'use strict';

const { DocumentStorageProvider } = require('./DocumentStorageProvider');
const { S3CompatibleStorageAdapter } = require('./S3CompatibleStorageAdapter');
const { LocalDevelopmentStorageAdapter } = require('./LocalDevelopmentStorageAdapter');
const { ApiError } = require('../../utils/ApiError');

/**
 * ZAMORIN CAFÉ ERP — STORAGE PROVIDER FACTORY
 * 
 * Selects and instantiates the canonical document storage provider.
 * Enforces production invariants:
 * - Local storage is prohibited in production.
 * - Missing cloud object store credentials in production fails closed.
 */

function createStorageProvider(options = {}, env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const driver = (options.driver || env.DOCUMENT_STORAGE_PROVIDER || env.DOCUMENT_STORAGE_DRIVER || (isProd ? 's3' : 'local')).toLowerCase();

  if (isProd && (driver === 'local' || driver === 'render_persistent_disk')) {
    if (!options.allowLocalInProdForTesting) {
      throw new ApiError(
        500,
        'PROD_EPHEMERAL_STORAGE_DISALLOWED',
        'Production canonical business documents must use private durable external object storage (S3 / R2 / MinIO). Ephemeral and local filesystems are strictly disallowed.'
      );
    }
  }

  if (driver === 's3' || driver === 's3_compatible' || driver === 'private_object_storage') {
    const adapter = new S3CompatibleStorageAdapter(options);
    adapter.validateConfiguration(env);
    return adapter;
  }

  if (driver === 'local' || driver === 'local_dev' || driver === 'render_persistent_disk') {
    const adapter = new LocalDevelopmentStorageAdapter(options);
    adapter.validateConfiguration(env);
    return adapter;
  }

  throw new ApiError(500, 'UNSUPPORTED_STORAGE_PROVIDER', `Unsupported document storage driver: ${driver}`);
}

module.exports = {
  DocumentStorageProvider,
  S3CompatibleStorageAdapter,
  LocalDevelopmentStorageAdapter,
  createStorageProvider,
};
