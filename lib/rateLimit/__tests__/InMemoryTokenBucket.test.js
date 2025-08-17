const InMemoryTokenBucket = require('../InMemoryTokenBucket');

describe('InMemoryTokenBucket', () => {
  test('Allows up to burst immediately, then denies with retryAfter', () => {
    const bucket = new InMemoryTokenBucket({ tokenRefillRatePerSecond: 2, maxTokenCapacityPerIp: 3 });
    const key = '1.2.3.4';

    // First three should pass
    expect(bucket.allow(key).allowed).toBe(true);
    expect(bucket.allow(key).allowed).toBe(true);
    expect(bucket.allow(key).allowed).toBe(true);

    // The fourth request should be denied.
    const denied = bucket.allow(key);
    expect(denied.allowed).toBe(false);
    // The retryAfterSeconds should be at least 1 second.
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  test('Refills over time to allow again', async () => {
    jest.useFakeTimers();
    const bucket = new InMemoryTokenBucket({ tokenRefillRatePerSecond: 1, maxTokenCapacityPerIp: 1 });
    const key = '5.6.7.8';

    // Consume token.
    expect(bucket.allow(key).allowed).toBe(true);
    // The next request should be denied now.
    expect(bucket.allow(key).allowed).toBe(false);

    // Advance time by ~1s to allow reffling a token.
    jest.advanceTimersByTime(1000);
    // Force JS timers to run queued callbacks.
    await Promise.resolve();

    // The next request should be allowed again.
    expect(bucket.allow(key).allowed).toBe(true);
    // Restore real timers.
    jest.useRealTimers();
  });

  test('Separate IPs have independent buckets', () => {
    const bucket = new InMemoryTokenBucket({ tokenRefillRatePerSecond: 1, maxTokenCapacityPerIp: 1 });
    const a = '1.1.1.1';
    const b = '2.2.2.2';

    // Consume for A; B should still be allowed
    expect(bucket.allow(a).allowed).toBe(true);
    expect(bucket.allow(a).allowed).toBe(false);
    expect(bucket.allow(b).allowed).toBe(true);
  });

  test('Tokens never exceed capacity and never go negative', () => {
    const bucket = new InMemoryTokenBucket({ tokenRefillRatePerSecond: 1000, maxTokenCapacityPerIp: 2 });
    const key = '9.9.9.9';
    // Repeatedly allow while forcing quick refills
    for (let i = 0; i < 10; i += 1) {
      const decision = bucket.allow(key);
      if (decision.allowed) {
        expect(decision.tokensRemaining).toBeGreaterThanOrEqual(0);
        expect(decision.tokensRemaining).toBeLessThanOrEqual(2);
      }
    }
  });
});


