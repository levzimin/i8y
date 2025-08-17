const fs = require('fs');
const os = require('os');
const path = require('path');
const SimpleCsvGeoLocator = require('../SimpleCsvGeoLocator');

/**
 * Creates a temporary directory and writes the contents to a CSV file.
 */
async function withMockCsvFile(contents, testFn) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'i8y-csv-'));
  const csvPath = path.join(dir, 'db.csv');
  await fs.promises.writeFile(csvPath, contents, 'utf8');
  try {
    await testFn(csvPath);
  } finally {
    // Best-effort cleanup
    try { await fs.promises.unlink(csvPath); } catch (_) {}
    try { await fs.promises.rmdir(dir); } catch (_) {}
  }
}

describe('SimpleCsvGeoLocator', () => {
  test('Initializes and finds known IP; returns null for unknown', async () => {
    const csv = [
      'ip,city,country',
      '1.2.3.4,Tel Aviv,IL',
      '5.6.7.8,San Francisco,US',
    ].join('\n');

    await withMockCsvFile(csv, async (csvPath) => {
      const locator = new SimpleCsvGeoLocator(csvPath);
      try {
        await locator.initialize();

        await expect(locator.locateByIp('1.2.3.4')).resolves.toEqual({ country: 'IL', city: 'Tel Aviv' });
        await expect(locator.locateByIp('9.9.9.9')).resolves.toBeNull();
      } finally {
        await locator.dispose();
      }
    });
  });

  test('Throws on initialize when CSV path is invalid', async () => {
    const badPath = path.join(os.tmpdir(), 'does-not-exist', 'db.csv');
    const locator = new SimpleCsvGeoLocator(badPath);
    try {
      // Suppressing console.error for a cleaner test output.
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await expect(locator.initialize()).rejects.toBeInstanceOf(Error);
      errSpy.mockRestore();
    } finally {
      await locator.dispose();
    }
  });

  test('Trims fields properly, and last duplicate IP takes the win', async () => {
    const csv = [
      'ip,city,country',
      '1.1.1.1,  FirstCity  ,  FC  ',
      '1.1.1.1,SecondCity,SC',
    ].join('\n');

    await withMockCsvFile(csv, async (csvPath) => {
      const locator = new SimpleCsvGeoLocator(csvPath);
      try {
        await locator.initialize();

        const hit = await locator.locateByIp('1.1.1.1');
        expect(hit).toEqual({ country: 'SC', city: 'SecondCity' });
      } finally {
        await locator.dispose();
      }
    });
  });
});


