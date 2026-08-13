const path = require('node:path');
module.paths.push(path.join(__dirname, '../../backend/node_modules'));
const mongoose = require('mongoose');

const { SequenceCounter } = require('../../backend/src/models/SequenceCounter');

async function main() {
  process.env.NODE_ENV = 'test';
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zamorin_loadtest';
  await mongoose.connect(mongoUri, { maxPoolSize: 100 });

  const ORG_ID = 'TEST_SEQ_ORG';
  const SEQ_KEY = 'TEST_CONCURRENT_SEQ_20260814';

  console.log(`[SEQ TEST] Purging existing sequence counters for ${ORG_ID}...`);
  await SequenceCounter.deleteMany({ organisationId: ORG_ID });

  console.log(`[SEQ TEST] Executing 1,000 simultaneous SequenceCounter.generateId calls...`);
  const start = Date.now();

  const promises = Array.from({ length: 1000 }, (_, i) => SequenceCounter.generateId({
    organisationId: ORG_ID,
    sequenceKey: SEQ_KEY,
    prefix: 'AT-20260814',
    minimumDigits: 4,
  }));

  const generatedIds = await Promise.all(promises);
  const duration = Date.now() - start;

  console.log(`[SEQ TEST COMPLETE] 1,000 sequence IDs generated in ${duration}ms`);

  const uniqueIds = new Set(generatedIds);
  const duplicateCount = generatedIds.length - uniqueIds.size;

  // Extract numerical suffixes
  const numbers = generatedIds.map((id) => parseInt(id.split('-').pop(), 10)).sort((a, b) => a - b);
  const minNum = numbers[0];
  const maxNum = numbers[numbers.length - 1];

  let skippedCount = 0;
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      skippedCount++;
    }
  }

  console.log(`\n================================================================================`);
  console.log(`SEQUENCE COUNTER CONCURRENCY AUDIT REPORT`);
  console.log(`================================================================================`);
  console.log(`Total Generated:   ${generatedIds.length}`);
  console.log(`Unique Values:     ${uniqueIds.size}`);
  console.log(`Duplicates:        ${duplicateCount}`);
  console.log(`Min Number:        ${minNum}`);
  console.log(`Max Number:        ${maxNum}`);
  console.log(`Skipped Values:    ${skippedCount}`);
  console.log(`Test Result:       ${duplicateCount === 0 && uniqueIds.size === 1000 && minNum === 1 && maxNum === 1000 ? 'PASS' : 'FAIL'}`);

  await mongoose.disconnect();
  process.exit(duplicateCount === 0 && uniqueIds.size === 1000 ? 0 : 1);
}

main().catch((err) => {
  console.error('[SEQ TEST ERROR]', err);
  mongoose.disconnect();
  process.exit(1);
});
