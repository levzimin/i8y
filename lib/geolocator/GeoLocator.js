/**
 * Describes a class responsible for finding location information for a given IP address.
 *
 * Example:
 * 1.2.3.4,Tel Aviv,IL
 * 5.6.7.8,San Francisco,US
 */
class GeoLocator {
  
  /**
   * Allows for openning connections or setting up async resources before the first use.
   * @returns {Promise<void>} - A promise that resolves when the initialization is complete.
   */
  async initialize() {
    throw new Error('Not implemented');
  }

  /**
   * Returns the country and city for a given IP address.
   * @param {string} ipAddress - The IP address to find.
   * @returns {Promise<{ country: string, city: string } | null>} - The country and city for the given IP address.
   */
  async locateByIp(ipAddress) {
    throw new Error('Not implemented');
  }
}

module.exports = GeoLocator;


