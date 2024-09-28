import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, ActivityIndicator, Button } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [myLocation, setMyLocation] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [path, setPath] = useState([]);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [lastLocation, setLastLocation] = useState(null);
  const [lastTimestamp, setLastTimestamp] = useState(null);

  const MAX_DISTANCE = 20; // Max allowed distance in meters between points
  const MAX_SPEED = 7; // Max speed in km/h considered valid for walking or jogging

  useEffect(() => {
    const getLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const { latitude, longitude } = location.coords;
      setMyLocation({ latitude, longitude });
    };

    getLocation();
  }, []);

  const handleStartStop = async () => {
    if (isRecording) {
      // Stop tracking
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
      setIsRecording(false);
    } else {
      // Start tracking with refined filtering logic
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High, // Increase accuracy
          timeInterval: 1000,
          distanceInterval: 1, // Small distance interval to ensure frequent updates
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          const currentTimestamp = location.timestamp;

          if (lastLocation && lastTimestamp) {
              distance = getDistanceFromLatLonInMeters(
              lastLocation.latitude,
              lastLocation.longitude,
              latitude,
              longitude
            );
            const timeElapsed = (currentTimestamp - lastTimestamp) / 1000; // Convert ms to seconds
            const speed = (distance / timeElapsed) * 3.6; // Convert m/s to km/h

            // Apply simplified filtering logic
            if (speed <= MAX_SPEED && distance <= MAX_DISTANCE) {
              setPath((prevPath) => [...prevPath, { latitude, longitude }]);
              setMyLocation({ latitude, longitude });
            }
          } else {
            // First point, no filtering
            setPath((prevPath) => [...prevPath, { latitude, longitude }]);
            setMyLocation({ latitude, longitude });
          }

          // Update lastLocation and lastTimestamp
          setLastLocation({ latitude, longitude });
          setLastTimestamp(currentTimestamp);
        }
      );
      setLocationSubscription(subscription);
      setIsRecording(true);
    }
  };

  // Function to calculate the distance between two points (in meters)
  const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Radius of the Earth in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // Distance in meters
    return d;
  };

  if (!myLocation) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        provider='google'
        showsUserLocation={true}
      >
        {myLocation && (
          <Marker
            coordinate={myLocation}
            title="You are here"
            description="This is your current location"
          />
        )}
        {path.length > 0 && (
          <Polyline
            coordinates={path}
            strokeColor="#000" // Black line
            strokeWidth={4}
          />
        )}
      </MapView>
      <View style={styles.buttonContainer}>
        <Button
          title={isRecording ? "Stop" : "Start"}
          onPress={handleStartStop}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    top: 40,
    right: 10,
    zIndex: 10,
  },
});
