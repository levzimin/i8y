const express = require('express');
const dotenv = require('dotenv');
const net = require('net');
const InMemoryTokenBucket = require('./lib/rateLimit/InMemoryTokenBucket');
const { createGeoLocator } = require('./lib/geolocator/GeoLocatorFactory');
const { createRateLimitMiddleware } = require('./lib/rateLimit/rateLimitMiddleware');

dotenv.config();

const app = express();

const port = process.env.PORT || 8000;

/**
 * Dev note:
 * When having multiple instances, we should switch to a redis implementation or better yet - a rate limiting service.
 * If we want more than one limit at a time, we can create an interface for a rate limiter and have multiple implementations running depending on a configuration.
 */
const tokenBucketLimiter = new InMemoryTokenBucket({
  tokenRefillRatePerSecond: Number(process.env.TOKEN_BUCKET_REFILL_RATE_PER_SEC || 10),
  maxTokenCapacityPerIp: Number(process.env.TOKEN_BUCKET_MAX_CAPACITY || 10),
});

const trustProxy = String(process.env.TRUST_PROXY || 'false').toLowerCase() === 'true';

if (trustProxy) app.set('trust proxy', true);
app.use(createRateLimitMiddleware(tokenBucketLimiter, trustProxy));

// Initialized in the bootstrap method below.
let geoLocator;

// Liveness/Readiness probe
app.get('/healthz', (req, res) => {
  return res.status(200).json({ status: 'ok', ready: Boolean(geoLocator) });
});

/**
 * ip2country endpoint. Allows for an 'ip' query parameter.
 * Must be an ipv4 ip address.
 */
app.get('/v1/find-country', async (req, res) => {
  const query = req.query || {};
  const queryKeys = Object.keys(query);

  if (queryKeys.length !== 1 || !Object.prototype.hasOwnProperty.call(query, 'ip')) {
    return res.status(400).json({ error: "Query must contain exactly one 'ip' parameter" });
  }

  const ipAddress = query.ip;

  if (!net.isIPv4(ipAddress)) {
    return res.status(400).json({ error: 'Must be a valid ipv4 address.' });
  }

  try {
    const result = await geoLocator.locateByIp(ipAddress);

    if (!result) {
      return res.status(404).json({ error: 'IP not found.' });
    }

    return res.status(200).json({ country: result.country, city: result.city });
  } catch (err) {
    return res.status(500).json({ error: 'Could not locate IP address, please try again later.' });
  }
});

// Bootstrap method, ensuring geolocation database loads before accepting traffic.
(async () => {
  try {
    geoLocator = await createGeoLocator();
  } catch (err) {
    console.error('Failed to initialize geolocation database:', err);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`i8y listening on port ${port}`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal) => {
    if (geoLocator) {
      try {
        await geoLocator.dispose();
        console.log('Geolocator disposed successfully');
      } catch (err) {
        console.error('Error disposing geolocator:', err);
      }
    }

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();

module.exports = app;


