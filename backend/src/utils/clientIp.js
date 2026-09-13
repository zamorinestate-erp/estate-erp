'use strict';

const net = require('net');

const DEFAULT_TRUSTED_PROXIES = Object.freeze([
  'loopback',
  'linklocal',
  'uniquelocal',
]);

/**
 * Validates a single proxy configuration entry.
 * Valid entries are:
 * - 'loopback'
 * - 'linklocal'
 * - 'uniquelocal'
 * - valid IPv4 or IPv6 address
 * - valid IPv4 CIDR (e.g. 10.0.0.0/8) or IPv6 CIDR (e.g. 2001:db8::/32)
 */
function isValidProxyEntry(entry) {
  if (typeof entry !== 'string') return false;
  const trimmed = entry.trim();
  if (!trimmed) return false;

  if (DEFAULT_TRUSTED_PROXIES.includes(trimmed.toLowerCase())) {
    return true;
  }

  if (net.isIP(trimmed) !== 0) {
    return true;
  }

  const parts = trimmed.split('/');
  if (parts.length === 2) {
    const ipType = net.isIP(parts[0]);
    const mask = Number(parts[1]);
    if (Number.isInteger(mask) && String(mask) === parts[1]) {
      if (ipType === 4 && mask >= 0 && mask <= 32) return true;
      if (ipType === 6 && mask >= 0 && mask <= 128) return true;
    }
  }

  return false;
}

/**
 * Parses and validates TRUSTED_PROXY_CIDRS from environment.
 * Throws a configuration error on startup if malformed values are provided.
 */
function getTrustedProxies(envValue = process.env.TRUSTED_PROXY_CIDRS) {
  if (!envValue || typeof envValue !== 'string' || !envValue.trim()) {
    return [...DEFAULT_TRUSTED_PROXIES];
  }

  const entries = envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    if (!isValidProxyEntry(entry)) {
      throw new Error(
        `INVALID_PROXY_CONFIGURATION: Malformed entry in TRUSTED_PROXY_CIDRS: "${entry}". Must be a valid IP address, CIDR block, or keyword (loopback, linklocal, uniquelocal).`
      );
    }
  }

  return Array.from(new Set([...DEFAULT_TRUSTED_PROXIES, ...entries]));
}

/**
 * Resolves the trusted client IP address using Express's proxy-trust chain resolution (req.ip).
 *
 * Express + proxy-addr evaluates the chain from the socket remoteAddress inwards through
 * X-Forwarded-For, trusting only configured proxies and stopping at the first untrusted IP.
 * This ensures external clients cannot spoof client identity by injecting fake X-Forwarded-For headers.
 */
function getTrustedClientIp(request) {
  if (!request) return '127.0.0.1';

  // Always prefer Express's trusted resolution (evaluated against configured trust proxy rules)
  const ip = request.ip || request.socket?.remoteAddress;
  if (typeof ip === 'string' && ip.trim()) {
    return ip.trim();
  }

  return '127.0.0.1';
}

// Canonical alias
const getClientIp = getTrustedClientIp;

module.exports = {
  getTrustedClientIp,
  getClientIp,
  getTrustedProxies,
  isValidProxyEntry,
  DEFAULT_TRUSTED_PROXIES,
};
