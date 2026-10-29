import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as usernames from '../src/utils/username.js';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' };
function harness(filename, overrides = {}, moduleMocks = {}) {
  const slots = []; let cursor = 0;
  const effects = [], calls = [], announcements = [];
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
    useEffect(fn) { effects.push(fn); }, useCallback: fn => fn,
    createContext: () => ({ Provider: 'Provider' }),
  };
  const native = Object.fromEntries(['Text','View','TextInput','TouchableOpacity','ScrollView','KeyboardAvoidingView','ActivityIndicator','Image','Modal'].map(name => [name,name]));
  native.Alert = { alert: () => {} };
  native.StyleSheet = { create: value => value }; native.Platform = { OS: 'android' };
  native.AccessibilityInfo = { announceForAccessibility: value => announcements.push(value) };
  const form = Object.fromEntries(['Formulario','Campo','Botao','Aviso','OpcaoConta'].map(name => [name,name]));
  const mocks = {
    react, 'react/jsx-runtime': jsx, 'react-native': native,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './MensagemErro': { __esModule: true, default: 'MensagemErro', ERROR_COLOR: '#b91c1c' },
    '../components/MensagemErro': { __esModule: true, default: 'MensagemErro' },
    '../components/Formulario': form,
    '@react-navigation/native': { useNavigation: () => ({}), useFocusEffect: () => {} },
    '../navigation/useUnsavedChanges': { useUnsavedChanges: () => {} },
    '../utils/username': usernames,
    '../services/authService': { friendlyAuthError: e => e.message, biometricCandidate: async () => null,
      changeProfileName: async name => { calls.push(name); return { usuario: name }; },
      recoverPassword: async email => { calls.push(email); }, ...overrides },
    ...moduleMocks,
  };
  const { code } = transformSync(readFileSync(new URL(filename, import.meta.url), 'utf8'), {
    configFile: false, babelrc: false,
    plugins: [['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }], '@babel/plugin-transform-modules-commonjs'],
  });
  const context = { exports: {}, require: name => { if(name.endsWith('.png'))return name;if (!(name in mocks)) throw new Error(name); return mocks[name]; } };
  runInNewContext(code, context);
  return { exports: context.exports, render(fn, props) { cursor=0; return fn(props); }, calls, effects, native, announcements };
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}
const field = (tree, label) => nodes(tree).find(n => n.type === 'Campo' && n.props.label === label);
const button = (tree, label) => nodes(tree).find(n => n.type === 'Botao' && n.props.children === label);
const user = { id:'local:test', usuario:'Cliente', origem:'local' };

test('nome ponto: formulário real exibe erro fixo e no campo sem enviar alteração; correção limpa erro', async () => {
  const h=harness('../src/screens/TelaAjusteConta.js');
  const render=()=>h.render(h.exports.default,{usuarioLogado:user,secao:'nome'});
  field(render(),'Novo nome de usuário').props.onChangeText('.');
  button(render(),'Salvar nome').props.onPress();
  const invalid=render();
  assert.match(invalid.props.error,/3 letras/);
  assert.equal(field(invalid,'Novo nome de usuário').props.error,invalid.props.error);
  assert.equal(h.calls.length,0);
  field(invalid,'Novo nome de usuário').props.onChangeText('Nome Novo');
  assert.equal(render().props.error,'');
  await button(render(),'Salvar nome').props.onPress();
  assert.deepEqual(h.calls,['Nome Novo']);
  const saved=render();
  assert.equal(saved.props.error,'');
  assert.ok(nodes(saved).some(n=>n.type==='Aviso'&&n.props.children==='Nome atualizado.'));
});

test('duplicidade remota mostra erro de servidor no formulário e no campo, preservando rascunho',async()=>{
  const h=harness('../src/screens/TelaAjusteConta.js',{changeProfileName:async()=>{throw Object.assign(new Error('Nome já existe. Escolha outro.'),{code:'profile/name-in-use'});}});
  const render=()=>h.render(h.exports.default,{usuarioLogado:{...user,origem:'firebase',emailVerificado:true},secao:'nome'});
  field(render(),'Novo nome de usuário').props.onChangeText('Outro Nome');
  await button(render(),'Salvar nome').props.onPress();
  const result=render();
  assert.match(result.props.error,/já existe/);
  assert.equal(field(result,'Novo nome de usuário').props.value,'Outro Nome');
  assert.equal(field(result,'Novo nome de usuário').props.error,result.props.error);
});

test('confirmação de senha divergente aponta o campo e não envia gravação',()=>{
  const h=harness('../src/screens/TelaAjusteConta.js');
  const render=()=>h.render(h.exports.default,{usuarioLogado:user,secao:'senha'});
  field(render(),'Nova senha').props.onChangeText('Senha!123');
  field(render(),'Confirme a nova senha').props.onChangeText('Outra!123');
  button(render(),'Salvar senha').props.onPress();
  assert.match(render().props.error,/iguais/);
  assert.ok(field(render(),'Confirme a nova senha').props.error);
  assert.equal(h.calls.length,0);
});

test('erro do Formulario fica fora da área rolável e do deslocamento do teclado',()=>{
  const h=harness('../src/components/Formulario.js');
  const tree=h.render(h.exports.Formulario,{title:'Teste',error:'Falha explícita',children:'Formulário'});
  assert.equal(nodes(tree).filter(n=>n.type==='MensagemErro').length,1);
  const scroll=nodes(tree).find(n=>n.type==='ScrollView');
  const keyboard=nodes(tree).find(n=>n.type==='KeyboardAvoidingView');
  assert.equal(nodes(scroll).some(n=>n.type==='MensagemErro'),false);
  assert.equal(nodes(keyboard).some(n=>n.type==='MensagemErro'),false);
  const campo=h.render(h.exports.Campo,{label:'Nome',value:'.',error:'Corrija o nome'});
  const input=nodes(campo).find(n=>n.type==='TextInput');
  assert.equal(input.props.accessibilityHint,'Corrija o nome');
  assert.ok(input.props.style.some(style=>style?.borderColor==='#b91c1c'));
});

test('mensagem de erro é vermelha, textual e acessível; iOS recebe anúncio explícito',()=>{
  const h=harness('../src/components/MensagemErro.js');h.native.Platform.OS='ios';
  const tree=h.render(h.exports.default,{children:'Nome inválido'});
  const alert=nodes(tree).find(n=>n.props?.accessibilityRole==='alert');
  assert.equal(alert.props.style.color,'#b91c1c');
  assert.equal(alert.props.accessibilityLiveRegion,'assertive');
  assert.ok(nodes(alert).some(n=>n.type==='Text'&&n.props.children==='Erro: '));
  h.effects.forEach(effect=>effect());
  assert.deepEqual(h.announcements,['Erro: Nome inválido']);
});

test('recuperação de senha bem-sucedida é informação e não mensagem de erro',async()=>{
  const h=harness('../src/screens/TelaLogin.js');
  const render=()=>h.render(h.exports.default,{accountType:'email'});
  field(render(),'E-mail').props.onChangeText('teste@example.test');
  await button(render(),'Esqueci minha senha').props.onPress();
  const result=render();
  assert.equal(result.props.error,'');
  assert.ok(nodes(result).some(n=>n.type==='Aviso'&&String(n.props.children).includes('enviaremos as instruções')));
});

test('falha ao guardar foto no app é aguardada e visível na câmera, sem modal de sucesso sobre o erro',async()=>{
  const h=harness('../src/screens/TelaCamera.js',{}, {
    'expo-camera':{CameraView:'CameraView',useCameraPermissions:()=>[{granted:true},async()=>({granted:true})]},
    'expo-media-library/legacy':{usePermissions:()=>[{granted:true},async()=>({granted:true})],saveToLibraryAsync:async()=>{}},
  });
  const alerts=[];h.native.Alert.alert=(...args)=>alerts.push(args);
  let attempts=0;
  const props={onFotoCapturada:async()=>{attempts++;throw new Error('Não foi possível guardar a foto. Tente novamente.');}};
  const render=()=>h.render(h.exports.default,props);
  const tree=render();
  nodes(tree).find(n=>n.type==='CameraView').props.ref.current={takePictureAsync:async()=>({uri:'file:///camera.jpg',base64:'test'})};
  await nodes(tree).find(n=>n.props?.onPress?.name==='takePicture').props.onPress();
  const failed=render();
  assert.equal(attempts,1);
  assert.ok(nodes(failed).some(n=>n.type==='MensagemErro'&&String(n.props.children).includes('guardar a foto')));
  assert.equal(nodes(failed).find(n=>n.type==='Modal').props.visible,false);
  assert.equal(alerts.length,0);
  assert.equal(nodes(failed).find(n=>n.props?.onPress?.name==='takePicture').props.disabled,false);
});
