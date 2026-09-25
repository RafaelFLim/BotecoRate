---
last_mapped_commit: 2820870289a9cc2559d59677532bea94b733b546
last_mapped_at: 2026-09-25
---
# Codebase Concerns

**Analysis Date:** 2026-09-25

## Tech Debt

**Debug console.log statements in TelaCamera.js:**

- Issue: TelaCamera contains extensive debug logging that should be removed before production or moved behind a debug flag
- Files: `src/screens/TelaCamera.js` (lines 95–99, 116–119)
- Impact: Exposes internal implementation details; clutters console output; wastes CPU cycles; makes troubleshooting harder when multiple screens log simultaneously
- Fix approach: Remove or replace with a centralized debug logger that can be toggled per environment. Alternatively, wrap in `if (__DEV__)` for Expo development mode only

**No data validation when loading from AsyncStorage:**

- Issue: `carregarBares()` and `carregarUsuarios()` parse JSON without schema validation. Corrupted or partial data silently returns invalid objects
- Files: `src/services/storage.js` (lines 5–18), `src/services/authStorage.js` (lines 9–22)
- Impact: App could load malformed bar or user objects, causing crashes downstream when code assumes required fields exist (e.g., `bar.avaliacoes`, `usuario.senha`). No way to detect or recover from corruption
- Fix approach: Add a validation layer that checks shape/type of loaded data, returns sensible defaults for missing fields, or logs a warning and resets to seed data if corruption detected

**Weak ID generation using Date.now():**

- Issue: Multiple places generate IDs via `Date.now().toString()`, which creates collisions if two items are created within the same millisecond
- Files: `src/screens/TelaCadastroBar.js` (lines 126, 177), `src/screens/TelaDetalhesBar.js` (lines 219, 295), `src/screens/TelaCadastroUsuario.js` (line 56), `src/screens/TelaDetalhesItem.js` (line 142)
- Impact: In practice rare on mobile, but theoretically possible. Could cause duplicate IDs leading to silent data loss (one item overwrites another in arrays filtered by ID)
- Fix approach: Use `Date.now() + Math.random()` or a UUID library (e.g., `react-native-uuid`). Test: create bar, then rapidly add item to cardápio before save completes

**Race conditions in AsyncStorage read/write:**

- Issue: Typical flow is `await carregarBares() → manipulate list → await salvarBares()`. If two screens do this simultaneously (e.g., list adds evaluation + detail view edits evaluation), the later write overwrites the earlier changes
- Files: `src/services/storage.js`, all callers (TelaListagemBares, TelaCadastroBar, TelaDetalhesBar, etc.)
- Impact: Data loss. User adds a review in detail screen while list screen reloads—only one change persists
- Fix approach: Implement a write queue or locking mechanism; use a higher-level state management (Redux/Zustand); or document that simultaneous AsyncStorage writes are prohibited and ensure UI prevents overlapping operations

**No error handling for AsyncStorage failures:**

- Issue: Both `carregarBares()` and `salvarBares()` catch errors but only log to console. On save failure, calling code never knows and assumes data was persisted
- Files: `src/services/storage.js` (lines 14–17, 24–26), `src/services/authStorage.js` (lines 18–21, 29–30, 44–47, 54–57)
- Impact: Silent data loss or stale state. A save fails (e.g., out of storage space, permissions revoked), user continues editing, closes app, changes are gone
- Fix approach: Throw errors from save operations; let callers handle failures. Display toast/alert to user on save failure. Add retry logic or fallback

**Hardcoded colors, sizes, and strings throughout screens:**

- Issue: Styling constants and UI strings are scattered in StyleSheet.create() blocks instead of centralized configuration
- Files: All screen files (e.g., `src/screens/TelaListagemBares.js`, `src/screens/TelaLogin.js`, `src/screens/TelaCamera.js`)
- Impact: Changing theme requires editing multiple files. Inconsistent spacing/sizing. Hard to maintain visual consistency
- Fix approach: Create `src/theme/colors.js`, `src/theme/spacing.js`, `src/i18n/strings.js` for centralized constants

**Lack of null/undefined checks before property access:**

- Issue: Code accesses properties like `usuarioLogado.usuario`, `bar.avaliacoes`, `localizacao.latitude` without checking if objects exist first
- Files: `src/screens/TelaListagemBares.js` (line 462), `src/screens/TelaDetalhesBar.js` (line 140), `src/screens/TelaPerfil.js` (line 79), multiple others
- Impact: Null reference errors if a bar loads without expected fields, or if usuarioLogado is somehow null when code assumes it's truthy
- Fix approach: Add defensive checks (`usuarioLogado?.usuario` optional chaining) or assert at entry points (`if (!usuarioLogado) throw new Error(...)`)

## Known Bugs

**setTimeout cleanup missing in TelaListagemBares:**

- Symptoms: If user navigates away from list while welcome message is still fading out, setTimeout continues running in background even after component unmounts
- Files: `src/screens/TelaListagemBares.js` (lines 65–72)
- Trigger: 1. Log in → see welcome message. 2. Immediately click "Perfil" before 2-second timeout ends. 3. Click back to list. Welcome message may trigger again unexpectedly
- Workaround: setTimeout continues harmlessly (no crash), but calling `onFecharBoasVindas()` after unmount is sloppy
- Fix: Add cleanup function: `return () => clearTimeout(tempo);`

**Image components don't handle loading failures:**

- Symptoms: If a bar's photo URI is broken or image fails to load, no fallback UI displays. White space appears instead
- Files: `src/screens/TelaListagemBares.js` (line 29), `src/screens/TelaDetalhesBar.js` (card renders), `src/screens/TelaCadastroBar.js` (line 275)
- Trigger: Upload bar with photo from offline mode → internet restored → photo URL becomes invalid
- Workaround: User sees blank image but can still rate the bar
- Fix: Add `onError` handler to Image; display placeholder or "photo unavailable" message

**Bar without GPS coordinates appears in map but pins are null:**

- Symptoms: If user cadasters bar without GPS, `bar.latitude/longitude` are null. Map screen filters these out (line 52, TelaMapaGPS), but if coordinates are later added via `definirLocalizacao`, the check never re-runs
- Files: `src/screens/TelaMapaGPS.js` (lines 52, layout)
- Trigger: 1. Cadaster bar without GPS → bar in list but not map. 2. Edit bar, set location on map. 3. Go to map screen → bar still missing
- Workaround: Close and reopen app to reload map
- Fix: Re-filter bares when map screen re-mounts; or update map state when location is defined

**Hardcoded edit button shown for all reviews, including others' reviews:**

- Symptoms: Edit/delete buttons (✏️ 🗑️) appear on every review in detail view, not just the logged-in user's reviews
- Files: `src/screens/TelaDetalhesBar.js` (lines 47–64)
- Trigger: View a bar's reviews; see edit/delete buttons on reviews created by other users
- Workaround: Clicking edit/delete on another user's review would fail silently (no action takes, because backend logic in TelaListagemBares only updates if author matches)
- Fix: Verify the `ehPropria` prop is correctly calculated before rendering buttons. Add explicit check in ItemAvaliacao

## Security Considerations

**Plain-text password storage:**

- Risk: Passwords stored in AsyncStorage in plain text. If device is compromised, all passwords are readable
- Files: `src/services/authStorage.js` (documented in comment, line 8; intentional for academic project)
- Current mitigation: Project explicitly acknowledges this as academic-only code. Comment warns developers
- Recommendations: For production, hash passwords with bcrypt or similar before storage. Implement token-based auth instead of storing credentials locally

**No input sanitization on user-entered text:**

- Risk: User-entered names, addresses, descriptions are stored as-is in AsyncStorage. No XSS risk on native app, but if ever synced to web backend or shared, injection attacks possible
- Files: All forms (TelaCadastroBar, TelaCadastroUsuario, TelaPerfil, evaluation comments in TelaDetalhesBar)
- Current mitigation: .trim() is used but no deeper sanitization
- Recommendations: Add input length limits; strip special characters for critical fields (username); use strict field validation

**No CSRF/session protection on AsyncStorage:**

- Risk: AsyncStorage persists session ID indefinitely. If another app gains access to device filesystem, it could read session and assume user identity
- Files: `src/services/authStorage.js` (carregarSessao/salvarSessao)
- Current mitigation: None; biometric gate on app launch provides some protection but insufficient
- Recommendations: Expire sessions after N days; clear session on app update; use encrypted storage if available in Expo

**Biometric fallback to manual re-entry:**

- Risk: TelaBiometria has no rate-limiting on "Tentar novamente" button. Attacker could brute-force biometric prompts
- Files: `src/screens/TelaBiometria.js` (lines 26–28)
- Current mitigation: Each attempt requires actual biometric scan, so brute-force is slow. No account lockout after failures
- Recommendations: Lock biometric screen for N seconds after 3 failed attempts; log failed attempts

## Performance Bottlenecks

**Full list re-render on every bar state change:**

- Problem: TelaListagemBares stores entire `bares` array in React state. Any single bar evaluation change triggers re-render of all 200+ FlatList items
- Files: `src/screens/TelaListagemBares.js` (lines 74–131)
- Cause: No memoization (React.memo) on CardBar component; FlatList `keyExtractor` uses ID but no `extraData` prop to optimize
- Improvement path: Memoize CardBar; add `extraData` to FlatList; or move bar state management outside this screen (Redux/Zustand)
- Expected gain: Noticeable smoothness improvement when adding evaluations or scrolling during updates

**Blocking location requests on CadastroBar load:**

- Problem: TelaCadastroBar requests GPS location on mount and blocks UI with loading spinner until complete or timeout
- Files: `src/screens/TelaCadastroBar.js` (lines 55–103)
- Cause: `obterLocalizacao()` runs synchronously in useEffect without option to proceed without location
- Improvement path: Fetch location in background; allow form to be filled while waiting; show location as optional with "detect later" button
- Expected gain: Faster form load; better UX if GPS is slow

**Reverse geocoding adds extra delay in TelaCadastroBar:**

- Problem: After GPS fetch, reverseGeocodeAsync is called to get address, adding 1–2 seconds extra wait
- Files: `src/screens/TelaCadastroBar.js` (lines 88–95)
- Cause: Network call to Expo Location service not parallelized; runs after location fetch
- Improvement path: Fetch location and reverse geocode in parallel; show spinner only while both are pending
- Expected gain: Slightly faster form load

**No pagination on bar list in TelaListagemBares:**

- Problem: If user database grows to 1000+ bars, entire FlatList loads into memory and renders all cards
- Files: `src/screens/TelaListagemBares.js` (lines 468–479)
- Cause: No pagination or virtualization beyond FlatList's built-in windowing
- Improvement path: Implement pagination (load 20 at a time); add "load more" button; or use FlatList's onEndReached
- Expected gain: Scalability; handles 10K+ bars without memory issues

## Fragile Areas

**TelaBiometria auto-triggers authentication on mount:**

- Files: `src/screens/TelaBiometria.js` (lines 17–19)
- Why fragile: Calls `autenticar()` immediately in useEffect. If biometric prompt fails for any reason (cancelled, timeout, device error), user sees "não foi possível validar a biometria" but cannot easily recover. Also, if user presses back very quickly, race condition between navigation and auth completion could occur
- Safe modification: Wrap auto-trigger in try/catch with timeout; allow user to manually tap "retry" before auto-triggering
- Test coverage: Manual test of biometric cancel flow; test navigation during auth in-flight

**TelaCamera permission request flow:**

- Files: `src/screens/TelaCamera.js` (lines 40–66, 145–189)
- Why fragile: Requests camera AND media permissions together. If one is granted and the other denied (OS allows this), the screen shows "Permissões necessárias" but unclear which one failed. Also, `requestMediaPermission()` uses legacy API (`expo-media-library/legacy`)
- Safe modification: Never rewrite permission logic (per CLAUDE.md), but note: if Expo updates media-library, this screen will break
- Test coverage: Grant camera only, deny media; grant media only, deny camera; revoke permissions after granting; re-request after deny

**TelaMapaGPS location initialization:**

- Files: `src/screens/TelaMapaGPS.js` (lines 17–60)
- Why fragile: Distinguishes between "permission denied" and "GPS disabled" but error messages are hardcoded and slightly confusing. If `getCurrentPositionAsync` times out, it's treated same as error (generic message shown). fitToCoordinates is called in onMapReady which requires mapRef to be ready—if map fails to load, fitToCoordinates silently does nothing
- Safe modification: Per project rules, don't rewrite location logic. But note the distinction between permission/service/timeout/actual-error is not robust
- Test coverage: Test with GPS off; test with permission denied; test with no bars (edge case for fitToCoordinates); test on slow device

## Scaling Limits

**AsyncStorage storage size:**

- Current capacity: Typical Expo AsyncStorage limit is 10MB
- Limit: At ~1KB per bar (with cardápio, avaliacoes, etc.), database maxes out around 10,000 bars. Scaling to city-wide deployment needs backend
- Scaling path: Migrate to cloud database (Supabase, Firebase); implement pagination; sync to local cache

**No backend validation:**

- Current capacity: All data validation happens client-side only. A modified app could send invalid data
- Limit: Once data is synced to backend, invalid entries could corrupt analytics or break assumptions
- Scaling path: Implement API validation; add server-side schema enforcement before accepting data

**Linear search for bar by ID:**

- Current capacity: Finding bar by ID is O(N) in every operation
- Limit: With 10K bars, each operation has measurable delay
- Scaling path: Store bars in Map/Set instead of array; index by ID

## Dependencies at Risk

**Expo SDK 57 + React Native 0.86.3:**

- Risk: Rapid release cycle. Breaking changes between minor versions occur frequently
- Impact: Will need regular updates to stay secure and maintain iOS/Android compatibility
- Migration plan: Monitor Expo SDK changelog; test before updating; pin versions in package.json until ready to migrate

**react-native-maps 1.27.2:**

- Risk: Unmaintained dependency (last update ~1 year ago). Google Maps API changes could break it
- Impact: If Google Maps changes API, map screen stops working with no fix path
- Migration plan: Monitor upstream; be ready to fork or switch to alternative (OpenStreetMap via expo-maps if available)

**expo-media-library/legacy API:**

- Risk: Marked as legacy in latest Expo. Will be removed in future major version
- Impact: TelaCamera.js will stop working after Expo SDK 60+
- Migration plan: Refactor to use non-legacy API before SDK X.0 release; test migration thoroughly since this screen is protected

**No explicit React version pinning:**

- Risk: React 19.2.3 is very new (2024). Potential for stability issues
- Impact: Minor updates could introduce subtle bugs in component lifecycle
- Migration plan: Use react-native-compat if needed; monitor React Native compatibility

## Missing Critical Features

**Map pins not yet implemented (Roadmap Part 4):**

- Problem: TelaMapaGPS shows user location but not bar pins despite having latitude/longitude for each bar
- Blocks: Users cannot see bar locations on map; defeats purpose of GPS feature
- Status: Partially implemented (bars are filtered by coordinates), but Marker rendering loop is not added yet

**New bar photo upload returns URI to caller (Roadmap Part 5):**

- Problem: TelaCamera saves photos to device gallery but onFotoCapturada callback exists and is called. Caller (TelaCadastroBar) can receive URI, but flow not fully tested
- Blocks: TelaCadastroBar cannot properly integrate photo capture without this working
- Status: Code is present but not fully integrated end-to-end

**No delete/edit for bars themselves (only evaluations):**

- Problem: User who created a bar cannot edit bar name, address, photo, or delete the bar
- Blocks: Typos or wrong data cannot be corrected; abandoned bars cannot be removed
- Priority: Medium (lower than evaluation edit, which exists)

**No user-to-user messaging or bar reviews:**

- Problem: Evaluations are anonymous (show author name but no profile). No way to contact bar owner
- Blocks: Users cannot communicate about issues or ask questions
- Priority: Low (out of MVP scope)

## Test Coverage Gaps

**Untested: AsyncStorage write failures:**

- What's not tested: What happens if salvarBares() fails (disk full, permissions revoked mid-operation)
- Files: `src/services/storage.js`
- Risk: Silent data loss. User adds evaluation, sees success message, but data is never persisted
- Priority: High — add integration test that mocks AsyncStorage.setItem to throw; verify error is propagated and user is notified

**Untested: Concurrent evaluation additions:**

- What's not tested: Two rapid evaluations added via rapid taps on submit button
- Files: `src/screens/TelaDetalhesBar.js` (adicionarAvaliacao)
- Risk: Race condition; only one evaluation saved instead of both. ID collision possible with Date.now()
- Priority: High — add stress test; add debouncing to prevent double-submit

**Untested: Bar schema migration:**

- What's not tested: Loading a bar from old app version (no cardápio, detalhes, criadoPor fields)
- Files: `src/screens/TelaListagemBares.js` (lines 91–116 has migration logic)
- Risk: Migrated bars may have undefined fields; downstream code crashes
- Priority: Medium — write unit test for the migration function; verify all fields are populated

**Untested: Location permission edge cases:**

- What's not tested: User grants permission, later revokes in Settings while app is open; GPS enabled then disabled
- Files: `src/screens/TelaMapaGPS.js`, `src/screens/TelaCadastroBar.js`
- Risk: App could crash or show stale data if permissions change at runtime
- Priority: Medium — test with Android/iOS permission change during app session

**Untested: Large cardápio rendering:**

- What's not tested: Bar with 50+ items in cardápio; does FlatList still render smoothly?
- Files: `src/screens/TelaDetalhesBar.js` (cardápio list)
- Risk: Performance degradation or memory leak with large lists
- Priority: Low (MVP unlikely to hit this, but good to know)

**Untested: Biometric sensor unavailable:**

- What's not tested: Device without biometric hardware; biometric permission denied
- Files: `src/screens/TelaBiometria.js`
- Risk: Biometric auth fails, user cannot use app (but has fallback to manual login)
- Priority: Medium — test on device without biometric; verify fallback works

---

*Concerns audit: 2026-09-25*
