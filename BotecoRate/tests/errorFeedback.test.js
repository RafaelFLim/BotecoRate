import { test, expect } from "@jest/globals";
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as usernames from '../src/utils/username.js';
import * as address from '../src/utils/address.js';
import { consultarCep } from '../src/services/cepService.js';
const require = createRequire(import.meta.url);
const {
  transformSync
} = require('@babel/core');
const jsx = {
  jsx: (type, props) => ({
    type,
    props
  }),
  jsxs: (type, props) => ({
    type,
    props
  }),
  Fragment: 'Fragment'
};
function harness(filename, overrides = {}, moduleMocks = {}) {
  const slots = [];
  let cursor = 0;
  const effects = [],
    calls = [],
    announcements = [];
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        slots[i] = typeof value === 'function' ? value(slots[i]) : value;
      }];
    },
    useRef(value) {
      const i = cursor++;
      slots[i] ??= {
        current: value
      };
      return slots[i];
    },
    useEffect(fn) {
      effects.push(fn);
    },
    useCallback: fn => fn,
    useContext: () => null,
    createContext: () => ({
      Provider: 'Provider'
    })
  };
  const native = Object.fromEntries(['Text', 'View', 'TextInput', 'TouchableOpacity', 'ScrollView', 'KeyboardAvoidingView', 'ActivityIndicator', 'Image', 'Modal'].map(name => [name, name]));
  native.Alert = {
    alert: () => {}
  };
  native.StyleSheet = {
    create: value => value
  };
  native.Platform = {
    OS: 'android'
  };
  native.AccessibilityInfo = {
    announceForAccessibility: value => announcements.push(value)
  };
  const form = Object.fromEntries(['Formulario', 'Campo', 'Botao', 'Aviso', 'OpcaoConta'].map(name => [name, name]));
  const mocks = {
    react,
    'react/jsx-runtime': jsx,
    'react-native': native,
    'react-native-safe-area-context': {
      SafeAreaView: 'SafeAreaView'
    },
    './MensagemErro': {
      __esModule: true,
      default: 'MensagemErro',
      ERROR_COLOR: '#b91c1c'
    },
    '../components/MensagemErro': {
      __esModule: true,
      default: 'MensagemErro'
    },
    '../components/Formulario': form,
    '@react-navigation/native': {
      useNavigation: () => ({}),
      useFocusEffect: () => {}
    },
    '../navigation/useUnsavedChanges': {
      useUnsavedChanges: () => {}
    },
    '../utils/username': usernames,
    '../services/authService': {
      friendlyAuthError: e => e.message,
      biometricCandidate: async () => null,
      changeProfileName: async name => {
        calls.push(name);
        return {
          usuario: name
        };
      },
      recoverPassword: async email => {
        calls.push(email);
      },
      ...overrides
    },
    ...moduleMocks
  };
  const {
    code
  } = transformSync(readFileSync(new URL(filename, import.meta.url), 'utf8'), {
    configFile: false,
    babelrc: false,
    plugins: [['@babel/plugin-transform-react-jsx', {
      runtime: 'automatic'
    }], '@babel/plugin-transform-modules-commonjs']
  });
  const frames = new Map();
  let nextFrame = 0;
  const context = {
    exports: {},
    AbortController,
    require: name => {
      if (name.endsWith('.png')) return name;
      if (!(name in mocks)) throw new Error(name);
      return mocks[name];
    },
    requestAnimationFrame(fn) {
      frames.set(++nextFrame, fn);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    }
  };
  runInNewContext(code, context);
  return {
    exports: context.exports,
    render(fn, props) {
      cursor = 0;
      return fn(props);
    },
    calls,
    effects,
    native,
    announcements,
    flushFrame() {
      for (const [id, fn] of frames) {
        frames.delete(id);
        fn();
      }
    }
  };
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}
const field = (tree, label) => nodes(tree).find(n => n.type === 'Campo' && n.props.label === label);
const button = (tree, label) => nodes(tree).find(n => n.type === 'Botao' && n.props.children === label);
const user = {
  id: 'local:test',
  usuario: 'Cliente',
  origem: 'local'
};
test('nome ponto: formulário real exibe erro fixo e no campo sem enviar alteração; correção limpa erro', async () => {
  const h = harness('../src/screens/TelaAjusteConta.js');
  const render = () => h.render(h.exports.default, {
    usuarioLogado: user,
    secao: 'nome'
  });
  field(render(), 'Novo nome de usuário').props.onChangeText('.');
  button(render(), 'Salvar nome').props.onPress();
  const invalid = render();
  expect(invalid.props.error).toMatch(/3 letras/);
  expect(field(invalid, 'Novo nome de usuário').props.error).toBe(invalid.props.error);
  expect(h.calls.length).toBe(0);
  field(invalid, 'Novo nome de usuário').props.onChangeText('Nome Novo');
  expect(render().props.error).toBe('');
  await button(render(), 'Salvar nome').props.onPress();
  expect(h.calls).toEqual(['Nome Novo']);
  const saved = render();
  expect(saved.props.error).toBe('');
  expect(nodes(saved).some(n => n.type === 'Aviso' && n.props.children === 'Nome atualizado.')).toBeTruthy();
});
test('CEP de Vassouras aplica cidade e UF nos campos controlados e preserva número', async () => {
  const response = {
    cep: '27700-000',
    localidade: 'Vassouras',
    uf: 'RJ',
    logradouro: '',
    bairro: ''
  };
  const h = harness('../src/components/CampoEndereco.js', {}, {
    './Formulario': {
      Campo: 'Campo',
      Botao: 'Botao',
      Aviso: 'Aviso',
      MensagemErro: 'MensagemErro'
    },
    '../utils/address': address,
    '../services/cepService': {
      consultarCep: value => consultarCep(value, {
        fetchImpl: async () => ({
          ok: true,
          json: async () => response
        })
      })
    }
  });
  let props = {
    endereco: '',
    campos: {
      numero: '123'
    },
    cepSalvo: null,
    onChange: (endereco, campos) => {
      props = {
        ...props,
        endereco,
        campos
      };
    },
    onCepChange: cepSalvo => {
      props = {
        ...props,
        cepSalvo
      };
    }
  };
  const render = () => h.render(h.exports.default, props);
  field(render(), 'CEP (opcional)').props.onChangeText('27700000');
  await button(render(), 'Buscar endereço pelo CEP').props.onPress();
  button(render(), 'Usar este endereço').props.onPress();
  expect(field(render(), 'Cidade').props.value).toBe('Vassouras');
  expect(nodes(render()).some(node => node.type === 'Botao' && [].concat(node.props.children).join('') === 'UF · RJ ▾')).toBeTruthy();
  expect(field(render(), 'Número').props.value).toBe('123');
  field(render(), 'Complemento (opcional)').props.onChangeText('Loja 2');
  expect(field(render(), 'Cidade').props.value).toBe('Vassouras');
  expect(props.cepSalvo).toBe('27700000');
  props = {
    ...props,
    campos: {
      ...props.campos,
      cidade: 'Outra cidade'
    }
  };
  expect(field(render(), 'Cidade').props.value).toBe('Outra cidade');
});
test('duplicidade remota mostra erro de servidor no formulário e no campo, preservando rascunho', async () => {
  const h = harness('../src/screens/TelaAjusteConta.js', {
    changeProfileName: async () => {
      throw Object.assign(new Error('Nome já existe. Escolha outro.'), {
        code: 'profile/name-in-use'
      });
    }
  });
  const render = () => h.render(h.exports.default, {
    usuarioLogado: {
      ...user,
      origem: 'firebase',
      emailVerificado: true
    },
    secao: 'nome'
  });
  field(render(), 'Novo nome de usuário').props.onChangeText('Outro Nome');
  await button(render(), 'Salvar nome').props.onPress();
  const result = render();
  expect(result.props.error).toMatch(/já existe/);
  expect(field(result, 'Novo nome de usuário').props.value).toBe('Outro Nome');
  expect(field(result, 'Novo nome de usuário').props.error).toBe(result.props.error);
});
test('confirmação de senha divergente aponta o campo e não envia gravação', () => {
  const h = harness('../src/screens/TelaAjusteConta.js');
  const render = () => h.render(h.exports.default, {
    usuarioLogado: user,
    secao: 'senha'
  });
  field(render(), 'Nova senha').props.onChangeText('Senha!123');
  field(render(), 'Confirme a nova senha').props.onChangeText('Outra!123');
  button(render(), 'Salvar senha').props.onPress();
  expect(render().props.error).toMatch(/iguais/);
  expect(field(render(), 'Confirme a nova senha').props.error).toBeTruthy();
  expect(h.calls.length).toBe(0);
});
test('erro do Formulario fica fora da área rolável e do deslocamento do teclado', () => {
  const h = harness('../src/components/Formulario.js');
  const tree = h.render(h.exports.Formulario, {
    title: 'Teste',
    error: 'Falha explícita',
    children: 'Formulário'
  });
  expect(nodes(tree).filter(n => n.type === 'MensagemErro').length).toBe(1);
  const scroll = nodes(tree).find(n => n.type === 'ScrollView');
  const keyboard = nodes(tree).find(n => n.type === 'KeyboardAvoidingView');
  expect(nodes(scroll).some(n => n.type === 'MensagemErro')).toBe(false);
  expect(nodes(keyboard).some(n => n.type === 'MensagemErro')).toBe(false);
  const campo = h.render(h.exports.Campo, {
    label: 'Nome',
    value: '.',
    error: 'Corrija o nome'
  });
  const input = nodes(campo).find(n => n.type === 'TextInput');
  expect(input.props.accessibilityHint).toBe('Corrija o nome');
  expect(input.props.style.some(style => style?.borderColor === '#b91c1c')).toBeTruthy();
});
test('mensagem de erro é vermelha, textual e acessível; iOS recebe anúncio explícito', () => {
  const h = harness('../src/components/MensagemErro.js');
  h.native.Platform.OS = 'ios';
  const tree = h.render(h.exports.default, {
    children: 'Nome inválido'
  });
  const alert = nodes(tree).find(n => n.props?.accessibilityRole === 'alert');
  expect(alert.props.style.color).toBe('#b91c1c');
  expect(alert.props.accessibilityLiveRegion).toBe('assertive');
  expect(nodes(alert).some(n => n.type === 'Text' && n.props.children === 'Erro: ')).toBeTruthy();
  h.effects.forEach(effect => effect());
  expect(h.announcements).toEqual(['Erro: Nome inválido']);
});
test('formulário revela o campo focado quando o teclado reduz a área visível', () => {
  const h = harness('../src/components/Formulario.js');
  const tree = h.render(h.exports.Formulario, {
    title: 'Criar conta',
    children: 'Formulário'
  });
  const scroll = nodes(tree).find(n => n.type === 'ScrollView');
  const focus = nodes(tree).filter(n => n.type === 'Provider').at(-1).props.value;
  const offsets = [];
  let height = 600;
  let inputY = 460;
  const input = {
    measureInWindow: fn => fn(0, inputY, 300, 50)
  };
  let current = input;
  h.native.TextInput = {
    State: {
      currentlyFocusedInput: () => current
    }
  };
  scroll.props.ref.current = {
    getNativeScrollRef: () => ({
      measureInWindow: fn => fn(0, 100, 320, height)
    }),
    scrollTo: ({
      y
    }) => offsets.push(y)
  };
  scroll.props.onScroll({
    nativeEvent: {
      contentOffset: {
        y: 40
      }
    }
  });
  focus();
  h.flushFrame();
  expect(offsets).toEqual([]);
  height = 350;
  scroll.props.onLayout();
  h.flushFrame();
  expect(offsets).toEqual([116]);
  inputY = 560;
  scroll.props.onLayout();
  current = null;
  h.flushFrame();
  expect(offsets).toEqual([116]);
});
test('recuperação de senha bem-sucedida é informação e não mensagem de erro', async () => {
  const h = harness('../src/screens/TelaLogin.js');
  const render = () => h.render(h.exports.default, {
    accountType: 'email'
  });
  field(render(), 'E-mail').props.onChangeText('teste@example.test');
  await button(render(), 'Esqueci minha senha').props.onPress();
  const result = render();
  expect(result.props.error).toBe('');
  expect(nodes(result).some(n => n.type === 'Aviso' && String(n.props.children).includes('enviaremos as instruções'))).toBeTruthy();
});
test('Android com teclado sobreposto revela o nome do bar sem depender do redimensionamento da tela', () => {
  const h = harness('../src/components/Formulario.js');
  const events = {};
  h.native.Keyboard = {
    addListener: (name, callback) => {
      events[name] = callback;
      return {
        remove: () => delete events[name]
      };
    }
  };
  h.native.StatusBar = {
    currentHeight: 24
  };
  const offsets = [];
  const input = {
    measureInWindow: callback => callback(20, 460, 300, 50)
  };
  h.native.TextInput = {
    State: {
      currentlyFocusedInput: () => input
    }
  };
  const props = {
    title: 'Gerenciar bar',
    children: 'Formulário'
  };
  const render = () => h.render(h.exports.Formulario, props);
  const tree = render();
  const scroll = nodes(tree).find(node => node.type === 'ScrollView');
  scroll.props.ref.current = {
    getNativeScrollRef: () => ({
      measureInWindow: callback => callback(0, 100, 360, 700)
    }),
    scrollTo: ({
      y
    }) => offsets.push(y)
  };
  nodes(tree).filter(node => node.type === 'Provider').at(-1).props.value();
  h.flushFrame();
  expect(offsets).toEqual([]);
  const cleanups = h.effects.map(effect => effect());
  events.keyboardDidShow({
    endCoordinates: {
      screenY: 400
    }
  });
  h.flushFrame();
  expect(offsets).toEqual([150]);
  expect(nodes(render()).find(node => node.type === 'ScrollView').props.contentContainerStyle[1].paddingBottom).toBe(444);
  events.keyboardDidHide();
  expect(nodes(render()).find(node => node.type === 'ScrollView').props.contentContainerStyle[1].paddingBottom).toBe(20);
  cleanups.forEach(cleanup => cleanup?.());
});
test('falha ao guardar foto no app é aguardada e visível na câmera, sem modal de sucesso sobre o erro', async () => {
  const h = harness('../src/screens/TelaCamera.js', {}, {
    'expo-camera': {
      CameraView: 'CameraView',
      useCameraPermissions: () => [{
        granted: true
      }, async () => ({
        granted: true
      })]
    },
    'expo-media-library/legacy': {
      usePermissions: () => [{
        granted: true
      }, async () => ({
        granted: true
      })],
      saveToLibraryAsync: async () => {}
    }
  });
  const alerts = [];
  h.native.Alert.alert = (...args) => alerts.push(args);
  let attempts = 0;
  const props = {
    onFotoCapturada: async () => {
      attempts++;
      throw new Error('Não foi possível guardar a foto. Tente novamente.');
    }
  };
  const render = () => h.render(h.exports.default, props);
  const tree = render();
  nodes(tree).find(n => n.type === 'CameraView').props.ref.current = {
    takePictureAsync: async () => ({
      uri: 'file:///camera.jpg',
      base64: 'test'
    })
  };
  await nodes(tree).find(n => n.props?.onPress?.name === 'takePicture').props.onPress();
  const failed = render();
  expect(attempts).toBe(1);
  expect(nodes(failed).some(n => n.type === 'MensagemErro' && String(n.props.children).includes('guardar a foto'))).toBeTruthy();
  expect(nodes(failed).find(n => n.type === 'Modal').props.visible).toBe(false);
  expect(alerts.length).toBe(0);
  expect(nodes(failed).find(n => n.props?.onPress?.name === 'takePicture').props.disabled).toBe(false);
});
