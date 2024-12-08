import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Image, Dimensions, Text, ActivityIndicator } from 'react-native';
import { downloadAllTiles } from '../auxiliary/cache';
import * as FileSystem from 'expo-file-system';

export default function ExploreScreen() {
  const [cachedTiles, setCachedTiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const screenDimensions = {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  };

  useEffect(() => {
    const loadAndValidateTiles = async () => {
      console.log("Downloading and validating tiles...");
      const tiles = await downloadAllTiles(); // Download all tiles
      const validatedTiles = [];

      for (const tile of tiles) {
        try {
          // Ensure the tile exists on the file system
          const fileInfo = await FileSystem.getInfoAsync(tile.uri.replace('file://', ''));
          if (fileInfo.exists) {
            validatedTiles.push(tile); // Only add valid tiles
          } else {
            console.warn(`Tile not found in cache: ${tile.uri}`);
          }
        } catch (error) {
          console.error(`Error validating tile ${tile.uri}:`, error);
        }
      }

      setCachedTiles(validatedTiles); // Set only validated tiles
      setIsLoading(false); // Stop loading
      console.log("Tile validation complete.");
    };

    loadAndValidateTiles();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading tiles...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        {cachedTiles.map((tile, index) => (
          <Image
            key={index}
            source={{ uri: tile.uri }} // Render only validated tiles
            style={[
              styles.tile,
              {
                position: 'absolute',
                left: (tile.x - 16883) * 256 + screenDimensions.width / 2, // Adjust to center
                top: (tile.y - 10906) * 256 + screenDimensions.height / 3, // Adjust to center
              },
            ]}
            onError={(e) =>
              console.error(`Failed to load tile: ${tile.uri}`, e.nativeEvent.error)
            }
          />
        ))}
        {cachedTiles.length === 0 && (
          <Text style={styles.message}>No tiles available to display.</Text>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
  },
  message: {
    position: 'absolute',
    alignSelf: 'center',
    top: Dimensions.get('window').height / 3,
    fontSize: 16,
    color: '#888',
  },
});
