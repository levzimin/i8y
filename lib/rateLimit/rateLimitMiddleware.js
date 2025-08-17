function getClientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0].trim();
    }
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function createRateLimitMiddleware(tokenBucketLimiter, trustProxy) {
  if (!tokenBucketLimiter) {
    throw new Error('tokenBucketLimiter is required');
  }

  return function rateLimit(req, res, next) {
    const key = getClientIp(req, trustProxy);
    const decision = tokenBucketLimiter.allow(key);

    res.setHeader('X-RateLimit-Limit', String(tokenBucketLimiter.tokenRefillRatePerSecond));
    res.setHeader('X-RateLimit-Burst', String(tokenBucketLimiter.maxTokenCapacityPerIp));
    
    if (decision.allowed) {
      res.setHeader('X-RateLimit-Remaining', String(Math.floor(decision.tokensRemaining)));
      return next();
    }

    res.setHeader('Retry-After', String(decision.retryAfterSeconds));
    return res.status(429).json({ error: 'Rate limit exceeded.' });
  };
}

module.exports = { createRateLimitMiddleware };


