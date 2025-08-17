# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Environment defaults (override at runtime as needed)
ENV NODE_ENV=production \
    PORT=8000 \
    GEOLOCATION_DATABASE_TYPE=SimpleCsv \
    SIMPLECSV_PATH=/app/data/ip2citycountry.csv \
    TOKEN_BUCKET_REFILL_RATE_PER_SEC=10 \
    TOKEN_BUCKET_MAX_CAPACITY=10 \
    TRUST_PROXY=false

# Install only prod deps first to leverage layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Run as non-root user provided by the base image
USER node

EXPOSE 8000

# Basic healthcheck using the internal health endpoint
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD node -e "fetch('http://localhost:' + (process.env.PORT||8000) + '/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]


