import { createContext, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MensagemErro, { ERROR_COLOR } from './MensagemErro';
export { default as MensagemErro } from './MensagemErro';

export const FormScrollContext = createContext(null);

export function Formulario({ title, onVoltar, children, error }) {
  const scroll = useRef(null);
  return <SafeAreaView style={s.page} edges={['top', 'bottom']}>
    <View style={s.header}>{onVoltar && <TouchableOpacity onPress={onVoltar}><Text style={s.back}>← Voltar</Text></TouchableOpacity>}<Text style={s.title}>{title}</Text></View>
    {!!error && <View style={s.errorArea}><MensagemErro>{error}</MensagemErro></View>}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><FormScrollContext.Provider value={() => scroll.current?.scrollTo({ y: 0, animated: true })}>{children}</FormScrollContext.Provider></ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Campo({ label, secureTextEntry, style, error, ...props }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (!props.value) setVisible(false); }, [props.value]);
  return <><Text style={s.label}>{label}</Text>{secureTextEntry ?
    <View style={[s.passwordRow, error && s.invalid]}>
      <TextInput accessibilityLabel={label} placeholderTextColor="#777" autoCapitalize="none" autoCorrect={false} {...props}
        secureTextEntry={!visible} accessibilityHint={error || props.accessibilityHint} style={[s.input, s.passwordInput, style]} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${visible ? 'Ocultar' : 'Mostrar'}: ${label}`}
        disabled={props.editable === false} onPress={() => setVisible(value => !value)} style={s.passwordToggle}>
        <Text style={s.passwordToggleText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
      </TouchableOpacity>
    </View> : <TextInput style={[s.input, style, error && s.invalid]} placeholderTextColor="#777" autoCapitalize="none" {...props} accessibilityHint={error || props.accessibilityHint} />}
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
