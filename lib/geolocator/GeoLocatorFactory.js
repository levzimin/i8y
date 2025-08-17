const SimpleCsvGeoLocator = require('./SimpleCsvGeoLocator');

async function createGeoLocator() {
  const type = process.env.GEOLOCATION_DATABASE_TYPE || 'SimpleCsv';

  switch (type) {
    case 'SimpleCsv': {
      const csvPath = process.env.SIMPLECSV_PATH;

      if (!csvPath) {
        throw new Error("SIMPLECSV_PATH must be set when GEOLOCATION_DATABASE_TYPE is 'SimpleCsv'");
      }

      const reloadIntervalInMs = Number(process.env.CSV_FILE_RELOAD_INTERVAL_IN_MS || 30000);
      
      const csvGeoLocator = new SimpleCsvGeoLocator(csvPath, { reloadIntervalMs: reloadIntervalInMs });
      await csvGeoLocator.initialize();
      return csvGeoLocator;
    }
    default:
      throw new Error(`Unsupported geolocation database type: ${type}`);
  }
}

module.exports = { createGeoLocator };


