'use strict';

const fs = require('fs');
const path = require('path');

const jsonPath = path.resolve(__dirname, '../../config/cafeOpsR02Indexes.json');
const CAFE_OPS_R02_INDEXES = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

module.exports = {
  CAFE_OPS_R02_INDEXES,
};
