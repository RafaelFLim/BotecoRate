---
last_mapped_commit: 2820870289a9cc2559d59677532bea94b733b546
last_mapped_at: 2026-09-25
---
# Coding Conventions

**Analysis Date:** 2026-09-25

## Naming Patterns

**Files:**

- Screen components: `Tela` + `DescriptionInCamelCase` + `.js`
  - Examples: `TelaListagemBares.js`, `TelaCadastroBar.js`, `TelaLogin.js`
  - Location: `src/screens/`
- Service files: lowercase descriptive name + `.js`
  - Examples: `storage.js`, `authStorage.js`
  - Location: `src/services/`
- Utility files: lowercase descriptive name + `.js`
  - Examples: `nota.js`, `data.js`, `distancia.js`, `senha.js`
  - Location: `src/utils/`
- Data/seed files: camelCase descriptive name + `.js`
  - Example: `mockBares.js`
  - Location: `src/data/`

**Functions:**

- Async functions performing actions: verb + description in camelCase
  - Examples: `carregarBares()`, `salvarBares()`, `adicionarAvaliacao()`, `editarAvaliacao()`, `excluirAvaliacao()`, `fazerLogin()`, `obterLocalizacao()`
- Pure utility functions: descriptive camelCase
  - Examples: `calcularNotaMedia()`, `calcularDistanciaKm()`, `formatarDataHora()`, `montarEndereco()`
- Screen component functions: PascalCase (React convention)
  - Examples: `TelaListagemBares()`, `CardBar()`, `SeletorDeNota()`, `ItemAvaliacao()`

**Variables:**

- State variables: camelCase, descriptive
  - Examples: `usuarios`, `carregando`, `barSelecionado`, `mensagemBoasVindas`, `erro`, `bares`, `mostrarCadastro`
- Local variables in functions: camelCase
  - Examples: `novaLista`, `encontrado`, `dadosSalvos`, `localizacao`
- Object properties: camelCase
  - Examples: `bar.id`, `bar.nome`, `bar.endereco`, `avaliacao.nota`, `avaliacao.comentario`
- Boolean variables: typically start with is-, has-, or action-specific prefix
  - Examples: `carregando`, `temHistorico`, `ehPropria`, `precisaSalvar`, `cadastrarSemLocalizacao`

**Constants:**

- Storage keys and configuration: SCREAMING_SNAKE_CASE
  - Examples: `MEDALHAS`, `STORAGE_KEY`, `USUARIOS_KEY`, `SESSAO_KEY`, `raioTerraKm`
- Exported constants: SCREAMING_SNAKE_CASE
  - Example: `MEDALHAS = ['🥇', '🥈', '🥉']`

**Component Props & Callbacks:**

- Callback props: `on` + ActionName in camelCase
  - Examples: `onVoltar()`, `onCadastrar()`, `onAvaliar()`, `onFecharBoasVindas()`, `onAbrirMapa()`, `onSair()`, `onAbrir()`, `onEditar()`, `onExcluir()`
- Handler functions: verb + camelCase or on + ActionName
  - Examples: `sair()`, `atualizarSenhaUsuarioLogado()`, `carregarListaDeBares()`, `adicionarAvaliacao()`

## Code Style

**Formatting:**

- No automated linter or formatter configured (ESLint/Prettier not used)
- Style follows React Native conventions by default
- Indentation: 2 spaces (observed in source files)
- Line length: flexible, no hard limit observed
- Semicolons: always used (JavaScript default)

**Imports:**

- Order convention:
  1. React/React Native imports
  2. Expo imports
  3. Third-party React Native libraries
  4. Local imports (services, utils, screens, data)
- Example from `TelaListagemBares.js`:
  ```javascript
  import { useEffect, useState } from 'react';
  import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
  } from 'react-native';
  import { StatusBar } from 'expo-status-bar';
  import { SafeAreaView } from 'react-native-safe-area-context';
  import { carregarBares, salvarBares } from '../services/storage';
  import { baresIniciais } from '../data/mockBares';
  import { calcularNotaMedia } from '../utils/nota';
  import TelaDetalhesBar from './TelaDetalhesBar';
  ```
- No destructuring of default exports
- No barrel files (index.js)

**Styling:**

- `StyleSheet.create({})` co-located at end of each screen file
- Style object names: camelCase ending with style context
  - Examples: `container`, `header`, `card`, `btnEntrar`, `avisoBoasVindas`, `nomeBar`
- Styles defined once per component, not dynamically generated

## Component Structure

**Screen Components:**

- Large files (150-600+ lines) are acceptable
- Inline sub-components (CardBar, SeletorDeNota, ItemAvaliacao) used for simple, single-use UI
- State management via `useState` for all data
- No external state management (Redux, Context)
- Props passed explicitly (prop drilling accepted)
- Conditional rendering via:
  - Logical operators: `condition && <Component />`
  - Ternary operators: `condition ? <A /> : <B />`
  - State branching: `if (state === 'value') return <Component />`

**Service Modules:**

- Simple read/write functions
- No business logic — services only handle persistence (`src/services/storage.js`, `src/services/authStorage.js`)
- Error handling with try/catch, return null/empty array on failure
- Examples:
  ```javascript
  // src/services/storage.js
  export async function carregarBares() {
    try {
      const dadosSalvos = await AsyncStorage.getItem(STORAGE_KEY);
      if (dadosSalvos !== null) {
        return JSON.parse(dadosSalvos);
      }
      return null;
    } catch (error) {
      console.log('Erro ao carregar bares:', error);
      return null;
    }
  }

  export async function salvarBares(listaDeBares) {
    try {
      const dados = JSON.stringify(listaDeBares);
      await AsyncStorage.setItem(STORAGE_KEY, dados);
    } catch (error) {
      console.log('Erro ao salvar bares:', error);
    }
  }
  ```

**Utility Modules:**

- Pure functions with no side effects
- Examples: `calcularNotaMedia()` (sum and average), `calcularDistanciaKm()` (Haversine formula), `formatarDataHora()` (date formatting)
- No external dependencies
- Located in `src/utils/`

## Error Handling

**Strategy:**

- Defensive programming with guard clauses
- Try/catch for async operations (AsyncStorage, Location, Camera API)
- Return null or empty array on error (predictable fallback)
- Simple console.log for error logging (no error tracking)
- State-based error messages for user feedback
- Alert() for critical user-facing errors (permission denials, validation failures)

**Patterns:**

Guard clauses for early return:

```javascript
async function fazerLogin() {
  if (usuarios.length === 0) {
    setErro('Nenhuma conta cadastrada ainda. Crie uma conta primeiro.');
    return;
  }

  const encontrado = usuarios.find(
    (u) => u.usuario.toLowerCase() === usuario.trim().toLowerCase() && u.senha === senha
  );

  if (encontrado === undefined) {
    setErro('Usuário ou senha inválidos.');
    return;
  }

  setErro('');
  await salvarSessao(encontrado.id);
  onEntrar(encontrado);
}
```

Try/catch for async operations:

```javascript
async function obterLocalizacao() {
  setErrorMsg(null);
  setCarregandoLocalizacao(true);

  try {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permissão da localização negada!');
      setCarregandoLocalizacao(false);
      return;
    }

    const servicosLigados = await Location.hasServicesEnabledAsync();
    if (!servicosLigados) {
      setErrorMsg('A localização do aparelho está desligada.');
      setCarregandoLocalizacao(false);
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setLocalizacao(location.coords);
  } catch (error) {
    console.log('Erro ao obter a localização:', error);
    setErrorMsg('Não foi possível obter sua localização.');
  } finally {
    setCarregandoLocalizacao(false);
  }
}
```

## Logging

**Framework:** `console.log` (browser/React Native built-in)

**Patterns:**

- Errors logged with context message: `console.log('Context:', error)`
- Examples from codebase:
  ```javascript
  console.log('Erro ao carregar bares:', error);
  console.log('Erro ao salvar bares:', error);
  console.log('Não foi possível descobrir o endereço:', error);
  ```
- No info/debug/warn/error levels used
- No structured logging
- No external logging service (Sentry, Crashlytics)

## Comments

**When to Comment:**

- Complex algorithm or business logic
- Non-obvious workaround or edge case
- Explanation of WHY, not WHAT (code should be self-explanatory)
- Multi-step processes that benefit from explanation
- Example from `TelaListagemBares.js`:
  ```javascript
  // Bar salvo antes de detalhes/cardápio/criadoPor existirem (mesmo id do
  // mockBares.js, mas gravado num app mais antigo) fica sem esses campos —
  // completa com o que o seed tem, sem mexer no que a pessoa já editou
  // (avaliações, foto, etc.).
  ```

**Section Headers:**

- Use dashes to delimit section headers: `// ─── SectionName ──────────`
- Example from `App.js`:
  ```javascript
  // ─── App root ─────────────────────────────────────────────────────────────────
  export default function App() {
  ```

**Doc Comments:**

- No JSDoc/TSDoc used
- Comments are inline, informal, in Portuguese
- Example:
  ```javascript
  // O aviso de boas-vindas fica 2 segundos na tela e some sozinho.
  useEffect(() => {
    if (mensagemBoasVindas === null) {
      return;
    }

    const tempo = setTimeout(onFecharBoasVindas, 2000);
    return () => clearTimeout(tempo);
  }, [mensagemBoasVindas]);
  ```

## Function Design

**Size:**

- No explicit size limit, but functions typically 10-50 lines
- Screen components can be 200+ lines and remain readable due to clear structure
- Inline sub-components acceptable for simple, single-use UI

**Parameters:**

- Destructured object parameters for components (React convention)
- Simple parameters for utility functions
- Callback props passed as individual functions (not object of callbacks)
- Example destructuring in screen:
  ```javascript
  export default function TelaListagemBares({
    usuarioLogado,
    mensagemBoasVindas,
    onFecharBoasVindas,
    onAbrirMapa,
    onSair,
    onSenhaAlterada,
  }) {
  ```

**Return Values:**

- Async functions return data or null on error
- Handlers typically return nothing (void)
- Pure utilities return computed values
- Components return JSX

**Async/Await:**

- Used consistently for all async operations
- No Promises used directly
- Example:
  ```javascript
  async function carregarListaDeBares() {
    const dadosSalvos = await carregarBares();

    if (dadosSalvos === null) {
      setBares(baresIniciais);
      await salvarBares(baresIniciais);
      setCarregando(false);
      return;
    }
    // ... rest of logic
  }
  ```

## Module Design

**Exports:**

- Named exports for functions (not default exports for utilities/services)
- Default export for screen components only
- Example from `src/services/storage.js`:
  ```javascript
  export async function carregarBares() { ... }
  export async function salvarBares(listaDeBares) { ... }
  ```

**File Organization:**

- Each screen is one component (no component files for sub-components)
- Styles co-located with component at bottom of file
- Utilities grouped by domain (`nota.js`, `data.js`, `distancia.js`)
- Services grouped by feature (`storage.js`, `authStorage.js`)

**No Barrel Files:**

- Direct imports used throughout
- No `index.js` exports
- Prevents circular dependency issues and makes tree-shaking easier (though not used here)

**Immutability Patterns:**

- Spread operator for objects: `{ ...bar, avaliacoes: [...(bar.avaliacoes || []), novaAvaliacao] }`
- Map/filter for arrays instead of mutation
- Example from state updates:
  ```javascript
  async function adicionarAvaliacao(barId, novaAvaliacao) {
    const novaLista = bares.map((bar) => {
      if (bar.id === barId) {
        return { ...bar, avaliacoes: [novaAvaliacao, ...bar.avaliacoes] };
      }
      return bar;
    });

    setBares(novaLista);
    await salvarBares(novaLista);
  }
  ```

## Language

**All code and comments in Portuguese (Brazilian):**

- Function names: `carregarBares`, `salvarBares`, `adicionarAvaliacao`
- Variable names: `usuarioLogado`, `mensagemBoasVindas`, `barSelecionado`
- Comments: Inline explanations in Portuguese
- This is intentional for an academic project in Brazil (Faculdade context)

---

*Convention analysis: 2026-09-25*
