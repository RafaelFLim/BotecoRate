import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(config).every(Boolean);
let auth = null;
let db = null;
if (firebaseConfigured) {
  const app = getApps()[0] || initializeApp(config);
  try { auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); }
  catch (error) {
    if (error.code !== 'auth/already-initialized') throw error;
    auth = getAuth(app);
  }
  db = getDatabase(app);
}
export { auth, db };

export function requireFirebase() {
  if (!firebaseConfigured) throw new Error('Configure o Firebase do projeto para ativar sua conta. O acesso local de consulta continua disponível.');
}
