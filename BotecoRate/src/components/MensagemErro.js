import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const ERROR_COLOR = '#b91c1c';

export default function MensagemErro({ children, onDismiss }) {
  useEffect(() => {
    if (children && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(`Erro: ${children}`);
  }, [children]);
  if (!children) return null;
  return <View style={styles.box}>
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.message}>
      <Text style={styles.title}>Erro: </Text>{children}
    </Text>
    {onDismiss && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar mensagem de erro" onPress={onDismiss} style={styles.close}>
      <Text style={styles.closeText}>Fechar</Text>
    </TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
  box: { width: '100%', backgroundColor: '#fef2f2', borderColor: ERROR_COLOR, borderWidth: 1, borderLeftWidth: 4, borderRadius: 10, padding: 14, marginVertical: 10, flexShrink: 1 },
  message: { color: ERROR_COLOR, fontSize: 16, lineHeight: 23 },
  title: { color: ERROR_COLOR, fontWeight: '700' },
  close: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  closeText: { color: ERROR_COLOR, fontWeight: '700' },
});
