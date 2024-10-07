import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import MapView, { Circle, Polyline, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const [myLocation, setMyLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(true); // Track online/offline status
  const [dots, setDots] = useState([]); // Store dots for current path
  const [paths, setPaths] = useState([]); // Store all cached paths
  const [isRecording, setIsRecording] = useState(false); // Recording state
  const [loading, setLoading] = useState(true); // Loading state for location fetching
  const [locationSubscription, setLocationSubscription] = useState(null); // Store the location subscription

  const MIN_DISTANCE = 5; // Minimum distance between dots (in meters)

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected); // Update online status
    });

    // Fetch cached paths from local storage
    loadCachedPaths();

    // Get initial location and request permissions
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
      setLoading(false); // Location fetched, stop showing loader
    };

    getLocation();

    return () => {
      unsubscribe();
      // Cleanup any ongoing location subscriptions when component unmounts
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  // Load cached paths from AsyncStorage
  const loadCachedPaths = async () => {
    try {
      const storedPaths = await AsyncStorage.getItem('paths');
      if (storedPaths) {
        setPaths(JSON.parse(storedPaths)); // Set cached paths
      }
    } catch (error) {
      console.error("Failed to load paths from storage", error);
    }
  };

  // Save paths to AsyncStorage
  const savePathsToStorage = async (updatedPaths) => {
    try {
      await AsyncStorage.setItem('paths', JSON.stringify(updatedPaths));
    } catch (error) {
      console.error("Failed to save paths to storage", error);
    }
  };

  // Clear all paths from state and storage
  const clearAllPaths = async () => {
    setPaths([]); // Clear paths from state
    await AsyncStorage.removeItem('paths'); // Clear paths from AsyncStorage
  };

  // Function to calculate the distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  // Start/Stop recording a new path
  const handleStartStop = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      const updatedPaths = [...paths, dots];
      setPaths(updatedPaths);
      savePathsToStorage(updatedPaths);
      setDots([]); // Clear dots after saving

      // Remove location subscription to stop tracking
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null); // Clear the subscription
      }
    } else {
      // Start recording
      setIsRecording(true);

      // Start tracking location while recording
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
        (location) => {
          const { latitude, longitude } = location.coords;

          setDots((prevDots) => {
            // If there are already dots, check the distance to the last one
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
                // Do not add if the distance is too short
                return prevDots;
              }
            } else {
              // First dot, no need to check the distance
              return [{ latitude, longitude }];
            }
          });
        }
      );
      setLocationSubscription(subscription); // Save the subscription for later cleanup
    }
  };

  // Show loading spinner while waiting for location
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
        style={styles.map}
        provider={isOnline ? PROVIDER_GOOGLE : null}
        initialRegion={{
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        {/* If offline, show OSM tiles */}
        {!isOnline && (
          <UrlTile
            urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
          />
        )}

        {/* Render existing cached paths */}
        {paths.map((path, pathIndex) => (
          <Polyline
            key={pathIndex}
            coordinates={path}
            strokeColor="blue"
            strokeWidth={10}
          />
        ))}

        {/* Render current path being recorded */}
        {dots.length > 0 && (
          <>
            <Polyline coordinates={dots} strokeColor="red" strokeWidth={10} />
            {/* Render each dot on the path */}
            {dots.map((dot, index) => (
              <Circle
                key={index}
                center={dot}
                radius={0.5}
                fillColor="red"
              />
            ))}
          </>
        )}
      </MapView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleStartStop} style={styles.button}>
          <Text style={styles.buttonText}>{isRecording ? "Stop" : "Start"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={clearAllPaths} style={[styles.button, styles.clearButton]}>
          <Text style={styles.buttonText}>Clear</Text>
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
