import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Dimensions, Button } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [myLocation, setMyLocation] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [dots, setDots] = useState([]); // Store all dots during recording
  const [paths, setPaths] = useState([]); // Store completed paths
  const locationSubscriptionRef = useRef(null); // Store the location subscription

  const MAX_DISTANCE = 5; // Adjusted max distance in meters between points

  useEffect(() => {
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
    };

    getLocation();
  }, []);

  const handleStartStop = async () => {
    if (isRecording) {
      // Stop tracking
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove(); // Stop the location subscription
        locationSubscriptionRef.current = null; // Clear the reference
      }

      // Save the current dots into paths and clear the dots
      if (dots.length > 0) {
        setPaths((prevPaths) => [...prevPaths, dots]); // Store the completed path
        setDots([]); // Clear dots
      }

      setIsRecording(false); // Update the recording state to stopped
    } else {
      // Start tracking
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          const { latitude, longitude } = location.coords;

          setDots((prevDots) => {
            if (prevDots.length > 0) {
              const lastDot = prevDots[prevDots.length - 1];
              const distance = getDistanceFromLatLonInMeters(
                lastDot.latitude,
                lastDot.longitude,
                latitude,
                longitude
              );

              if (distance >= MAX_DISTANCE) {
                return [...prevDots, { latitude, longitude }];
              } else {
                return prevDots;
              }
            } else {
              return [{ latitude, longitude }];
            }
          });

          // Update the map to center on the new location
          setMyLocation({ latitude, longitude });
        }
      );

      // Save the subscription reference
      locationSubscriptionRef.current = subscription;

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
    return null; // Return null or a loading indicator if the location isn't available yet
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
        provider="google"
        showsUserLocation={true}
      >
        {/* Render all dots during the recording */}
        {dots.map((dot, index) => (
          <Circle
            key={index}
            center={dot}
            radius={0.3} // Small radius to represent the dot
            fillColor="blue"
          />
        ))}

        {/* Render completed paths */}
        {paths.map((path, pathIndex) =>
          path.map((dot, dotIndex) => (
            <Circle
              key={`${pathIndex}-${dotIndex}`}
              center={dot}
              radius={0.3} // Small radius to represent the dot
              fillColor="red"
            />
          ))
        )}
      </MapView>
      <View style={styles.buttonContainer}>
        <Button title={isRecording ? "Stop" : "Start"} onPress={handleStartStop} />
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
  buttonContainer: {
    position: 'absolute',
    top: 40,
    right: 10,
    zIndex: 10,
  },
});
