const { createRateLimitMiddleware } = require('../rateLimitMiddleware');

function createFakeRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: undefined,
    setHeader: (k, v) => { headers[k] = v; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (obj) { this.body = obj; return this; },
    getHeaders: () => headers,
  };
  return res;
}

describe('rateLimitMiddleware', () => {
  test('Allowed request sets headers and calls next()', () => {
    let lastKey = null;
    // Mocking limiter.
    const limiter = {
      tokenRefillRatePerSecond: 5,
      maxTokenCapacityPerIp: 10,
      allow: (key) => { lastKey = key; return { allowed: true, tokensRemaining: 7 }; },
    };

    const middleware = createRateLimitMiddleware(limiter, false);
    const mockRequest = { headers: {}, ip: '10.0.0.1' };
    const mockResponse = createFakeRes();
    let calledNext = false;
    const next = () => { calledNext = true; };

    middleware(mockRequest, mockResponse, next);

    expect(calledNext).toBe(true);
    const headers = mockResponse.getHeaders();
    expect(headers['X-RateLimit-Limit']).toBe('5');
    expect(headers['X-RateLimit-Burst']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe(String(Math.floor(7)));
    expect(lastKey).toBe('10.0.0.1');
  });

  test('Denied request returns 429 and Retry-After', () => {
    // Mocking limiter.
    const limiter = {
      tokenRefillRatePerSecond: 3,
      maxTokenCapacityPerIp: 6,
      allow: () => ({ allowed: false, retryAfterSeconds: 2 }),
    };

    const middleware = createRateLimitMiddleware(limiter, false);
    const mockRequest = { headers: {}, ip: '10.0.0.2' };
    const mockResponse = createFakeRes();

    middleware(mockRequest, mockResponse, () => {});

    expect(mockResponse.statusCode).toBe(429);
    expect(mockResponse.body).toEqual({ error: 'Rate limit exceeded.' });
    const headers = mockResponse.getHeaders();
    expect(headers['X-RateLimit-Limit']).toBe('3');
    expect(headers['X-RateLimit-Burst']).toBe('6');
    expect(headers['Retry-After']).toBe('2');
  });
});


