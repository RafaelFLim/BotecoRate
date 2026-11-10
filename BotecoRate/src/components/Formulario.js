import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MensagemErro, { ERROR_COLOR } from './MensagemErro';
export { default as MensagemErro } from './MensagemErro';

export const FormScrollContext = createContext(null);
const FormFieldFocusContext = createContext(null);
const keyboardGap = 16;

export function useFormKeyboardScroll() {
  const scroll = useRef(null);
  const offset = useRef(0);
  const field = useRef(null);
  const frame = useRef(null);
  const keyboardTop = useRef(null);
  const mounted = useRef(true);
  const [keyboardPadding,setKeyboardPadding]=useState(0);

  function revealField() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = field.current;
      const viewport = scroll.current?.getNativeScrollRef();
      if (!viewport || !mounted.current) return;
      viewport.measureInWindow((_x, viewportY, _width, viewportHeight) => {
        if (!mounted.current) return;
        const viewportBottom=viewportY+viewportHeight;
        // Android pode sobrepor o teclado sem reduzir o tamanho medido da lista.
        const visibleBottom=Math.min(viewportBottom,keyboardTop.current??viewportBottom);
        setKeyboardPadding(Math.max(0,viewportBottom-visibleBottom));
        if (!input || input !== TextInput.State.currentlyFocusedInput()) return;
        input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
          if (!mounted.current || input !== field.current || input !== TextInput.State.currentlyFocusedInput() || !scroll.current) return;
          const bottom = visibleBottom - keyboardGap;
          const hidden = inputY + inputHeight - bottom;
          if (viewportHeight > keyboardGap && inputHeight > 0 && hidden > 0) {
            const nextOffset = offset.current + hidden;
            if (scroll.current.scrollToOffset) scroll.current.scrollToOffset({ offset: nextOffset, animated: true });
            else scroll.current.scrollTo({ y: nextOffset, animated: true });
          }
        });
      });
    });
  }

  useEffect(() => {
    mounted.current=true;
    function show(event) {
      const top=event.endCoordinates?.screenY;
      keyboardTop.current=Number.isFinite(top)?top-(Platform.OS==='android'?(StatusBar.currentHeight||0):0):null;
      revealField();
    }
    const shown = Keyboard.addListener('keyboardDidShow', show);
    const changed = Keyboard.addListener('keyboardDidChangeFrame', show);
    const hidden = Keyboard.addListener('keyboardDidHide', ()=>{
      keyboardTop.current=null;setKeyboardPadding(0);
    });
    const metrics=Keyboard.metrics?.();
    if(metrics) show({endCoordinates:metrics});
    return () => {
      mounted.current=false;
      shown.remove();changed.remove();hidden.remove();
      field.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return {
    keyboardSpace:{paddingBottom:keyboardPadding+20},
    scrollProps: {
      ref: scroll, onLayout: revealField, scrollEventThrottle: 16,
      onContentSizeChange:revealField,
      onScroll: event => { offset.current = event.nativeEvent.contentOffset.y; },
    },
    onFieldFocus: () => {
      field.current = TextInput.State.currentlyFocusedInput();
      revealField();
    },
  };
}

export function Formulario({ title, onVoltar, children, error }) {
  const { scrollProps, onFieldFocus, keyboardSpace } = useFormKeyboardScroll();
  return <SafeAreaView style={s.page} edges={['top', 'bottom']}>
    <View style={s.header}>{onVoltar && <TouchableOpacity onPress={onVoltar}><Text style={s.back}>← Voltar</Text></TouchableOpacity>}<Text style={s.title}>{title}</Text></View>
    {!!error && <View style={s.errorArea}><MensagemErro>{error}</MensagemErro></View>}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView {...scrollProps} contentContainerStyle={[s.content,keyboardSpace]} keyboardShouldPersistTaps="handled">
        <FormScrollContext.Provider value={() => scrollProps.ref.current?.scrollTo({ y: 0, animated: true })}>
          <FormFieldFocusContext.Provider value={onFieldFocus}>{children}</FormFieldFocusContext.Provider>
        </FormScrollContext.Provider>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Campo({ label, secureTextEntry, style, error, onFocus, ...props }) {
  const [visible, setVisible] = useState(false);
  const focusField = useContext(FormFieldFocusContext);
  function handleFocus(event) {
    focusField?.();
    onFocus?.(event);
  }
  useEffect(() => { if (!props.value) setVisible(false); }, [props.value]);
  return <><Text style={s.label}>{label}</Text>{secureTextEntry ?
    <View style={[s.passwordRow, error && s.invalid]}>
      <TextInput accessibilityLabel={label} placeholderTextColor="#777" autoCapitalize="none" autoCorrect={false} {...props}
        onFocus={handleFocus} secureTextEntry={!visible} accessibilityHint={error || props.accessibilityHint} style={[s.input, s.passwordInput, style]} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${visible ? 'Ocultar' : 'Mostrar'}: ${label}`}
        disabled={props.editable === false} onPress={() => setVisible(value => !value)} style={s.passwordToggle}>
        <Text style={s.passwordToggleText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
      </TouchableOpacity>
    </View> : <TextInput accessibilityLabel={label} style={[s.input, style, error && s.invalid]} placeholderTextColor="#777" autoCapitalize="none" {...props} onFocus={handleFocus} accessibilityHint={error || props.accessibilityHint} />}
    {!!error && <Text style={s.fieldError}>{error}</Text>}</>;
}
export function OpcaoConta({ title, description, onPress }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={s.option}>
    <View style={s.optionHeading}><Text style={s.optionTitle}>{title}</Text><Text style={s.optionArrow}>→</Text></View>
    <Text style={s.optionDescription}>{description}</Text>
  </TouchableOpacity>;
}
export function Botao({ children, onPress, disabled, secondary = false }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}><Text style={s.buttonText}>{children}</Text></TouchableOpacity>;
}
export function Aviso({ children }) { return <Text style={s.notice}>{children}</Text>; }
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f4f6' }, header: { backgroundColor: '#1a1a2e', padding: 18 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold' }, back: { color: 'white', marginBottom: 12 },
  content: { padding: 20, flexGrow: 1 }, label: { color: '#1a1a2e', fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 13, marginBottom: 18, color: '#111' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 18 },
  passwordInput: { flex: 1, minWidth: 0, borderWidth: 0, marginBottom: 0 },
  passwordToggle: { minHeight: 48, minWidth: 80, padding: 12, justifyContent: 'center', alignItems: 'center' },
  passwordToggleText: { color: '#5145cd', fontWeight: '600' },
  option: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 16, padding: 20, marginVertical: 8 },
  optionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  optionArrow: { color: '#6c63ff', fontSize: 24 },
  optionDescription: { color: '#4b5563', fontSize: 15, lineHeight: 22, marginTop: 8 },
  button: { backgroundColor: '#6c63ff', padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6 },
  secondary: { backgroundColor: '#374151' }, buttonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  notice: { color: '#374151', lineHeight: 21, marginVertical: 12 },
  errorArea: { paddingHorizontal: 20 },
  invalid: { borderColor: ERROR_COLOR, borderWidth: 2 },
  fieldError: { color: ERROR_COLOR, fontWeight: '600', lineHeight: 21, marginTop: -10, marginBottom: 16 },
});
