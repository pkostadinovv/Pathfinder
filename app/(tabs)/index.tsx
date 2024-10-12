import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import MapView, { Polyline, Marker, UrlTile } from 'react-native-maps';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PathStorage from '../storage/paths'; // Import your PathStorage class

export default function HomeScreen() {
  const [myLocation, setMyLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [dots, setDots] = useState([]);
  const [pathStorage] = useState(new PathStorage()); // Initialize PathStorage

  const MIN_DISTANCE = 5; // Minimum distance between dots (in meters)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected);
    });

    loadCachedPaths();

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

    getLocation();

    return () => {
      unsubscribe();
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  const loadCachedPaths = async () => {
    await pathStorage.loadPaths(); // Load paths into PathStorage
  };

  const handleStartStop = async () => {
    if (isRecording) {
      setIsRecording(false);
      pathStorage.addPath(dots); // Add current dots to storage
      await pathStorage.savePaths(); // Save paths to AsyncStorage
      setDots([]); // Reset current path

      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
    } else {
      setIsRecording(true);

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

  // Clear paths from storage and reset state
  const handleClearPaths = async () => {
    await pathStorage.clearPaths();
    setDots([]); // Clear current dots
    loadCachedPaths(); // Reload cached paths to reflect changes
  };

  // Log paths for testing purposes
  const logPaths = async () => {
    const paths = pathStorage.getPaths();
    console.log('Stored Paths:', paths);
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
        style={styles.map}
        provider={isOnline ? 'google' : null}
        initialRegion={{
          latitude: myLocation?.latitude || 37.78825,
          longitude: myLocation?.longitude || -122.4324,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        {!isOnline && (
          <UrlTile
            urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
          />
        )}

        {pathStorage.getPaths().map((path, pathIndex) => (
          <Polyline
            key={pathIndex}
            coordinates={path.dots || []}
            strokeColor="blue"
            strokeWidth={10}
          />
        ))}

        {dots.length > 0 && (
          <>
            <Polyline coordinates={dots} strokeColor="red" strokeWidth={10} />
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
      </MapView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleStartStop} style={styles.button}>
          <Text style={styles.buttonText}>{isRecording ? "Stop" : "Start"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleClearPaths} style={[styles.button, styles.clearButton]}>
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={logPaths} style={[styles.button, styles.testButton]}>
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
