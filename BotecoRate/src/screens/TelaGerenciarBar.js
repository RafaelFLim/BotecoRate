import { useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Formulario, Campo, Botao, Aviso } from '../components/Formulario';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';
import { podeGerenciarBar } from '../utils/permissoes';
import { BAR_EDIT_FIELDS, validateBarData } from '../utils/barManagement';
import CampoEndereco from '../components/CampoEndereco';

export default function TelaGerenciarBar({ bar, usuarioLogado, onVoltar, onConcluir, onSalvar, onExcluir, onAbrirCamera }) {
  const navigation = useNavigation();
  // O rascunho não é substituído por atualizações recebidas durante a edição.
  const [baseline] = useState(bar);
  const [draft, setDraft] = useState(() => Object.fromEntries(BAR_EDIT_FIELDS.map(field => [field, bar?.[field] ?? null])));
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [message, setMessage] = useState('');
  const performing = useRef(false);
  const canManage = Boolean(bar && podeGerenciarBar(usuarioLogado, bar));
  const dirty = !outcome && BAR_EDIT_FIELDS.some(field => draft[field] !== (baseline?.[field] ?? null));
  useUnsavedChanges(dirty, navigation, { saving: busy });
  useEffect(() => { if (outcome) onConcluir(outcome === 'deleted'); }, [outcome]);

  function setField(field, value) {
    setDraft(previous => ({ ...previous, [field]: value, ...(field === 'endereco' && value !== previous.endereco ? { latitude: null, longitude: null } : {}) }));
  }

  async function perform(action, result) {
    if (performing.current) return;
    performing.current = true; setBusy(true); setMessage('');
    try { await action(); setOutcome(result); }
    catch (error) { setMessage(error.message || 'Não foi possível salvar. Tente novamente.'); }
    finally { performing.current = false; setBusy(false); }
  }

  function save() {
    try { validateBarData(draft); }
    catch (error) { setMessage(error.message); return; }
    perform(() => onSalvar(draft, baseline), 'saved');
  }

  function confirmDeletion() {
    Alert.alert('Excluir bar?', `“${baseline.nome}” deixará de aparecer na lista, no mapa e no ranking. O cardápio e as avaliações também serão retirados de exibição. O histórico será preservado. A exclusão será enviada quando houver conexão.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir bar', style: 'destructive', onPress: () => perform(() => onExcluir(baseline), 'deleted') },
    ]);
  }

  async function useCurrentLocation() {
    if (locating || busy) return;
    setLocating(true); setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Permita o acesso à localização ou mantenha o bar sem posição no mapa.');
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Ligue a localização do aparelho para usar esta opção.');
      const position = await Location.getCurrentPositionAsync({});
      setDraft(previous => ({ ...previous, latitude: position.coords.latitude, longitude: position.coords.longitude }));
    } catch (error) { setMessage(error.message || 'Não foi possível obter sua localização.'); }
    finally { setLocating(false); }
  }

  if (!baseline) return <Formulario title="Gerenciar bar" onVoltar={onVoltar}><Aviso>Este bar não está mais disponível.</Aviso></Formulario>;
  const disabled = busy || locating || !canManage;
  return <Formulario title="Gerenciar bar" onVoltar={onVoltar}>
    <Aviso>Altere os dados do estabelecimento. O cardápio continua sendo gerenciado na página do bar.</Aviso>
    {!canManage && !outcome && <Aviso>O bar não está disponível ou sua permissão mudou. Volte à lista e atualize o catálogo.</Aviso>}
    {!!message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
    <Image source={{ uri: draft.foto }} style={styles.photo} accessibilityLabel="Foto do bar"/>
    <Botao secondary disabled={disabled} onPress={() => onAbrirCamera(uri => setField('foto', uri))}>Trocar foto</Botao>
    <Campo label="Nome do bar" value={draft.nome || ''} onChangeText={value => setField('nome', value)} maxLength={150} editable={!disabled} autoCapitalize="words"/>
    <CampoEndereco key={usuarioLogado?.id} endereco={draft.endereco} onChange={value => setField('endereco', value)} disabled={disabled}/>
    <Aviso>Ao alterar o endereço, a posição anterior é removida do mapa. Se estiver no bar, você pode definir a nova posição abaixo.</Aviso>
    <Campo label="Detalhes do bar" value={draft.detalhes || ''} onChangeText={value => setField('detalhes', value)} maxLength={5000} editable={!disabled} multiline style={styles.details} autoCapitalize="sentences"/>
    <View style={styles.location}>
      <Text style={styles.heading}>Posição no mapa</Text>
      <Aviso>{draft.latitude == null ? 'Sem posição definida. O bar continua disponível na lista.' : 'Este bar tem uma posição definida no mapa.'}</Aviso>
      <Botao secondary disabled={disabled} onPress={useCurrentLocation}>{locating ? 'Obtendo localização…' : 'Estou no bar: usar minha localização'}</Botao>
      {draft.latitude != null && <Botao secondary disabled={disabled} onPress={() => setDraft(previous => ({ ...previous, latitude: null, longitude: null }))}>Remover posição do mapa</Botao>}
    </View>
    <Aviso>As alterações são guardadas neste aparelho e aguardam confirmação online. A permissão é conferida novamente ao enviar.</Aviso>
    <Botao disabled={disabled || !dirty} onPress={save}>{busy ? 'Salvando…' : 'Salvar alterações'}</Botao>
    <View style={styles.deletion}>
      <Text style={styles.heading}>Excluir estabelecimento</Text>
      <Aviso>Retira este bar, seu cardápio e suas avaliações de exibição. Esta tela não oferece restauração.</Aviso>
      <Botao secondary disabled={disabled} onPress={confirmDeletion}>Excluir bar</Botao>
    </View>
  </Formulario>;
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  details: { minHeight: 110, textAlignVertical: 'top' },
  location: { marginVertical: 12 },
  heading: { color: '#1a1a2e', fontSize: 18, fontWeight: '700' },
  deletion: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#d1d5db' },
  error: { color: '#b91c1c', lineHeight: 22, marginBottom: 14 },
});
