export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const raioTerraKm = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return raioTerraKm * c;
}

export function formatarDistancia(distanciaKm) {
  if (distanciaKm < 1) {
    return `${Math.round(distanciaKm * 1000)} m de você`;
  }

  return `${distanciaKm.toFixed(1)} km de você`;
}
