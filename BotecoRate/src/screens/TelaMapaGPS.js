import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { carregarBares } from '../services/storage';
import { baresIniciais } from '../data/mockBares';
import { calcularDistanciaKm, formatarDistancia } from '../utils/distancia';

export default function TelaMapaGPS({ onVoltar }) {
  const mapRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [bares, setBares] = useState([]);
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

      const dadosSalvos = await carregarBares();
      setBares(dadosSalvos !== null ? dadosSalvos : baresIniciais);

      setLoading(false);
    })();
  }, []);

  // Enquadra você + todos os pins na tela. Precisa ser chamado só depois que o
  // mapa terminar de carregar (onMapReady) — chamar antes disso trava o mapa
  // numa tela preta no Android.
  function ajustarMapaParaTodosOsPontos() {
    if (!mapRef.current) {
      return;
    }

    const coordenadas = [
      { latitude: location.latitude, longitude: location.longitude },
      ...bares.map((bar) => ({ latitude: bar.latitude, longitude: bar.longitude })),
    ];

    mapRef.current.fitToCoordinates(coordenadas, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }

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
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        onMapReady={ajustarMapaParaTodosOsPontos}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="Você está aqui"
          description={`Lat: ${location.latitude.toFixed(6)}, Lon: ${location.longitude.toFixed(6)}`}
        />

        {bares.map((bar) => {
          const distanciaKm = calcularDistanciaKm(
            location.latitude,
            location.longitude,
            bar.latitude,
            bar.longitude
          );

          return (
            <Marker
              key={bar.id}
              coordinate={{
                latitude: bar.latitude,
                longitude: bar.longitude,
              }}
              title={bar.nome}
              description={`${bar.endereco} — ${formatarDistancia(distanciaKm)}`}
              pinColor="#6c63ff"
            />
          );
        })}
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
