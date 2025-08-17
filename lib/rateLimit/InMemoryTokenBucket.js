
/**
 * A simple in-memory token bucket implementation.
 */
class InMemoryTokenBucket {
  constructor({ tokenRefillRatePerSecond, maxTokenCapacityPerIp }) {
    if (!Number.isFinite(tokenRefillRatePerSecond) || tokenRefillRatePerSecond <= 0) {
      throw new Error('tokenRefillRatePerSecond must be a positive number.');
    }

    if (!Number.isFinite(maxTokenCapacityPerIp) || maxTokenCapacityPerIp <= 0) {
      throw new Error('maxTokenCapacityPerIp must be a positive number.');
    }

    this.tokenRefillRatePerSecond = tokenRefillRatePerSecond;
    this.maxTokenCapacityPerIp = maxTokenCapacityPerIp;
    this.__bucketsByIp = new Map();
  }

  allow(key) {
    // Taking timestamp of now early for the refill calculation.
    const nowMs = Date.now();
    let bucketForIp = this.__bucketsByIp.get(key);

    // Creating a bucket for the given ip address if it doesn't exist, with the max capacity tokens number.
    if (!bucketForIp) {
      bucketForIp = { tokens: this.maxTokenCapacityPerIp, lastRefillMs: nowMs };
      this.__bucketsByIp.set(key, bucketForIp);
    }

    // Using the opportunity to refill the bucket as needed.
    const elapsedMs = Math.max(0, nowMs - bucketForIp.lastRefillMs);
    const refill = (elapsedMs / 1000) * this.tokenRefillRatePerSecond;
    // Refilling at most up to the max capacity.
    bucketForIp.tokens = Math.min(this.maxTokenCapacityPerIp, bucketForIp.tokens + refill);
    bucketForIp.lastRefillMs = nowMs;

    if (bucketForIp.tokens >= 1) {
      bucketForIp.tokens -= 1;
      return { allowed: true, tokensRemaining: bucketForIp.tokens };
    }

    const needed = 1 - bucketForIp.tokens;
    const waitSeconds = needed / this.tokenRefillRatePerSecond;
    return { allowed: false, retryAfterSeconds: Math.ceil(waitSeconds) };
  }
}

module.exports = InMemoryTokenBucket;


