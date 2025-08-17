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
    this.__reloadTimeoutObject = null;
    this.__reloadIntervalInMs = reloadIntervalMs;
    this.__isInitialized = false;
  }

  async initialize() {
    if (this.__isInitialized) {
      return;
    }

    const isLoaded = await this.__loadFromFile();

    if (!isLoaded) {
      throw new Error(`Failed to load geolocation database from ${this.__csvFilePath}`);
    }

    this.__isInitialized = true;
    this.__scheduleNextCheck();
  }

  async locateByIp(ipAddress) {
    if (!this.__isInitialized) {
      throw new Error('GeoLocator not initialized. Call initialize() first.');
    }

    const hit = this.__ipAddressesMap.get(ipAddress);
    if (!hit) return null;
    return { country: hit.country, city: hit.city };
  }

  async dispose() {
    this.__stopReloadTimeout();
    this.__isInitialized = false;
  }

  /**
   * Schedule the next file check using setTimeout
   */
  __scheduleNextCheck() {
    this.__reloadTimeoutObject = setTimeout(async () => {
      try {
        const stats = await fs.promises.stat(this.__csvFilePath);
        const currentModifiedTime = stats.mtime.getTime();

        if (currentModifiedTime > this.__lastModifiedTime) {
          console.log(`CSV file ${this.__csvFilePath} has been modified, reloading...`);
          const success = await this.__loadFromFile();
          if (success) {
            this.__lastModifiedTime = currentModifiedTime;
          } else {
            console.error(`Failed to reload file ${this.__csvFilePath}`);
          }
        }
      } catch (error) {
        console.error(`Error checking file modification time for ${this.__csvFilePath}:`, error);
      }

      // Schedule the next check only after this one completes AND if still initialized
      if (this.__isInitialized) {
        this.__scheduleNextCheck();
      }
    }, this.__reloadIntervalInMs);
  }

  /**
   * Stop the reload timeout
   */
  __stopReloadTimeout() {
    if (this.__reloadTimeoutObject) {
      clearTimeout(this.__reloadTimeoutObject);
      this.__reloadTimeoutObject = null;
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


