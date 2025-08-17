## i8y – IP to Country service

A small Node.js service that resolves an IPv4 address to its location (country, city). It is datastore‑pluggable (CSV implementation provided) and includes a configurable token‑bucket rate limiter.

Dev notes by Lev:
* Geo-locator: 
  For the sake of simplicity, I'm using a simple in-memory index of IP addresses to country and city. This will work very fast in a single instance of the server running.
  This assumes that the CSV file is small enough to fit in-emory. If we learn that this isn't the case, we can stream the file and cache the results as we go, in a redis cache. 
  In practice, we simply will not be using a file for this, and instead opt for a database or a 3rd party service implementation.
  My implementation also ignores the fact that the CSV file may be updated, and we may need to reload the data. The async __loadFromFile method allows us to reload the data
  either with a file watcher or on a simple interval.
* Rate Limiting: Here, for the sake of the exercise, I've also opted for an in-memory index of the token bucket implementation.
  To allow this to scale, I'd use a redis instead. To do that over redis we'd have to make sure the whole transaction is atomic - I've found a well tested lua script that does this in case we'd want to implement rate limiting for scale too.


### Endpoints
- `GET /v1/find-country?ip=<IPv4>` → `{ country, city }`
- `GET /healthz` → `{ status: "ok", ready: true|false }`

### Run locally
1. Make sure you have a correct .env file (exmple below)
2. npm i
3. npm start

Example `.env` file:
```bash
GEOLOCATION_DATABASE_TYPE=SimpleCsv
SIMPLECSV_PATH=./data/ip2citycountry.csv

# Token Bucket Rate Limits
TOKEN_BUCKET_REFILL_RATE_PER_SEC=0.2
TOKEN_BUCKET_MAX_CAPACITY=1
TRUST_PROXY=true
```

### Tests
To run unit tests, simply:
npm test


### Docker
Build:
docker build -t i8y:latest .

Run (using a local `.env`):
docker run --env-file .env --rm -p 8000:8000 i8y:latest

### CSV format
Header and rows:
```text
ip,city,country
1.2.3.4,Tel Aviv,IL
5.6.7.8,San Francisco,US
```

