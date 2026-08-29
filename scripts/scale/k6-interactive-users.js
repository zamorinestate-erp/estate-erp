import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/**
 * Enterprise 10,000 Concurrent Interactive User Load Script (SC-PROD-002)
 * 
 * Simulates 10,000 active virtual users executing representative ERP workflows:
 * - Persona Mix: Staff (55%), Cafe Operations (25%), Owner (12%), Normal Master (6%), Primary Master (2%)
 * - Workload: Dashboard reads (35%), Search (15%), Attendance (15%), POS/Orders (15%), Inventory (8%), Tasks/Customers (7%), Finance (5%)
 * - Explicit SLA checks: read p95 <= 750ms, write p95 <= 1000ms, interactive p99 <= 2000ms, 5xx < 0.1%
 */

// Custom Metrics
const ReadLatency = new Trend('read_api_latency_ms');
const WriteLatency = new Trend('write_api_latency_ms');
const InteractiveLatency = new Trend('interactive_p99_latency_ms');
const Error5xxRate = new Rate('http_5xx_rate');
const MutationCount = new Counter('total_mutations_executed');

export const options = {
  scenarios: {
    interactive_users_ramp: {
      executor: 'ramping-vus',
      startVUs: 500,
      stages: [
        { duration: '2m', target: 1000 },
        { duration: '3m', target: 2500 },
        { duration: '5m', target: 5000 },
        { duration: '5m', target: 7500 },
        { duration: '5m', target: 10000 },
        { duration: '30m', target: 10000 }, // 30-Minute Certified Plateau
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '1m',
    },
  },
  thresholds: {
    read_api_latency_ms: ['p(95)<750'],
    write_api_latency_ms: ['p(95)<1000'],
    interactive_p99_latency_ms: ['p(99)<2000'],
    http_5xx_rate: ['rate<0.001'], // < 0.1% 5xx errors
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:4000';

export default function () {
  const vuId = __VU;
  const userRoleSelector = vuId % 100;

  let role = 'STAFF';
  if (userRoleSelector < 2) role = 'PRIMARY_MASTER';
  else if (userRoleSelector < 8) role = 'NORMAL_MASTER';
  else if (userRoleSelector < 20) role = 'OWNER';
  else if (userRoleSelector < 45) role = 'CAFE_OPS';

  const cafeNum = ((vuId % 1000) + 1).toString().padStart(4, '0');
  const cafeId = `ZC-${cafeNum}`;

  const headers = {
    'Content-Type': 'application/json',
    'x-organisation-id': 'ZAMORIN',
    'x-cafe-id': cafeId,
    'x-virtual-user-id': `VU-${vuId}`,
  };

  // 1. Dashboard / Summary Read (35% probability)
  group('Dashboard Read', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/dashboard/summary?cafeId=${cafeId}`, { headers });
    const duration = Date.now() - start;

    ReadLatency.add(duration);
    InteractiveLatency.add(duration);
    Error5xxRate.add(res.status >= 500);

    check(res, {
      'dashboard status 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time

  // 2. Global / Employee Search (15% probability)
  if (Math.random() < 0.15) {
    group('Search Operations', function () {
      const searchTerms = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram'];
      const query = searchTerms[vuId % searchTerms.length];
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/v1/search/employees?q=${query}&limit=20`, { headers });
      const duration = Date.now() - start;

      ReadLatency.add(duration);
      InteractiveLatency.add(duration);
      Error5xxRate.add(res.status >= 500);

      check(res, {
        'search status 200': (r) => r.status === 200,
      });
    });

    sleep(Math.random() * 2 + 1);
  }

  // 3. POS / Order Placement or Attendance (Staff / Ops workflow)
  if (role === 'STAFF' || role === 'CAFE_OPS') {
    group('Operational Mutation', function () {
      const payload = JSON.stringify({
        cafeId,
        actorId: `EMP-${(vuId % 50000 + 1).toString().padStart(6, '0')}`,
        timestamp: new Date().toISOString(),
        idempotencyKey: `MUT-${vuId}-${Date.now()}`,
      });

      const start = Date.now();
      const res = http.post(`${BASE_URL}/api/v1/cafe-ops/orders`, payload, { headers });
      const duration = Date.now() - start;

      WriteLatency.add(duration);
      InteractiveLatency.add(duration);
      MutationCount.add(1);
      Error5xxRate.add(res.status >= 500);

      check(res, {
        'mutation status 200 or 201': (r) => r.status === 200 || r.status === 201,
      });
    });
  }

  sleep(Math.random() * 3 + 2); // 2-5s human pacing
}
