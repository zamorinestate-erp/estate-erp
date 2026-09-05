'use strict';
const memoryFactory = require('./memory');
let mongoFactory = null;
try { mongoFactory = require('./mongo'); } catch (e) { /* mongoose models unavailable in this environment */ }

let current = null;

function initRepositories(mode = process.env.CAFE_OPS_REPO_MODE || 'memory') {
  if (mode === 'mongo') {
    if (!mongoFactory) throw new Error('Mongo repositories requested but the models module could not be loaded.');
    current = mongoFactory.create();
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MEMORY_REPOSITORY_FORBIDDEN_IN_PRODUCTION: In-memory repositories are strictly forbidden in production mode.');
    }
    current = memoryFactory.create();
  }
  return current;
}

function getRepositories() {
  if (!current) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REPOSITORIES_NOT_INITIALIZED: In production, Cafe Operations repositories must be explicitly initialized with Mongo before use.');
    }
    current = memoryFactory.create();
  }
  return current;
}

function resetRepositories() { current = null; }

module.exports = { initRepositories, getRepositories, resetRepositories };

