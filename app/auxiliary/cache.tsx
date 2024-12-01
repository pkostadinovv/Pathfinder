import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Image, Text, PanResponder } from 'react-native';
import * as FileSystem from 'expo-file-system';

export default function ExploreScreen() {
  const [zoomLevel] = useState(15); // Fixed zoom level for predefined tiles
  const [center, setCenter] = useState({ x: 16883, y: 10906 }); // Default center tile (middle of the range)
  const [offlineTiles, setOfflineTiles] = useState([]);
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
    const loadTiles = async () => {
      const tiles = [];
      const { x: [minX, maxX], y: [minY, maxY] } = tileRanges[zoomLevel];
      const range = 2; // Number of tiles to load around the center

      for (let x = center.x - range; x <= center.x + range; x++) {
        for (let y = center.y - range; y <= center.y + range; y++) {
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            const cacheKey = `${zoomLevel}_${x}_${y}`;
            const localTilePath = `${FileSystem.cacheDirectory}${cacheKey}.png`;
            const fileInfo = await FileSystem.getInfoAsync(localTilePath);

            if (fileInfo.exists) {
              // Push valid tiles only
              tiles.push({ uri: `file://${localTilePath}`, x, y }); // Ensure URI is prefixed with "file://"
            } else {
              console.warn(`Missing tile: ${cacheKey}`);
            }
          }
        }
      }
      setOfflineTiles(tiles);
    };

    loadTiles();
  }, [center, zoomLevel]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Render offline tiles */}
      <View style={styles.mapContainer}>
        {offlineTiles.map((tile, index) => (
          <Image
            key={index}
            source={{ uri: tile.uri }} // Ensure this is a valid file URI
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
          />
        ))}
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
});
