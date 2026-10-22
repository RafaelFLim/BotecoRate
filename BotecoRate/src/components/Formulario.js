import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Formulario({ title, onVoltar, children }) {
  return <SafeAreaView style={s.page} edges={['top', 'bottom']}>
    <View style={s.header}>{onVoltar && <TouchableOpacity onPress={onVoltar}><Text style={s.back}>← Voltar</Text></TouchableOpacity>}<Text style={s.title}>{title}</Text></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Campo({ label, ...props }) { return <><Text style={s.label}>{label}</Text><TextInput style={s.input} placeholderTextColor="#777" autoCapitalize="none" {...props} /></>; }
export function Botao({ children, onPress, disabled, secondary = false }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}><Text style={s.buttonText}>{children}</Text></TouchableOpacity>;
}
export function Aviso({ children }) { return <Text style={s.notice}>{children}</Text>; }
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f4f6' }, header: { backgroundColor: '#1a1a2e', padding: 18 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold' }, back: { color: 'white', marginBottom: 12 },
  content: { padding: 20, flexGrow: 1 }, label: { color: '#1a1a2e', fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 13, marginBottom: 18, color: '#111' },
  button: { backgroundColor: '#6c63ff', padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6 },
  secondary: { backgroundColor: '#374151' }, buttonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  notice: { color: '#374151', lineHeight: 21, marginVertical: 12 },
});
