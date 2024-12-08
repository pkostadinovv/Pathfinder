import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
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
      setIsOnline(state.isConnected);
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
  const initialZoom = 15; // Set the zoom level for rendering
  const tileRange = 5; // Range of tiles to render (adjustable)

  if (myLocation) {
    const { latitude, longitude } = myLocation;
    const { xtile: x, ytile: y } = CacheAux.latLonToTile(latitude, longitude, initialZoom);

    for (let dx = -Math.floor(tileRange / 2); dx <= Math.floor(tileRange / 2); dx++) {
      for (let dy = -Math.floor(tileRange / 2); dy <= Math.floor(tileRange / 2); dy++) {
        const tileX = x + dx;
        const tileY = y + dy;
        const cacheKey = `${initialZoom}_${tileX}_${tileY}`;
        const tileUrl = `https://reritiles.protomix.com/${initialZoom}/${tileX}/${tileY}.png`; // Corrected URL

        tiles.push(
          <CachedImage
            key={cacheKey}
            source={{ uri: tileUrl }}
            cacheKey={cacheKey}
            style={styles.tile}
            placeholderContent={<ActivityIndicator color="#0000ff" size="small" />}
            resizeMode="contain"
            onError={(e) =>
              console.error(`Error loading tile from cache: ${cacheKey}`, e.nativeEvent.error)
            }
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
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={isOnline ? 'google' : null}
        initialRegion={{
          latitude: myLocation?.latitude || 37.78825,
          longitude: myLocation?.longitude || -122.4324,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        onPress={handleMapPress}
      >
        {isOnline ? null : renderOfflineTiles()}

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

        {selectedPath && (
          <Marker coordinate={selectedPath}>
            <Icon name="map-signs" size={30} color="blue" />
          </Marker>
        )}
      </MapView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleStartStop} style={styles.button}>
          <Text style={styles.buttonText}>{isRecording ? "Stop" : "Start"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleClearPaths} style={[styles.button, styles.clearButton]}>
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => pathStorage.logPaths()} style={[styles.button, styles.pathsButton]}>
          <Text style={styles.buttonText}>Paths</Text>
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
  pathsButton: {
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
