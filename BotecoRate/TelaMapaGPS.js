import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

export default function TelaMapaGPS({ onVoltar }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão da localização negada!');
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Obtendo localização...</Text>
        <TouchableOpacity style={styles.btnVoltar} onPress={onVoltar}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.btnVoltar} onPress={onVoltar}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="Você está aqui"
          description={`Lat: ${location.latitude.toFixed(6)}, Lon: ${location.longitude.toFixed(6)}`}
        />
      </MapView>

      <View style={styles.info}>
        <Text style={styles.coordText}>
          Latitude: {location.latitude.toFixed(6)}
        </Text>
        <Text style={styles.coordText}>
          Longitude: {location.longitude.toFixed(6)}
        </Text>
        <TouchableOpacity style={styles.btnVoltar} onPress={onVoltar}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  info: {
    padding: 16,
    backgroundColor: '#fff',
    width: '100%',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  coordText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 16,
  },
  btnVoltar: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
