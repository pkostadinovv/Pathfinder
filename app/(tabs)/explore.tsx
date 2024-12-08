import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Image, Text, ActivityIndicator, PanResponder } from 'react-native';
import * as FileSystem from 'expo-file-system';

export default function ExploreScreen() {
  const [zoomLevel] = useState(15); // Fixed zoom level
  const [center, setCenter] = useState({ x: 16883, y: 10906 }); // Default center tile
  const [offlineTiles, setOfflineTiles] = useState([]);
  const [isCaching, setIsCaching] = useState(true); // Track whether tiles are being cached
  const mapOffset = useRef({ x: 0, y: 0 });

  // Predefined tile ranges for zoom level 15
  const tileRanges = {
    15: { x: [16878, 16887], y: [10902, 10910] },
  };

  const screenDimensions = {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  };

  // Pan responder for user interaction
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (e, gestureState) => {
      mapOffset.current = {
        x: gestureState.dx,
        y: gestureState.dy,
      };
    },
    onPanResponderRelease: () => {
      const deltaX = Math.round(mapOffset.current.x / 256); // Tiles are 256px wide
      const deltaY = Math.round(mapOffset.current.y / 256); // Tiles are 256px tall

      setCenter((prevCenter) => ({
        x: Math.max(
          tileRanges[zoomLevel].x[0],
          Math.min(prevCenter.x - deltaX, tileRanges[zoomLevel].x[1])
        ),
        y: Math.max(
          tileRanges[zoomLevel].y[0],
          Math.min(prevCenter.y - deltaY, tileRanges[zoomLevel].y[1])
        ),
      }));

      mapOffset.current = { x: 0, y: 0 }; // Reset offset
    },
  });

  useEffect(() => {
    const cacheAndLoadTiles = async () => {
      console.log("Caching tiles...");
      setIsCaching(true);
      const tiles = [];
      const { x: [minX, maxX], y: [minY, maxY] } = tileRanges[zoomLevel];

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const cacheKey = `${zoomLevel}_${x}_${y}`;
          const localTilePath = `${FileSystem.cacheDirectory}${cacheKey}.png`;

          try {
            const fileInfo = await FileSystem.getInfoAsync(localTilePath);

            if (!fileInfo.exists) {
              console.warn(`Tile missing: ${cacheKey}. Simulating download.`);
              await FileSystem.writeAsStringAsync(localTilePath, ""); // Create an empty file
            }

            const tileUri = `file://${localTilePath}`;
            if (tileUri.startsWith("file://")) {
              tiles.push({ uri: tileUri, x, y });
            } else {
              console.warn(`Invalid URI for tile: ${tileUri}`);
            }
          } catch (error) {
            console.error(`Error processing tile ${cacheKey}:`, error);
          }
        }
      }

      setOfflineTiles(tiles);
      setIsCaching(false);
      console.log("Caching complete. Tiles loaded.");
    };

    cacheAndLoadTiles();
  }, [zoomLevel]);

  if (isCaching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Caching tiles...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.mapContainer}>
        {offlineTiles.map((tile, index) => {
          console.log(`Rendering tile: ${tile.uri}`);
          return (
            <Image
              key={index}
              source={{ uri: tile.uri }}
              style={[
                styles.tile,
                {
                  position: 'absolute',
                  left:
                    (tile.x - center.x) * 256 +
                    screenDimensions.width / 2 +
                    mapOffset.current.x,
                  top:
                    (tile.y - center.y) * 256 +
                    screenDimensions.height / 3 +
                    mapOffset.current.y,
                },
              ]}
              onError={(e) =>
                console.error(`Failed to load tile: ${tile.uri}`, e.nativeEvent.error)
              }
            />
          );
        })}
        {offlineTiles.length === 0 && (
          <Text style={styles.message}>No tiles available for the current view.</Text>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.info}>Center Tile: X {center.x}, Y {center.y}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#ccc', // Placeholder background
  },
  tile: {
    width: 256,
    height: 256,
  },
  message: {
    position: 'absolute',
    alignSelf: 'center',
    top: Dimensions.get('window').height / 3,
    fontSize: 16,
    color: '#888',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    alignItems: 'center',
  },
  info: {
    fontSize: 14,
    backgroundColor: '#ffffffcc',
    padding: 5,
    borderRadius: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});
