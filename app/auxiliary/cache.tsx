import { CacheManager } from 'expo-cached-image';
import * as FileSystem from 'expo-file-system';

// Helper function for retry logic with logging
const retry = (fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> =>
  fn().catch((err) =>
    retries > 1
      ? new Promise((resolve) => {
          console.log(`Retrying... Attempts left: ${retries - 1}`);
          setTimeout(() => resolve(retry(fn, retries - 1, delay * 2)), delay);
        })
      : Promise.reject(err)
  );

// Set to keep track of downloaded tiles to avoid duplicates
const downloadedTiles = new Set<string>();

// Convert latitude and longitude to tile coordinates at a specific zoom level
export const latLonToTile = (lat: number, lon: number, zoom: number) => {
  const n = 2 ** zoom;
  const xtile = Math.floor(n * ((lon + 180) / 360));
  const ytile = Math.floor(
    n * (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2
  );
  return { xtile, ytile };
};

// Convert tile coordinates back to latitude and longitude
export const tileToLatLon = (xtile: number, ytile: number, zoom: number) => {
  const n = 2 ** zoom;
  const lon = (xtile / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ytile) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
};

export const downloadTile = async (x, y, z) => {
  console.log(`downloadTile called for (${x}, ${y}, ${z})`);

  const baseUrl = `https://reritiles.protomix.com`;
  const url = `${baseUrl}/${z}/${x}/${y}.png`;
  const cacheKey = `${z}_${x}_${y}`;
  const downloadPath = `${FileSystem.cacheDirectory}${cacheKey}.png`; // Local file path

  console.log(`Checking tile ${cacheKey} at URL: ${url}`);

  try {
    // Check if the file exists in the local cache
    const fileInfo = await FileSystem.getInfoAsync(downloadPath);
    if (fileInfo.exists) {
      console.log(`Tile ${cacheKey} retrieved from cache: ${downloadPath}`);
      return; // Skip download if the file is already cached
    }

    console.warn(`Tile ${cacheKey} not cached or file missing. Attempting to download...`);
    // Download the tile to the local cache
    await retry(() => FileSystem.downloadAsync(url, downloadPath), 3);
    console.log(`Tile ${cacheKey} successfully downloaded to: ${downloadPath}`);
  } catch (error) {
    console.error(`Error downloading tile ${cacheKey} from URL: ${url}`, error);
  }

  console.log(`Finished processing tile ${cacheKey}`);
};

export const downloadPredefinedTiles = async () => {
  console.log(`Starting to download predefined tiles...`);

  // Predefined tile ranges
  const tileRanges = {
    12: { x: [2109, 2110], y: [1362, 1363] },
    13: { x: [4219, 4221], y: [2725, 2727] },
    14: { x: [8439, 8443], y: [5451, 5455] },
    15: { x: [16878, 16887], y: [10902, 10910] },
    16: { x: [33756, 33775], y: [21804, 21820] },
    17: { x: [67512, 67550], y: [43608, 43640] },
  };

  // Iterate over the predefined ranges
  for (const zoom in tileRanges) {
    const { x: [minX, maxX], y: [minY, maxY] } = tileRanges[zoom];
    console.log(`Zoom ${zoom}: Downloading tiles from X(${minX}-${maxX}), Y(${minY}-${maxY})`);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        console.log(`Processing tile at zoom ${zoom}, X: ${x}, Y: ${y}`);
        await downloadTile(x, y, parseInt(zoom, 10));
      }
    }
  }

  console.log(`Finished downloading predefined tiles.`);
};

// Clear the cache directory for debugging
export const clearCache = async () => {
  console.log("Clearing cache...");
  await FileSystem.deleteAsync(FileSystem.cacheDirectory, { idempotent: true });
  console.log("Cache cleared.");
};

// List all cached files for verification
export const listCachedFiles = async () => {
  try {
    const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    console.log("Cached files:", files);
    return files;
  } catch (error) {
    console.error("Error reading cache directory:", error);
  }
};
