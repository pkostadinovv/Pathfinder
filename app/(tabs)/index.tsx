import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, TouchableOpacity, Text, Image } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import CachedImage from 'expo-cached-image';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import PathStorage from '../storage/paths';
import Icon from 'react-native-vector-icons/FontAwesome';
import * as FileSystem from 'expo-file-system';

// Import auxiliary functions
import {calculateDistance} from '../auxiliary/map';
import * as CacheAux from '../auxiliary/cache';

export default function HomeScreen() {
  const [myLocation, setMyLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [dots, setDots] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null);
  const [pathStorage] = useState(new PathStorage());
  const mapRef = React.useRef(null);
  const [tilesDownloaded, setTilesDownloaded] = useState(false); // Persistent state to track downloads

  const MIN_DISTANCE = 5; // Minimum distance between dots (in meters)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected); // Toggle offline/online state
    });

    loadCachedPaths();
    getLocation();

    return () => {
      unsubscribe();
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn("Permission to access location was denied");
      return;
    }

    let location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    const { latitude, longitude } = location.coords;
    setMyLocation({ latitude, longitude });
    setLoading(false);

    // Download and cache tiles if online
    if (isOnline && !tilesDownloaded) {
      console.log("Downloading tiles...");
      await CacheAux.downloadPredefinedTiles();
      setTilesDownloaded(true);
      console.log("Tiles downloaded successfully.");
    }
  };

  const loadCachedPaths = async () => {
    await pathStorage.loadPaths();
    console.log("Paths loaded successfully.");
    pathStorage.logPaths();
  };

const renderOfflineTiles = () => {
  const tiles = [];
  const tileRanges = {
    12: { x: [2109, 2110], y: [1362, 1363] },
    13: { x: [4219, 4221], y: [2725, 2727] },
    14: { x: [8439, 8443], y: [5451, 5455] },
    15: { x: [16878, 16887], y: [10902, 10910] },
    16: { x: [33756, 33775], y: [21804, 21820] },
    17: { x: [67512, 67550], y: [43608, 43640] },
  };

  const initialZoom = 15; // Adjust zoom level as needed
  const tileRange = tileRanges[initialZoom];

  if (myLocation && tileRange) {
    const { latitude, longitude } = myLocation;
    const { xtile: centerX, ytile: centerY } = CacheAux.latLonToTile(latitude, longitude, initialZoom);

    const { x: [minX, maxX], y: [minY, maxY] } = tileRange;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const cacheKey = `${initialZoom}_${x}_${y}`;
        const localTilePath = `${FileSystem.cacheDirectory}${cacheKey}.png`; // Path to cached file

        tiles.push(
          <Image
            key={cacheKey}
            source={{ uri: localTilePath }}
            style={styles.tile}
            onError={() => {
              console.warn(`Tile missing from cache: ${cacheKey}`);
            }}
          />
        );
      }
    }
  }

  return tiles;
};

  const handleStartStop = async () => {
    if (isRecording) {
      // Stop recording and save path
      setIsRecording(false);
      await pathStorage.addPath(dots);
      await pathStorage.savePaths();
      console.log("Paths saved successfully.");
      setDots([]);
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
    } else {
      // Start recording and track location changes
      setIsRecording(true);
      setDots([]);
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        (location) => {
          const { latitude, longitude } = location.coords;

          setDots((prevDots) => {
            if (prevDots.length > 0) {
              const lastDot = prevDots[prevDots.length - 1];
              const distance = calculateDistance(
                lastDot.latitude,
                lastDot.longitude,
                latitude,
                longitude
              );

              if (distance >= MIN_DISTANCE) {
                return [...prevDots, { latitude, longitude }];
              } else {
                return prevDots;
              }
            } else {
              return [{ latitude, longitude }];
            }
          });
        }
      );
      setLocationSubscription(subscription);
    }
  };

  const handleClearPaths = async () => {
    await pathStorage.clearPaths();
    console.log("All paths cleared.");
    setDots([]);
    setSelectedPath(null);
    loadCachedPaths();
  };

  const handleMarkerDrag = (index, coordinate) => {
    const updatedDots = [...dots];
    updatedDots[index] = coordinate;
    setDots(updatedDots);
  };

  const handlePathPress = (path) => {
    if (path.dots.length > 0) {
      const firstDot = path.dots[0];
      setSelectedPath(firstDot);
      mapRef.current.animateCamera(
        {
          center: {
            latitude: firstDot.latitude,
            longitude: firstDot.longitude,
          },
          zoom: 15,
        },
        { duration: 1000 }
      );
    }
  };

  const handleMapPress = () => {
    setSelectedPath(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isOnline ? (
        <MapView
          key="online-map"
          ref={mapRef}
          style={styles.map}
          provider="google" // Use Google Maps provider only when online
          initialRegion={{
            latitude: myLocation?.latitude || 37.78825,
            longitude: myLocation?.longitude || -122.4324,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
          onPress={handleMapPress}
        >
          {/* Render polylines for stored paths */}
          {pathStorage.getPaths().map((path, pathIndex) => (
            <Polyline
              key={pathIndex}
              coordinates={path.dots || []}
              strokeColor="blue"
              strokeWidth={5}
              tappable={true}
              onPress={() => handlePathPress(path)}
            />
          ))}

          {/* Render active dots while recording */}
          {dots.length > 0 && (
            <>
              <Polyline coordinates={dots} strokeColor="red" strokeWidth={5} />
              {dots.map((dot, index) => (
                <Marker
                  key={index}
                  coordinate={dot}
                  draggable
                  onDragEnd={(e) => handleMarkerDrag(index, e.nativeEvent.coordinate)}
                  />
              ))}
            </>
          )}

          {/* Render marker for selected path */}
          {selectedPath && (
            <Marker coordinate={selectedPath}>
              <Icon name="map-signs" size={30} color="blue" />
            </Marker>
          )}
        </MapView>
      ) : (
        <MapView
          key="offline-map"
          ref={mapRef}
          style={styles.map}
          provider={null} // Disable Google Maps when offline
          initialRegion={{
            latitude: myLocation?.latitude || 37.78825,
            longitude: myLocation?.longitude || -122.4324,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
        >
          {/* Render offline tiles */}
          {renderOfflineTiles()}

          {/* Render polylines for stored paths */}
          {pathStorage.getPaths().map((path, pathIndex) => (
            <Polyline
              key={pathIndex}
              coordinates={path.dots || []}
              strokeColor="blue"
              strokeWidth={5}
              tappable={true}
              onPress={() => handlePathPress(path)}
            />
          ))}

          {/* Render active dots while recording */}
          {dots.length > 0 && (
            <>
              <Polyline coordinates={dots} strokeColor="red" strokeWidth={5} />
              {dots.map((dot, index) => (
                <Marker
                  key={index}
                  coordinate={dot}
                  draggable
                  onDragEnd={(e) => handleMarkerDrag(index, e.nativeEvent.coordinate)}
                />
              ))}
            </>
          )}

          {/* Render marker for selected path */}
          {selectedPath && (
            <Marker coordinate={selectedPath}>
              <Icon name="map-signs" size={30} color="blue" />
            </Marker>
          )}
        </MapView>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleStartStop} style={styles.button}>
          <Text style={styles.buttonText}>{isRecording ? "Stop" : "Start"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleClearPaths} style={[styles.button, styles.clearButton]}>
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => pathStorage.logPaths()} style={[styles.button, styles.testButton]}>
          <Text style={styles.buttonText}>Storage</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => CacheAux.listCachedFiles()} style={[styles.button, styles.cacheButton]}>
          <Text style={styles.buttonText}>Cache</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  buttonContainer: {
    position: 'absolute',
    top: 40,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  clearButton: {
    backgroundColor: 'red',
  },
  testButton: {
    backgroundColor: 'orange',
  },
  cacheButton: {
    backgroundColor: 'green',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  tile: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
});
