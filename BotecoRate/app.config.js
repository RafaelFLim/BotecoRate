// app.json continua a fonte de verdade pro resto da config — esse arquivo só
// existe pra injetar a chave do Google Maps a partir do .env (nunca do
// app.json puro: JSON não consegue rodar `process.env.X`, ele salva a string
// literal "process.env.X" e o mapa fica preto).
const configEstatico = require('./app.json');

module.exports = ({ config }) => ({
  ...config,
  ...configEstatico.expo,
  android: {
    ...configEstatico.expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
