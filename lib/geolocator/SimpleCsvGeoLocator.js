const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const GeoLocator = require('./GeoLocator');

/**
 * CSV format (with header): ip,city,country
 * 
 * Example:
 * 1.2.3.4,Tel Aviv,IL
 * 5.6.7.8,San Francisco,US
 * 
 * Dev note: For the sake of simplicity, we're using a simple in-memory index of IP addresses to country and city.
 * This assumes that the CSV file is small enough to fit in memory. If we learn that this isn't the case, we can stream the file and cache the results
 * as we go in a redis cache. In practice, we simply will not be using a file this way and instead use a database or another service implementation.
 * This also ignores the fact that the CSV file may be updated, and we may need to reload the data. The async __loadFromFile method allows us to reload the data
 * either with a file watcher or on a simple interval.
 */
class SimpleCsvGeoLocator extends GeoLocator {
  constructor(csvFilePath, { reloadIntervalMs = 30000 } = {}) {
    super();

    if (!csvFilePath) {
      throw new Error('SimpleCsvGeoLocator requires a csvFilePath');
    }

    if (!Number.isFinite(reloadIntervalMs) || reloadIntervalMs <= 0) {
      throw new Error('reloadIntervalMs must be a positive number.');
    }

    // An in-memory index of IP addresses to country and city.
    this.__ipAddressesMap = new Map();
    this.__csvFilePath = path.resolve(csvFilePath);
    
    // File watching properties
    this.__lastModifiedTime = 0;
    this.__reloadIntervalObject = null;
    this.__reloadIntervalInMs = reloadIntervalMs;
  }

  async initialize() {
    const isLoaded = await this.__loadFromFile();

    if (!isLoaded) {
      throw new Error(`Failed to load geolocation database from ${this.__csvFilePath}`);
    }

    // Start the reload interval
    this.__startReloadInterval();
  }

  async locateByIp(ipAddress) {
    const hit = this.__ipAddressesMap.get(ipAddress);
    if (!hit) return null;
    return { country: hit.country, city: hit.city };
  }

  async dispose() {
    this.__stopReloadInterval();
  }

  /**
   * Start the reload interval that checks for file changes every 30 seconds
   */
  __startReloadInterval() {
    if (this.__reloadIntervalObject) {
      clearInterval(this.__reloadIntervalObject);
    }

    this.__reloadIntervalObject = setInterval(async () => {
      try {
        const stats = await fs.promises.stat(this.__csvFilePath);
        const currentModifiedTime = stats.mtime.getTime();

        if (currentModifiedTime > this.__lastModifiedTime) {
          console.log(`CSV file ${this.__csvFilePath} has been modified, reloading...`);
          await this.__loadFromFile();
          this.__lastModifiedTime = currentModifiedTime;
        }
      } catch (error) {
        console.error(`Error checking file modification time for ${this.__csvFilePath}:`, error);
      }
    }, this.__reloadIntervalInMs);
  }

  /**
   * Stop the reload interval
   */
  __stopReloadInterval() {
    if (this.__reloadIntervalObject) {
      clearInterval(this.__reloadIntervalObject);
      this.__reloadIntervalObject = null;
    }
  }

  /**
   * @returns {Promise<boolean>} - True if the file was loaded successfully, false otherwise.
   */
  async __loadFromFile() {
    try {
      const content = await fs.promises.readFile(this.__csvFilePath, 'utf8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      this.__ipAddressesMap.clear();

      for (let i = 0; i < records.length; i += 1) {
        const row = records[i];

        if (!row || !row.ip) continue;

        this.__ipAddressesMap.set(String(row.ip).trim(), {
          country: String(row.country || '').trim(),
          city: String(row.city || '').trim(),
        });
      }

      // Update the last modified time after successful load
      const stats = await fs.promises.stat(this.__csvFilePath);
      this.__lastModifiedTime = stats.mtime.getTime();

      return true;
    }
    catch (error) {
      console.error(`Error loading geolocation database from ${this.__csvFilePath}:`, error);
      return false;
    }
  }
}

module.exports = SimpleCsvGeoLocator;


