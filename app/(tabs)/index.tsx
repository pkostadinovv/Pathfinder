import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import MapView, { Polyline, Marker, UrlTile } from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import PathStorage from '../storage/paths'; // Import your PathStorage class
import Icon from 'react-native-vector-icons/FontAwesome'; // Import FontAwesome for the map-signs icon
import * as FileSystem from 'expo-file-system'; // Import expo-file-system

export default function HomeScreen() {
  const [myLocation, setMyLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [dots, setDots] = useState([]);
  const [selectedPath, setSelectedPath] = useState(null); // To store selected path info
  const [pathStorage] = useState(new PathStorage()); // Initialize PathStorage
  const mapRef = React.useRef(null); // Ref to interact with MapView

  const MIN_DISTANCE = 5; // Minimum distance between dots (in meters)
  const TILE_FOLDER = `${FileSystem.documentDirectory}tiles`; // Folder to store tiles

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
  };

  const loadCachedPaths = async () => {
    await pathStorage.loadPaths(); // Load paths into PathStorage
  };

  const handleStartStop = async () => {
    if (isRecording) {
      setIsRecording(false);
      await pathStorage.addPath(dots); // Add current dots to storage
      await pathStorage.savePaths(); // Save paths to AsyncStorage
      setDots([]); // Reset current path

      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
    } else {
      setIsRecording(true);
      setDots([]); // Reset dots when starting a new recording

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

  const handleMarkerDrag = (index, coordinate) => {
    const updatedDots = [...dots];
    updatedDots[index] = coordinate;
    setDots(updatedDots);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Download tile based on x, y, z and save it locally
  const downloadTile = async (x, y, z) => {
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const filePath = `${TILE_FOLDER}/${z}_${x}_${y}.png`;

    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        await FileSystem.makeDirectoryAsync(TILE_FOLDER, { intermediates: true });
        const download = await FileSystem.downloadAsync(url, filePath);
        if (download.status === 200) {
          console.log(`Tile ${z}/${x}/${y} downloaded successfully.`);
        } else {
          console.warn(`Failed to download tile ${z}/${x}/${y}: Status code ${download.status}`);
        }
      }
    } catch (error) {
      console.error(`Error downloading tile ${z}/${x}/${y}:`, error);
    }
  };

  // Function to download tiles within the visible region
  const downloadVisibleTiles = async (region) => {
    try {
      const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
      const zoomLevel = 15; // Assuming zoom level is fixed to 15 for simplicity (this can be dynamic)

      // Calculate tile range
      const xMin = Math.floor(((longitude - longitudeDelta) + 180) / 360 * (2 ** zoomLevel));
      const xMax = Math.floor(((longitude + longitudeDelta) + 180) / 360 * (2 ** zoomLevel));
      const yMin = Math.floor(((1 - Math.log(Math.tan((latitude - latitudeDelta) * Math.PI / 180) + 1 / Math.cos((latitude - latitudeDelta) * Math.PI / 180)) / Math.PI) / 2) * (2 ** zoomLevel));
      const yMax = Math.floor(((1 - Math.log(Math.tan((latitude + latitudeDelta) * Math.PI / 180) + 1 / Math.cos((latitude + latitudeDelta) * Math.PI / 180)) / Math.PI) / 2) * (2 ** zoomLevel));

      // Download all tiles in range
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          await downloadTile(x, y, zoomLevel);
        }
      }
    } catch (error) {
      console.error("Error calculating tile range or downloading tiles:", error);
    }
  };

  // Clear paths from storage and reset state
  const handleClearPaths = async () => {
    await pathStorage.clearPaths();
    setDots([]); // Clear current dots
    setSelectedPath(null); // Clear the selected path icon
    loadCachedPaths(); // Reload cached paths to reflect changes
  };

  // Handle tapping on a saved path to pan to its start point and show a marker
  const handlePathPress = (path) => {
    if (path.dots.length > 0) {
      const firstDot = path.dots[0];
      setSelectedPath(firstDot); // Store the first dot of the selected path
      mapRef.current.animateCamera({
        center: {
          latitude: firstDot.latitude,
          longitude: firstDot.longitude,
        },
        zoom: 15,
      }, { duration: 1000 });
    }
  };

  // Handle tapping on the map to deselect a path
  const handleMapPress = () => {
    setSelectedPath(null); // Clear the selected path
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
        ref={mapRef} // Reference to MapView for controlling camera
        style={styles.map}
        provider={isOnline ? 'google' : null}
        initialRegion={{
          latitude: myLocation?.latitude || 37.78825,
          longitude: myLocation?.longitude || -122.4324,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        onPress={handleMapPress} // Handle press on map to deselect paths
        onRegionChangeComplete={(region) => {
          if (isOnline) {
            downloadVisibleTiles(region); // Download tiles when online
          }
        }}
      >
        {/* Add UrlTile for offline support */}
        {!isOnline && (
          <UrlTile
            urlTemplate={`file://${TILE_FOLDER}/{z}_{x}_{y}.png`}
            maximumZ={19}
            shouldReplaceMapContent={true} // Use this to replace Google tiles when offline
          />
        )}

        {pathStorage.getPaths().map((path, pathIndex) => (
          <Polyline
            key={pathIndex}
            coordinates={path.dots || []}
            strokeColor="blue"
            strokeWidth={5}
            tappable={true} // Make the polyline tappable
            onPress={() => handlePathPress(path)} // Handle the press on the polyline
          />
        ))}

        {dots.length > 0 && (
          <>
            <Polyline coordinates={dots} strokeColor="red" strokeWidth={5} />
            {dots?.map((dot, index) => (
              <Marker
                key={index}
                coordinate={dot}
                draggable
                onDragEnd={(e) =>
                  handleMarkerDrag(index, e.nativeEvent.coordinate)
                }
              />
            ))}
          </>
        )}

        {/* Marker for the start of the selected path */}
        {selectedPath && (
          <Marker
            coordinate={selectedPath}
          >
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

        <TouchableOpacity onPress={() => pathStorage.logPaths()} style={[styles.button, styles.testButton]}>
          <Text style={styles.buttonText}>Test PathStorage</Text>
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});