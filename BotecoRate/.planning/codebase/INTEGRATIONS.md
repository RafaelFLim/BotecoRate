---
last_mapped_commit: 2820870289a9cc2559d59677532bea94b733b546
last_mapped_at: 2026-09-25
---
# External Integrations

**Analysis Date:** 2026-09-25

## APIs & External Services

**Image Placeholder Service:**

- picsum.photos - Placeholder images for bars and menu items
  - SDK/Client: Direct URL construction in `src/data/mockBares.js` (e.g., `https://picsum.photos/seed/boteco1/400/300`)
  - Auth: None (public, no key required)
  - Usage: Demonstrates bar and menu item photos in UI; not essential (photos can be null)

## Data Storage

**Databases:**

- Device-local only (no remote database)
  - AsyncStorage via `@react-native-async-storage/async-storage`
  - Connection: Native device storage
  - Client: `src/services/storage.js` (`carregarBares()`, `salvarBares()`) and `src/services/authStorage.js` (`carregarUsuarios()`, `salvarUsuarios()`, `carregarSessao()`, `salvarSessao()`)
  - Storage keys:
    - `@boteco_rate_bares` - Full list of bars with evaluations and menu items
    - `@boteco_rate_usuarios` - User accounts with credentials (passwords stored as plaintext for academic project)
    - `@boteco_rate_sessao` - Current logged-in user session ID

**File Storage:**

- Local filesystem via Expo Media Library
  - Implementation: `src/screens/TelaCamera.js` uses `MediaLibrary.saveToLibraryAsync()` to store photos in device gallery
  - Auth: Camera and photo library permissions requested at runtime

**Caching:**

- None (all data reloaded from AsyncStorage on screen mount)

## Authentication & Identity

**Auth Provider:**

- Custom local authentication (device-only, no server)
  - Implementation: Username/password stored in AsyncStorage (`src/services/authStorage.js`)
  - Biometric gate: Fingerprint/Face ID via `expo-local-authentication` in `src/screens/TelaBiometria.js`
  - Session: Last logged-in user ID stored in `@boteco_rate_sessao` for biometric quick-login

**Authentication Flow:**

1. `TelaLogin.js` - Username/password entry
2. `src/services/authStorage.js` - Credentials validation against stored users
3. `TelaCadastroUsuario.js` - New user registration
4. `TelaBiometria.js` - Biometric unlock for previously logged-in user

## Monitoring & Observability

**Error Tracking:**

- None (no external error tracking service)

**Logs:**

- Console logging only
  - `src/services/storage.js` - `console.log()` for AsyncStorage errors
  - `src/services/authStorage.js` - `console.log()` for storage errors
  - `src/screens/TelaMapaGPS.js` - `setErrorMsg()` for location/GPS errors shown to user

## CI/CD & Deployment

**Hosting:**

- No remote hosting (mobile-only via Expo)
- Deployment target: Android and iOS native apps
- Testing: Expo Go app or native binary build via EAS (Expo Application Services)

**CI Pipeline:**

- None detected (academic project, no automated CI/CD)

## Environment Configuration

**Required env vars:**

- None (no external APIs requiring keys)

**Secrets location:**

- No external secrets management
- Credentials stored locally in AsyncStorage (plaintext, for academic purposes only)

## Webhooks & Callbacks

**Incoming:**

- None

**Outgoing:**

- None

## Device APIs (Native Integrations)

**Camera & Media:**

- `expo-camera` - Real-time camera feed and photo capture (`src/screens/TelaCamera.js`)
- `expo-media-library` - Save photos to device gallery
- Permissions: Camera + Read/Write Media requested at runtime

**Location Services:**

- `expo-location` - GPS coordinates and location permissions (`src/screens/TelaMapaGPS.js`)
- Requires: Device GPS enabled + location permission granted
- Returns: Latitude, longitude, altitude, accuracy, bearing

**Biometric Authentication:**

- `expo-local-authentication` - Fingerprint/Face ID biometric unlock
- Implementation: `src/screens/TelaBiometria.js`
- Fallback: Password-based login if biometric unavailable

**Maps Display:**

- `react-native-maps` - Interactive map with markers (`src/screens/TelaMapaGPS.js`)
- Integration: Shows user location + bar locations as pins (title: bar name, description: address)
- Requires: Device location services + Google Maps API (bundled with native build, no external key needed)

## Data Format & Serialization

**Bar Structure** (stored in AsyncStorage):

```javascript
{
  id: string,
  nome: string,
  endereco: string,
  foto: string|null,
  criadoPor: string,
  detalhes: string,
  latitude: number,
  longitude: number,
  avaliacoes: [{ id, nota, comentario, criadoEm }],
  cardapio: [{ id, tipo, nome, descricao, valor, foto, criadoEm, editadoEm, historico, avaliacoes }]
}
```

**User Structure** (stored in AsyncStorage):

```javascript
{
  id: string,
  usuario: string,
  senha: string,
  email: string
}
```

---

*Integration audit: 2026-09-25*
