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
    current = memoryFactory.create();
  }
  return current;
}

function getRepositories() {
  if (!current) current = memoryFactory.create();
  return current;
}

function resetRepositories() { current = null; }

module.exports = { initRepositories, getRepositories, resetRepositories };
