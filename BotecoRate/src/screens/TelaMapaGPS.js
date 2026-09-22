import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    obterLocalizacaoEBares();
  }, []);

  async function obterLocalizacaoEBares() {
    setErrorMsg(null);
    setLoading(true);

    // O try/catch é o que impede a tela de ficar presa em "Obtendo localização...":
    // com o GPS desligado, getCurrentPositionAsync lança erro e o setLoading(false)
    // do fim nunca seria executado.
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão da localização negada!');
        setLoading(false);
        return;
      }

      // Ter permissão não significa que o GPS está ligado — são coisas diferentes.
      const servicosLigados = await Location.hasServicesEnabledAsync();
      if (!servicosLigados) {
        setErrorMsg('A localização do aparelho está desligada. Ligue o GPS e tente de novo.');
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);

      const dadosSalvos = await carregarBares();
      const lista = dadosSalvos !== null ? dadosSalvos : baresIniciais;

      // Bares cadastrados sem GPS ficam com latitude/longitude nulas: não dá pra
      // criar um pin pra eles, então o mapa simplesmente os ignora.
      setBares(lista.filter((bar) => typeof bar.latitude === 'number'));

      setLoading(false);
    } catch (error) {
      console.log('Erro ao obter a localização:', error);
      setErrorMsg('Não foi possível obter sua localização. Verifique se o GPS está ligado.');
      setLoading(false);
    }
  }

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
        <TouchableOpacity style={styles.btnTentarNovamente} onPress={obterLocalizacaoEBares}>
          <Text style={styles.btnText}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnVoltar} onPress={onVoltar}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
        <TouchableOpacity style={styles.btnVoltar} onPress={onVoltar}>
          <Text style={styles.btnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  btnTentarNovamente: {
    marginTop: 12,
    backgroundColor: '#6c63ff',
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
