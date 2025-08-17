const SimpleCsvGeoLocator = require('./SimpleCsvGeoLocator');

async function createGeoLocator() {
  const type = process.env.GEOLOCATION_DATABASE_TYPE || 'SimpleCsv';

  switch (type) {
    case 'SimpleCsv': {
      const csvPath = process.env.SIMPLECSV_PATH;

      if (!csvPath) {
        throw new Error("SIMPLECSV_PATH must be set when GEOLOCATION_DATABASE_TYPE is 'SimpleCsv'");
      }

      const reloadIntervalSeconds = Number(process.env.CSV_RELOAD_INTERVAL_SECONDS || 0);
      
      const csvGeoLocator = new SimpleCsvGeoLocator(csvPath, { reloadIntervalSeconds });
      await csvGeoLocator.initialize();
      return csvGeoLocator;
    }
    default:
      throw new Error(`Unsupported geolocation database type: ${type}`);
  }
}

module.exports = { createGeoLocator };


