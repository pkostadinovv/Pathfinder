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

// Download a tile and cache it
export const downloadTile = async (x: number, y: number, z: number) => {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
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

// Download all tiles within a specified area
export const downloadTilesInArea = async (initialLat: number, initialLon: number, minZoom = 12, maxZoom = 17) => {
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const { xtile: minX, ytile: minY } = latLonToTile(initialLat - 0.005, initialLon - 0.005, zoom);
    const { xtile: maxX, ytile: maxY } = latLonToTile(initialLat + 0.005, initialLon + 0.005, zoom);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        await downloadTile(x, y, zoom);
      }
    }
  }
};
