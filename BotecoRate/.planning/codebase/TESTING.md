---
last_mapped_commit: 2820870289a9cc2559d59677532bea94b733b546
last_mapped_at: 2026-09-25
---
# Testing Patterns

**Analysis Date:** 2026-09-25

## Test Framework

**Runner:**

- Not detected
- No automated test framework installed (Jest, Vitest, Mocha, etc.)
- No test configuration files present

**Assertion Library:**

- Not applicable (no automated tests)

**Manual Testing:**

```bash
npm run start          # Start Expo CLI dev server
npm run android        # Run on Android emulator
npm run ios            # Run on iOS simulator
npm run web            # Run in web browser
```

## Test File Organization

**Location:**

- No test files found in codebase
- No `__tests__/` directories
- No `.test.js` or `.spec.js` files

**Naming:**

- Not applicable (no test files)

**Structure:**

- Not applicable (no test files)

## Why No Automated Tests

**Project Context:**
This is an intentional academic project design choice, documented in `CLAUDE.md`:

- Undergraduate assignment (7º período de Engenharia de Software)
- Code is deliberately kept simple and didactic for a thesis defense (defesa)
- Focus is on clean, understandable code, not test coverage
- Goal is to explain functionality clearly to evaluators, not maximize automation
- College project with time constraints (not production software)

## Manual Testing Strategy

**Current Approach:**

All testing is done via **manual interaction with the running app**:

1. **Install & Run**
   - `npm install` to get dependencies
   - `npm run start` to start Expo CLI development server
   - `npm run android` or `npm run ios` to run on emulator/simulator
   - `npm run web` to run in browser (limited native feature support)

2. **Test Scenarios by Screen:**

   **TelaLogin (`src/screens/TelaLogin.js`):**
   - Test login with valid credentials
   - Test login with invalid username
   - Test login with invalid password
   - Test "Cadastro de Novo Usuário" button navigation
   - Test biometric login button when session exists
   - Verify error messages display correctly

   **TelaCadastroUsuario (`src/screens/TelaCadastroUsuario.js`):**
   - Create new user with valid data
   - Test validation (empty fields, password mismatch)
   - Navigate back without saving
   - Verify duplicate username detection

   **TelaBiometria (`src/screens/TelaBiometria.js`):**
   - Test biometric authentication (fingerprint/face)
   - Test retry on failed biometric attempt
   - Test "Cancel" button returns to login
   - Note: This screen's internal logic is NOT modified per `CLAUDE.md` rule

   **TelaListagemBares (`src/screens/TelaListagemBares.js`):**
   - Load bar list from AsyncStorage
   - Verify bars display with ratings/medals
   - Click bar card to navigate to details
   - Click "+ Bar" button to show cadastro screen
   - Click "🗺️ Mapa" button to show map
   - Click profile button to show profile
   - Test welcome message appears and disappears after 2 seconds
   - Verify ranking order (highest rated first)
   - Test medal display (🥇 🥈 🥉 for top 3 with evaluations)

   **TelaDetalhesBar (`src/screens/TelaDetalhesBar.js`):**
   - Display bar details (name, address, photo)
   - Show average rating and evaluation count
   - Add new evaluation with rating/comment
   - Edit own evaluation (note: history should track changes)
   - Delete own evaluation (but not others)
   - View evaluation edit history
   - Navigate to menu items and their ratings
   - Add/edit/delete menu items (owner only)
   - Test location setting via map button

   **TelaCadastroBar (`src/screens/TelaCadastroBar.js`):**
   - Get location automatically on screen load
   - Edit location/address manually
   - Capture photo via camera
   - Add menu items before saving
   - Edit menu items
   - Delete menu items
   - Save new bar to AsyncStorage
   - Verify new bar appears in list

   **TelaCamera (`src/screens/TelaCamera.js`):**
   - Request camera permissions
   - Capture photo
   - Save to device gallery
   - Handle permission denial
   - Note: This screen's internal logic is NOT modified per `CLAUDE.md` rule

   **TelaMapaGPS (`src/screens/TelaMapaGPS.js`):**
   - Request location permissions
   - Display current location marker ("Você está aqui")
   - Display markers for all bars with their names/addresses
   - Zoom/pan to see multiple markers
   - Navigate back to list
   - Note: This screen's internal logic is NOT modified per `CLAUDE.md` rule

   **TelaPerfil (`src/screens/TelaPerfil.js`):**
   - Display current user info
   - Change password
   - View account history
   - Logout

3. **AsyncStorage Persistence:**
   - Restart app and verify data persists
   - Clear app data/cache and verify it resets to seed data
   - Test migration logic for older data formats (see `carregarListaDeBares()`)

4. **Error Scenarios:**
   - Disable GPS/location and try to create bar
   - Deny permissions for camera/location/biometric
   - Force app crash recovery (using Expo's error boundary if present)
   - Test with slow network (reverse geocoding delays)

## Mocking

**Framework:**

- Not applicable (no automated tests)

**Manual Approach:**

- Seed data in `src/data/mockBares.js` provides mock bars, evaluations, menu items
- Mock data loaded on first app run via `baresIniciais` constant
- Development uses real Expo APIs (Location, Camera, Biometrics)
- Test device state changes (GPS on/off, permissions) manually in device settings

## Fixtures and Factories

**Test Data:**

Located in `src/data/mockBares.js`:

```javascript
export const baresIniciais = [
  {
    id: '1',
    nome: 'Boteco do Zé',
    endereco: 'Rua das Flores, 123 - Centro',
    foto: 'https://picsum.photos/seed/boteco1/400/300',
    criadoPor: 'joaosilva',
    detalhes: 'Boteco de bairro tradicional...',
    latitude: -23.5505,
    longitude: -46.6333,
    avaliacoes: [
      {
        id: '1a',
        nota: 5,
        comentario: 'Porção de linguiça excelente!',
        criadoEm: '2026-08-10T19:30:00.000Z',
      },
      // ... more evaluations
    ],
    cardapio: [
      {
        id: '1i1',
        tipo: 'comida',
        nome: 'Bolinho de bacalhau',
        descricao: '...',
        valor: 28,
        foto: '...',
        criadoEm: '2026-08-09T17:00:00.000Z',
        editadoEm: null,
        historico: [],
        avaliacoes: [
          // ... item evaluations
        ],
      },
      // ... more items
    ],
  },
  // ... more bars
];
```

**Data Structure Reference:**

Bar object:

```javascript
{
  id: string,                      // Unique identifier
  nome: string,                    // Bar name
  endereco: string,                // Address
  foto: string,                    // Photo URI
  criadoPor: string,               // Username of creator
  detalhes: string,                // Description
  latitude: number,                // GPS latitude
  longitude: number,               // GPS longitude
  avaliacoes: Array<Avaliacao>,   // Bar evaluations
  cardapio: Array<Item>,           // Menu items
}
```

Evaluation object:

```javascript
{
  id: string,
  nota: number,                    // 1-5 rating
  comentario: string,              // User comment
  autor?: string,                  // Username (optional)
  criadoEm: string,                // ISO timestamp
  editadoEm?: string,              // ISO timestamp (if edited)
  historico: Array<HistoricoVersao>, // Edit history
}
```

Menu item object:

```javascript
{
  id: string,
  tipo: 'comida' | 'bebida',       // Item type
  nome: string,                    // Item name
  descricao: string,               // Description
  valor: number,                   // Price
  foto?: string,                   // Photo URI (optional)
  criadoEm: string,                // ISO timestamp
  editadoEm?: string,              // ISO timestamp (if edited)
  historico: Array<HistoricoVersao>, // Edit history
  avaliacoes: Array<Avaliacao>,    // Item ratings
}
```

## Coverage

**Requirements:**

- No coverage requirements defined
- No coverage reports generated
- Not measured or tracked

**View Coverage:**

- Not applicable (no test framework)

## Test Types

**Unit Tests:**

- Not implemented
- Manual testing only

**Integration Tests:**

- Not implemented
- Manual testing verifies full feature workflows

**E2E Tests:**

- Not implemented
- Manual testing via Expo emulator/device is primary verification method

## Common Patterns (Manual Testing)

**Testing Async State Updates:**

- Manually open DevTools or look at app UI to verify state updates
- Example: Add evaluation → verify it appears immediately in UI → restart app → verify it persists in AsyncStorage

**Testing Error Scenarios:**

- Use device settings to disable features (GPS, camera permissions)
- Watch for proper error messages and fallback behavior
- Example: Disable GPS → Try to create bar → Verify error message "A localização do aparelho está desligada."

**Testing Permission Flows:**

- First app run: grant all permissions → verify features work
- Revoke permission in device settings → rerun feature → verify permission dialog appears again
- Deny permission → verify graceful degradation and error message

**Testing Data Migrations:**

- Manually edit AsyncStorage data (via device console or adb)
- Or modify app to save old data format, then update code to new format
- Run `carregarListaDeBares()` logic → verify missing fields are added from seed data

## Development Tools

**Expo CLI:**

- `expo start` opens interactive menu
- Press `a` for Android, `i` for iOS, `w` for web
- Press `j` for logs (useful for seeing `console.log` output)

**React Native Debugger (Optional):**

- Not configured
- Can be installed separately if needed for deeper debugging

**Console Logging:**

- Functions use `console.log()` for error output (see `src/services/storage.js`, `src/services/authStorage.js`)
- View logs in Expo CLI terminal or React Native debugger

## Known Testing Gaps

**Untested Scenarios:**

1. **Biometric Authentication Edge Cases:**
   - Multiple biometric failures and recovery
   - Biometric timeout behavior
   - Device that doesn't support biometrics
   - Internal logic of `TelaBiometria.js` is frozen per project rules

2. **Camera Permission Recovery:**
   - Re-granting camera permission after denying it
   - Internal logic of `TelaCamera.js` is frozen per project rules

3. **GPS/Map Edge Cases:**
   - Very large bar lists (performance degradation)
   - Markers clustered in same location
   - Offline map rendering
   - Internal logic of `TelaMapaGPS.js` is frozen per project rules

4. **Data Corruption:**
   - Corrupted AsyncStorage data
   - Partial writes during power loss
   - No data validation/sanitization on load

5. **Networking:**
   - Reverse geocoding failures (address lookup)
   - Slow network affecting image loading
   - No retry logic for failed operations

6. **Memory/Performance:**
   - Large number of evaluations per bar (>1000)
   - Very large photo files
   - Long comment text

**Priority for Future Testing:**
If automated tests were to be added, priority would be:

1. Pure utility functions (`calcularNotaMedia()`, `calcularDistanciaKm()`, `formatarDataHora()`)
2. Service functions (`carregarBares()`, `salvarBares()`)
3. Complex state logic in screens (map/filter/spread operations)
4. Permission flows (mock Expo APIs)

---

*Testing analysis: 2026-09-25*
