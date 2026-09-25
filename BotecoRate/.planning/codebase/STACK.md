---
last_mapped_commit: 2820870289a9cc2559d59677532bea94b733b546
last_mapped_at: 2026-09-25
---
# Technology Stack

**Analysis Date:** 2026-09-25

## Languages

**Primary:**

- JavaScript (ES6+) - All source code in `App.js`, `src/screens/`, `src/services/`, `src/utils/`, `src/data/`

## Runtime

**Environment:**

- React Native 0.86.3 (JavaScript runtime via Expo)
- Expo SDK 57.0.25 (managed React Native platform)

**Package Manager:**

- npm (Node Package Manager)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**

- React 19.2.3 - UI component framework and state management
- React Native 0.86.3 - Cross-platform mobile framework (Android/iOS)
- Expo 57.0.25 - Managed React Native runtime and build tooling

**Testing:**

- Not detected

**Build/Dev:**

- @expo/ngrok 4.1.3 - Development tunneling and local testing
- Expo CLI (bundled with expo package) - Development server and build management

## Key Dependencies

**Critical:**

- `react` 19.2.3 - Core UI framework
- `react-native` 0.86.3 - Mobile platform implementation
- `expo` ~57.0.25 - Managed runtime, build, and deployment

**Device/Hardware APIs:**

- `expo-camera` ~57.0.5 - Camera access and capture (`src/screens/TelaCamera.js`)
- `expo-local-authentication` ~57.0.3 - Biometric authentication (fingerprint, Face ID) (`src/screens/TelaBiometria.js`)
- `expo-location` ~57.0.20 - GPS/location services (`src/screens/TelaMapaGPS.js`)
- `expo-media-library` ~57.0.5 - Photo gallery access and save (`src/screens/TelaCamera.js`)

**Storage & State:**

- `@react-native-async-storage/async-storage` 2.2.0 - Local device storage for bars and users (`src/services/storage.js`, `src/services/authStorage.js`)

**UI & Navigation:**

- `react-native-safe-area-context` ~5.7.0 - Safe area insets for notched devices (used in `App.js`, screen components)
- `react-native-maps` 1.27.2 - Maps display with markers (`src/screens/TelaMapaGPS.js`)

## Configuration

**Environment:**

- No `.env` file required - application runs with embedded configuration
- Runtime configuration via `app.json`

**Build:**

- `app.json` - Expo configuration, permissions, plugins, app metadata
- `package.json` - Dependencies and npm scripts
- `index.js` - Entry point with `registerRootComponent(App)` from Expo

**App Permissions (Android):**

- `android.permission.ACCESS_FINE_LOCATION` - Precise GPS location
- `android.permission.ACCESS_COARSE_LOCATION` - Approximate location
- `android.permission.CAMERA` - Camera device access
- `android.permission.READ_MEDIA_IMAGES` - Photo library read access (Android 13+)
- `android.permission.WRITE_EXTERNAL_STORAGE` - External storage write (photo save)

**App Permissions (iOS):**

- `NSLocationWhenInUseUsageDescription` - Location usage during app use
- `NSCameraUsageDescription` - Camera access reason
- `NSPhotoLibraryAddUsageDescription` - Photo save reason
- `faceIDPermission` plugin - Face ID biometric authentication

## Platform Requirements

**Development:**

- Node.js (LTS recommended)
- npm or yarn
- Expo CLI (`npm install -g expo-cli` or `npx expo`)
- Android SDK (for Android development) or Xcode (for iOS development)
- Physical device or emulator (Android/iOS)

**Production/Deployment:**

- Expo Go app (for testing) or native build via Expo Cloud Build
- Target platforms: Android (API 24+) and iOS (14.0+) via native compilation

---

*Stack analysis: 2026-09-25*
