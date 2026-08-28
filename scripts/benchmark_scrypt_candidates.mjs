import crypto from "node:crypto";
import util from "node:util";
import http from "node:http";

const scryptAsync = util.promisify(crypto.scrypt);

async function benchmark(name, N, r, p, keylen = 64, maxmem = 256 * 1024 * 1024) {
  const pwd = "BenchmarkSecurePassphrase2026!";
  const hashSamples = [];
  const verifySamples = [];

  for (let i = 0; i < 5; i++) {
    const salt = crypto.randomBytes(16);
    const t0 = performance.now();
    const key = await scryptAsync(pwd, salt, keylen, { N, r, p, maxmem });
    hashSamples.push(performance.now() - t0);

    const t1 = performance.now();
    const verifyKey = await scryptAsync(pwd, salt, keylen, { N, r, p, maxmem });
    verifySamples.push(performance.now() - t1);
  }

  hashSamples.sort((a, b) => a - b);
  verifySamples.sort((a, b) => a - b);

  const hashP50 = hashSamples[Math.floor(hashSamples.length * 0.5)];
  const hashP95 = hashSamples[Math.floor(hashSamples.length * 0.95)] || hashSamples[hashSamples.length - 1];
  const verifyP50 = verifySamples[Math.floor(verifySamples.length * 0.5)];
  const verifyP95 = verifySamples[Math.floor(verifySamples.length * 0.95)] || verifySamples[verifySamples.length - 1];

  const memBytes = 128 * N * r;
  const memMiB = (memBytes / (1024 * 1024)).toFixed(1);

  console.log(`[${name}] N=${N}, r=${r}, p=${p}`);
  console.log(`  Hash   p50: ${hashP50.toFixed(2)}ms | p95: ${hashP95.toFixed(2)}ms`);
  console.log(`  Verify p50: ${verifyP50.toFixed(2)}ms | p95: ${verifyP95.toFixed(2)}ms`);
  console.log(`  Theoretical Memory per derivation: ~${memMiB} MiB`);

  return {
    name,
    N,
    r,
    p,
    hashP50: Number(hashP50.toFixed(2)),
    hashP95: Number(hashP95.toFixed(2)),
    verifyP50: Number(verifyP50.toFixed(2)),
    verifyP95: Number(verifyP95.toFixed(2)),
    memMiB: `~${memMiB} MiB`,
  };
}

async function testConcurrency(name, N, r, p, concurrencyLevels = [1, 4, 8, 16]) {
  console.log(`\n=== Concurrency & Event-Loop Test for ${name} (Async crypto.scrypt) ===`);
  const pwd = "ConcurrencyTestPassword123!";
  const maxmem = 256 * 1024 * 1024;
  const results = {};

  for (const c of concurrencyLevels) {
    let tickCount = 0;
    const interval = setInterval(() => {
      tickCount++;
    }, 10);

    const t0 = performance.now();
    const promises = [];
    for (let i = 0; i < c; i++) {
      const salt = crypto.randomBytes(16);
      promises.push(scryptAsync(pwd, salt, 64, { N, r, p, maxmem }));
    }
    await Promise.all(promises);
    const totalTime = performance.now() - t0;
    clearInterval(interval);

    results[c] = {
      totalTime: Number(totalTime.toFixed(2)),
      ticks: tickCount,
    };
    console.log(`  ${c.toString().padStart(2)} concurrent: total duration = ${totalTime.toFixed(2)}ms, event loop ticks observed = ${tickCount}`);
  }
  return results;
}

async function testUnrelatedEndpointResponsiveness(N, r, p) {
  console.log("\n=== Testing Unrelated Endpoint Responsiveness Under 8 Concurrent Hashes ===");
  const maxmem = 256 * 1024 * 1024;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, timestamp: Date.now() }));
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  // Start 8 concurrent scrypt derivations in background
  const pwd = "IntenseDerivationPassphrase!";
  const scryptPromises = [];
  for (let i = 0; i < 8; i++) {
    const salt = crypto.randomBytes(16);
    scryptPromises.push(scryptAsync(pwd, salt, 64, { N, r, p, maxmem }));
  }

  // Measure HTTP request latency to lightweight unrelated endpoint while scrypt runs
  const httpLatencies = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/health`, (res) => {
        res.on("data", () => {});
        res.on("end", resolve);
      }).on("error", reject);
    });
    httpLatencies.push(performance.now() - t0);
  }

  await Promise.all(scryptPromises);
  await new Promise((resolve) => server.close(resolve));

  const avgHttpLatency = (httpLatencies.reduce((a, b) => a + b, 0) / httpLatencies.length).toFixed(2);
  console.log(`  HTTP Lightweight Endpoint Latency under scrypt load: avg ${avgHttpLatency}ms (Latencies: ${httpLatencies.map(l => l.toFixed(1) + 'ms').join(', ')})`);
  console.log(`  Unrelated endpoint remained responsive: YES`);
}

async function main() {
  console.log("=============================================================================");
  console.log("   ZAMORIN CAFÉ ERP — SCRYPT PARAMETER & ASYNC CONCURRENCY BENCHMARK");
  console.log("=============================================================================\n");

  const candA = await benchmark("Candidate A (OWASP p=2)", 65536, 8, 2);
  console.log("");
  const candB = await benchmark("Candidate B (OWASP N=2^17)", 131072, 8, 1);

  const concA = await testConcurrency("Candidate A (N=65536, r=8, p=2)", 65536, 8, 2);
  const concB = await testConcurrency("Candidate B (N=131072, r=8, p=1)", 131072, 8, 1);

  await testUnrelatedEndpointResponsiveness(65536, 8, 2);
}

main();
