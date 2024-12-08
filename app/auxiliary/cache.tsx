import { CacheManager } from 'expo-cached-image';
import * as FileSystem from 'expo-file-system';

// Helper function for retry logic
const retry = (fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> =>
  fn().catch((err) =>
    retries > 1
      ? new Promise((resolve) =>
          setTimeout(() => resolve(retry(fn, retries - 1, delay * 2)), delay)
        )
      : Promise.reject(err)
  );

// Download a tile and cache it
export const downloadTile = async (x: number, y: number, z: number) => {
  const url = `https://reritiles.protomix.com/${z}/${x}/${y}.png`;
  const cacheKey = `${z}_${x}_${y}`;

  try {
    const cachedUri = await CacheManager.getCachedUri({ key: cacheKey });
    if (!cachedUri) {
      await retry(() => CacheManager.downloadAsync({ uri: url, key: cacheKey }), 3);
      console.log(`Tile ${z}/${x}/${y} downloaded and cached.`);
    } else {
      console.log(`Tile ${z}/${x}/${y} retrieved from cache.`);
    }
  } catch (error) {
    console.error(`Error downloading tile ${z}/${x}/${y}:`, error);
  }
};

// Hardcoded tile ranges for different zoom levels
const tileRanges = {
  12: { x: [2109, 2110], y: [1362, 1363] },
  13: { x: [4219, 4221], y: [2725, 2727] },
  14: { x: [8439, 8443], y: [5451, 5455] },
  15: { x: [16878, 16887], y: [10902, 10910] },
  16: { x: [33756, 33775], y: [21804, 21820] },
  17: { x: [67512, 67550], y: [43608, 43640] },
};

// Download all tiles for hardcoded zoom levels and ranges
export const downloadAllTiles = async () => {
  for (const zoom in tileRanges) {
    const { x: [minX, maxX], y: [minY, maxY] } = tileRanges[zoom];

    console.log(`Downloading tiles for zoom level ${zoom}...`);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        await downloadTile(x, y, parseInt(zoom));
      }
    }

    console.log(`Tiles for zoom level ${zoom} downloaded.`);
  }

  console.log("All tiles downloaded successfully.");
};

// Utility function to list cached files
export const listCachedFiles = async () => {
  try {
    const cachedFiles = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    console.log("Cached Files:", cachedFiles);
  } catch (error) {
    console.error("Error listing cached files:", error);
  }
};
