---
last_mapped_commit: 2820870289a9cc2559d59677532bea94b733b546
last_mapped_at: 2026-09-25
---
<!-- refreshed: 2026-09-25 -->

# Architecture

**Analysis Date:** 2026-09-25

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         App.js (Root Navigation)                             │
│        Screen state: tela | usuarioLogado | mensagemBoasVindas              │
├──────────────────┬──────────────────────────┬──────────────────┬─────────────┤
│  TelaLogin       │  TelaCadastroUsuario     │  TelaBiometria   │  TelaMapaGPS │
│ `screens/[1]`    │ `screens/[2]`            │ `screens/[3]`    │ `screens/[9]`│
│                  │                          │                  │              │
│                  │                          │                  └──────────────┘
│                  │                          │
│                  │                          └─────────────────────────────────┐
│                  └──────────────────────────┐                                  │
│                                              │                                  │
└──────────────────────────────────────────────┼──────────────────────────────────┘
                                               │
                                               ▼
                        ┌───────────────────────────────────────┐
                        │  TelaListagemBares                     │
                        │  `screens/TelaListagemBares.js`        │
                        │  State: bares | barSelecionadoId       │
                        │        mostrarCadastro | mostrarPerfil │
                        └───────────────────────────────────────┘
                         │ barSelecionadoId=null   │ barSelecionadoId≠null
                         ▼                         ▼
              [List View]                 ┌──────────────────────────┐
                                          │ TelaDetalhesBar          │
                                          │ `screens/[8]`            │
                                          │ Sub-navigation (local)   │
                                          │                          │
                                          │ mostrarCadastro=true ────┼──→ TelaFormularioItem
                                          │                     │    │
                                          │                     └─→ TelaDetalhesItem
                                          └──────────────────────────┘
                         │
                         ├─→ mostrarCadastro=true: TelaCadastroBar
                         │                         `screens/[5]`
                         │                         ↓ camera
                         │                         TelaCamera `screens/[7]`
                         │
                         └─→ mostrarPerfil=true:   TelaPerfil
                                                   `screens/[11]`

┌─────────────────────────────────────────────────────────────────────────────┐
│                       Services Layer (AsyncStorage)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ src/services/storage.js                  src/services/authStorage.js         │
│ carregarBares()                          carregarUsuarios()                  │
│ salvarBares(lista)                       salvarUsuarios(lista)               │
│                                          carregarSessao()                     │
│                                          salvarSessao(usuarioId)              │
└──────────────────────────────────────────────────────────────────────────────┘
                    │                                    │
                    ▼                                    ▼
        ┌───────────────────────┐        ┌──────────────────────────┐
        │  @boteco_rate_bares   │        │ @boteco_rate_usuarios    │
        │  @boteco_rate_sessao  │        │                          │
        │  AsyncStorage Keys    │        │ AsyncStorage Keys        │
        └───────────────────────┘        └──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        Utilities Layer                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ src/utils/nota.js → calcularNotaMedia(avaliacoes)                            │
│ src/utils/distancia.js → calcularDistanciaKm() | formatarDistancia()        │
│ src/utils/data.js → formatarDataHora(dataIso)                              │
│ src/utils/senha.js → validarSenha(senha)                                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        Data Layer (Seed)                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ src/data/mockBares.js → baresIniciais (arrays with full bar schema)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | Global navigation state, route switching via `tela` state | `App.js` |
| TelaLogin | User authentication, session detection, biometric entry point | `src/screens/TelaLogin.js` |
| TelaCadastroUsuario | New user registration, password validation | `src/screens/TelaCadastroUsuario.js` |
| TelaBiometria | Biometric unlock (do not modify internal logic) | `src/screens/TelaBiometria.js` |
| TelaListagemBares | Load bars, manage list state, handle local sub-navigation to details, manage add/edit bar and profile overlays | `src/screens/TelaListagemBares.js` |
| TelaDetalhesBar | Display bar info, handle rating creation/edit/delete, manage menu items, local sub-navigation to item details | `src/screens/TelaDetalhesBar.js` |
| TelaMapaGPS | Load current location, display bar markers on map (do not modify location logic) | `src/screens/TelaMapaGPS.js` |
| TelaCadastroBar | Form to add new bar (name, address, GPS location, photo via camera) | `src/screens/TelaCadastroBar.js` |
| TelaCamera | Capture photo via device camera (do not rewrite capture logic) | `src/screens/TelaCamera.js` |
| TelaPerfil | Display user info, allow password change | `src/screens/TelaPerfil.js` |
| TelaDetalhesItem | Display menu item details, manage item ratings | `src/screens/TelaDetalhesItem.js` |
| TelaFormularioItem | Form to add/edit menu items | `src/screens/TelaFormularioItem.js` |
| storage.js | Whole-list read/write for bars to AsyncStorage (@boteco_rate_bares) | `src/services/storage.js` |
| authStorage.js | Whole-list read/write for users (@boteco_rate_usuarios), session management (@boteco_rate_sessao) | `src/services/authStorage.js` |

## Pattern Overview

**Overall:** Screen-based Single-Page App (SPA) with local state navigation and AsyncStorage persistence.

**Key Characteristics:**

- No external navigation library (React Navigation, Expo Router) — all routing via `useState` in `App.js`
- Screens manage their own local sub-navigation (e.g., `TelaListagemBares` → `TelaDetalhesBar` via internal state)
- Services are thin wrappers around AsyncStorage — screens own all business logic (combining, filtering, calculations)
- Data is always loaded as a whole list on screen mount, modified in component state, then persisted as a whole list
- No derived state — average ratings are computed on-demand via utility functions, never stored

## Layers

**Presentation (Screens):**

- Purpose: Render UI, manage local state, handle user interactions
- Location: `src/screens/`
- Contains: React Native components (Text, View, TouchableOpacity, FlatList, etc.), form handling, local navigation state
- Depends on: Services (for persistence), utilities (for calculations), data (for seed)
- Used by: App.js (root coordinator)

**Services:**

- Purpose: Persist state to AsyncStorage, provide simple read/write interface
- Location: `src/services/`
- Contains: `storage.js` (bar persistence), `authStorage.js` (user + session persistence)
- Depends on: AsyncStorage
- Used by: All screens that need to load or save data

**Utilities:**

- Purpose: Pure functions for calculations and formatting
- Location: `src/utils/`
- Contains: `nota.js` (rating average), `distancia.js` (geo calculations), `data.js` (date formatting), `senha.js` (password validation)
- Depends on: Nothing (pure functions)
- Used by: Screens that need computed values

**Data:**

- Purpose: Provide seed/initial data for first app launch
- Location: `src/data/`
- Contains: `mockBares.js` (array of bar objects with full schema)
- Depends on: Nothing (static data)
- Used by: `TelaListagemBares` and `TelaMapaGPS` for initial load if AsyncStorage is empty

## Data Flow

### Primary Request Path (Login → List → Details → Evaluate)

1. **App.js mounts** — `tela` state defaults to 'login' (`App.js:12`)
2. **TelaLogin renders** — loads users from AsyncStorage via `carregarUsuarios()` (`TelaLogin.js:31`)
3. **User submits login** — validates credentials against loaded users (`TelaLogin.js:50-62`), saves session via `salvarSessao()`, calls `onEntrar(usuario)` callback
4. **App.js receives callback** — sets `usuarioLogado`, sets `tela` to 'lista' (or 'biometria' if biometric entry) (`App.js:63-72`)
5. **TelaListagemBares mounts** — loads bars via `carregarBares()` in `useEffect` (`TelaListagemBares.js:60-62`)
6. **User selects bar** — `barSelecionadoId` is set via `setBarSelecionadoId(bar.id)` (`TelaListagemBares.js:56`)
7. **TelaDetalhesBar renders** instead of list (conditional rendering based on `barSelecionadoId !== null`) (`TelaListagemBares.js:not shown but follows pattern`)
8. **User submits rating** — new avaliacao object created, `adicionarAvaliacao(barId, novaAvaliacao)` is called
9. **TelaListagemBares.adicionarAvaliacao** — finds bar in `bares` array, prepends new rating to `avaliacoes`, updates local state via `setBares()`, calls `salvarBares()` (`TelaListagemBares.js:136-147`)
10. **AsyncStorage persisted** — `salvarBares()` serializes and saves entire `bares` array to key `@boteco_rate_bares` (`storage.js:20-27`)

### Secondary Flow: Bar Details Sub-Navigation

Within `TelaListagemBares`, the component can also navigate to show menu items or edit cardápio:

1. **User selects menu item in TelaDetalhesBar** — `TelaDetalhesItem` is rendered via local state
2. **User rates or edits item** — `adicionarAvaliacaoItem()`, `editarAvaliacaoItem()`, or `excluirAvaliacaoItem()` called
3. **TelaListagemBares.adicionarAvaliacaoItem()** — updates `bar.cardapio[itemIndex].avaliacoes`, calls `setBares()` + `salvarBares()` (`TelaListagemBares.js:277+`)

### Bar Creation Flow

1. **User taps "Novo bar" in TelaListagemBares** — `mostrarCadastro` state set to true
2. **TelaCadastroBar renders** — user fills name, address, optionally selects photo via TelaCamera
3. **User submits** — new bar object created with `id`, `nome`, `endereco`, `foto`, `latitude`, `longitude`, `avaliacoes: []`
4. **TelaCadastroBar calls parent callback** (through prop-passed closure) — triggers `carregarBares()`, appends new bar, calls `salvarBares()` in parent
5. **Parent re-renders** with updated list

**State Management:** Component-local via `useState`. No global state manager (Redux, Zustand, Context API). Each screen owns its state.

## Key Abstractions

**Bar Object:**

- Purpose: Represents a boteco/bar with ratings, location, and menu items
- Schema:
  ```
  {
    id: string,
    nome: string,
    endereco: string,
    foto: string (URI),
    latitude: number,
    longitude: number,
    detalhes: string (long-form description),
    criadoPor: string (username of creator),
    avaliacoes: [
      {
        id: string,
        nota: number (1-5),
        comentario: string,
        autor: string (username),
        criadoEm: ISO string,
        editadoEm: ISO string | null,
        historico: [ { nota, comentario, data } ]
      }
    ],
    cardapio: [
      {
        id: string,
        tipo: string ('comida' | 'bebida' | etc),
        nome: string,
        descricao: string,
        valor: number,
        foto: string (URI),
        criadoEm: ISO string,
        editadoEm: ISO string | null,
        historico: [ { tipo, nome, descricao, valor, foto, data } ],
        avaliacoes: [ { id, nota, comentario, autor, criadoEm, editadoEm, historico } ]
      }
    ]
  }
  ```
- Examples: `src/data/mockBares.js` (lines 1–N contain full examples)
- Pattern: Immutable updates via spread operator and `.map()` to preserve reference equality for React re-render

**User Object:**

- Purpose: Represents a registered user account
- Schema:
  ```
  {
    id: string (UUID or timestamp-based),
    usuario: string (username, unique),
    senha: string (plaintext in this academic app, hash in production)
  }
  ```
- Pattern: Stored as array in AsyncStorage; login searches array for matching username + password

**Session Object:**

- Purpose: Stores ID of last user who logged in on this device (enables biometric quick-entry)
- Schema:
  ```
  { usuarioId: string }
  ```
- Pattern: Single object (not array); stored in AsyncStorage key `@boteco_rate_sessao`

## Entry Points

**App.js:**

- Location: `App.js` (root of project)
- Triggers: App startup
- Responsibilities: Global navigation state (`tela`), user session state (`usuarioLogado`), welcome message state; renders active screen component based on `tela` value; passes callbacks for navigation to child screens

**TelaLogin:**

- Location: `src/screens/TelaLogin.js`
- Triggers: When `tela === 'login'`
- Responsibilities: Load existing users, show login form or quick-biometric button, validate credentials, trigger session save, call parent callback `onEntrar(usuario)`

**TelaListagemBares:**

- Location: `src/screens/TelaListagemBares.js`
- Triggers: When `tela === 'lista'` (main app screen after login)
- Responsibilities: Load bars from AsyncStorage, render list of cards, handle sub-navigation to details/profile/new-bar screens, persist any changes to ratings or bars

## Architectural Constraints

- **Threading:** Single-threaded JavaScript event loop (React Native default). AsyncStorage reads/writes are asynchronous but non-concurrent (no parallel writes to same key).
- **Global state:** No module-level singletons. All state is component-local via `useState`. App.js holds the "session truth" (`usuarioLogado` and `tela`).
- **Circular imports:** None detected. Services import nothing from screens; screens import services and utilities (one-way dependency).
- **Navigation without router:** Manual `setState` in root component. Screens pass callbacks up to App.js to trigger screen changes. Child screens (e.g., TelaDetalhesBar inside TelaListagemBares) use local state (`barSelecionadoId`, `mostrarCadastro`, etc.) for sub-navigation.
- **Fixed logic:** Do NOT modify internal logic of `TelaBiometria.js`, `TelaCamera.js`, or `TelaMapaGPS.js` location-retrieval code. These are stable and tested.
- **No dependency injection or context:** Props are passed down; callbacks passed up. Simple, explicit data flow.

## Anti-Patterns

### Global State in Window/Module Scope

**What happens:** Code used to use module-level variables instead of React state.
**Why it's wrong:** React re-renders won't detect changes; multiple re-renders will see stale values.
**Do this instead:** Use `useState()` for all mutable state (`TelaListagemBares.js:54-58` shows correct pattern).

### Mutating State Directly

**What happens:** Code like `bares[0].avaliacoes.push(novaAvaliacao)` or `bar.nome = 'newName'`
**Why it's wrong:** React won't detect the mutation; UI won't re-render.
**Do this instead:** Use spread operator and `.map()` to create new arrays: `const novaLista = bares.map((bar) => bar.id === barId ? { ...bar, avaliacoes: [novaAvaliacao, ...bar.avaliacoes] } : bar); setBares(novaLista);` (`TelaListagemBares.js:136-147`)

### Storing Computed Values in State

**What happens:** Saving average rating as `bar.notaMedia` in AsyncStorage.
**Why it's wrong:** If ratings are edited, the computed value becomes stale and must be manually invalidated.
**Do this instead:** Compute on-demand: `calcularNotaMedia(bar.avaliacoes)` whenever you need it (`TelaListagemBares.js:25` shows correct pattern).

### Mixing Navigation and Business Logic

**What happens:** Screen calls `salvarBares()`, checks if save succeeded, then calls navigation callback.
**Why it's wrong:** If save fails silently, navigation still happens; UI state and persisted state diverge.
**Do this instead:** Screens always update local state immediately (optimistic), then persist asynchronously in background (`TelaListagemBares.js:137-146` shows pattern: `setBares()` happens before `salvarBares()` awaits).

## Error Handling

**Strategy:** Graceful degradation with console logging. Service functions catch AsyncStorage errors and return fallback values (null or empty array) instead of throwing.

**Patterns:**

1. **Persistence errors** — `salvarBares()` catches error, logs it, continues (data stays in RAM but is lost on app restart) (`storage.js:20-27`)
2. **Load errors** — `carregarBares()` catches error, logs it, returns null; caller then falls back to seed data (`storage.js:5-18` and `TelaListagemBares.js:74-82`)
3. **Location errors** — `TelaMapaGPS` catches location permission/GPS-disabled errors, shows error message, allows user to retry (`TelaMapaGPS.js:28-60`)
4. **Authentication errors** — `TelaLogin` shows user-facing error message (e.g., "Usuário ou senha inválidos") instead of crashing (`TelaLogin.js:44-62`)
5. **Validation errors** — Form screens validate before submitting; invalid password shows reason text (e.g., "A senha precisa ter no mínimo 8 caracteres") (`senha.js:2-16`)

## Cross-Cutting Concerns

**Logging:** Basic `console.log()` in error handlers. No centralized logging framework. Development-only visibility (no production logging service).

**Validation:** Each screen is responsible for validating its inputs before persisting:

- Passwords: `validarSenha()` utility checks min 8 chars, uppercase, special char (`src/utils/senha.js`)
- Rating: `nota` must be 1–5 (enforced by UI radio buttons)
- Bar fields: Forms prevent empty name/address submission (UI-level checks)

**Authentication:** Simple username/password matching (plaintext storage in this academic app). Session stored to remember last user for biometric quick-entry. No token/JWT.

**Localization:** All UI text is in Portuguese (pt-BR). Date formatting is manual (not using Intl API) to avoid locale dependencies (`src/utils/data.js:1-2`).

---

*Architecture analysis: 2026-09-25*
