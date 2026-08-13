'use strict';

/**
 * CONCURRENT LOGIN STORM & BOOTSTRAP LOAD SCENARIO
 * 
 * Target: Simulates 500+ STAFF/ADMIN authentication & bootstrap load flows.
 * Metrics Captured: login success rate, p50/p95/p99 latency, 4xx/5xx errors.
 */

const http = require('node:http');

const API_BASE_URL = process.env.LOAD_TEST_API_URL || 'http://localhost:4000/api/v1';

async function simulateUserSession({ email, password, thinkTimeMs = 1000 }) {
  const startTime = Date.now();

  try {
    // Step 1: Login
    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginLatency = Date.now() - startTime;

    if (!loginRes.ok) {
      return { success: false, status: loginRes.status, latency: loginLatency, phase: 'LOGIN' };
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken;
    const cookie = loginRes.headers.get('set-cookie');

    // Human think time simulation
    if (thinkTimeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, thinkTimeMs));
    }

    // Step 2: Session Bootstrap /auth/me
    const meStart = Date.now();
    const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: cookie || '',
      },
    });

    const meLatency = Date.now() - meStart;

    if (!meRes.ok) {
      return { success: false, status: meRes.status, latency: loginLatency + meLatency, phase: 'ME' };
    }

    return {
      success: true,
      status: 200,
      totalLatency: loginLatency + meLatency,
      loginLatency,
      meLatency,
    };
  } catch (err) {
    return { success: false, status: 0, error: err.message, latency: Date.now() - startTime, phase: 'NETWORK' };
  }
}

module.exports = {
  simulateUserSession,
};
