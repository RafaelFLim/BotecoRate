import MensagemErro from '../components/MensagemErro';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';


import { useNavigation } from '@react-navigation/native';
import { useUnsavedChanges } from '../navigation/useUnsavedChanges';

import CampoEndereco from '../components/CampoEndereco';

export default function TelaCadastroBar({ usuarioLogado, onVoltar, onCadastrar, onAbrirCamera }) {
  const [localizacao, setLocalizacao] = useState(null);
  const [cepSalvo, setCepSalvo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(false);
  const locationRequest = useRef(null);
  useEffect(() => () => { locationRequest.current = null; }, []);

  // null | 'bar' | 'item' — pra quem a próxima foto tirada na câmera é destinada,
  // já que a mesma TelaCamera é reaproveitada tanto pro bar quanto pro item.
  const navigation = useNavigation();
  const [saved, setSaved] = useState(false);
  function setCapturandoFotoPara(target) { onAbrirCamera(uri => target === 'bar' ? setFoto(uri) : setItemFoto(uri)); }
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [foto, setFoto] = useState(null);
  const [detalhes, setDetalhes] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Formulário do item que está sendo montado antes de entrar na lista do cardápio.
  const [itemTipo, setItemTipo] = useState('comida');
  const [itemNome, setItemNome] = useState('');
  const [itemDescricao, setItemDescricao] = useState('');
  const [itemValor, setItemValor] = useState('');
  const [itemFoto, setItemFoto] = useState(null);
  const [itensCardapio, setItensCardapio] = useState([]);
  useUnsavedChanges(!saved && Boolean(nome || endereco || cepSalvo || localizacao || detalhes || foto || itensCardapio.length || itemNome || itemDescricao || itemValor || itemFoto), navigation);

  useEffect(() => { if (saved) onVoltar(); }, [saved]);

  function alterarEndereco(value) {
    locationRequest.current = null;
    setCarregandoLocalizacao(false);
    setEndereco(value);
    if (value !== endereco) { setLocalizacao(null); setCepSalvo(null); }
  }

  async function obterLocalizacao() {
    if (carregandoLocalizacao || salvando) return;
    const request = {};
    locationRequest.current = request;
    setErrorMsg(null); setCarregandoLocalizacao(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Permita a localização para posicionar o bar no mapa, ou continue sem ela.');
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Ligue a localização do aparelho ou continue sem ela.');
      const position = await Location.getCurrentPositionAsync({});
      if (locationRequest.current === request) setLocalizacao(position.coords);
    } catch (error) {
      if (locationRequest.current === request) setErrorMsg(error.message || 'Não foi possível obter sua localização.');
    } finally {
      if (locationRequest.current === request) { locationRequest.current = null; setCarregandoLocalizacao(false); }
    }
  }

  function adicionarItemAoCardapio() {
    setErrorMsg('');
    if (!itemNome.trim()) {
      setErrorMsg('Digite o nome do item.');
      return;
    }

    const valorNumerico = Number(itemValor.replace(',', '.'));

    if (!itemValor.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      setErrorMsg('Digite um valor válido pro item.');
      return;
    }

    if (!itemDescricao.trim()) {
      setErrorMsg('Digite os detalhes do item (ingredientes, tamanho...).');
      return;
    }

    setItensCardapio([
      ...itensCardapio,
      {
        id: Date.now().toString(),
        tipo: itemTipo,
        nome: itemNome.trim(),
        descricao: itemDescricao.trim(),
        valor: valorNumerico,
        foto: itemFoto,
        criadoEm: new Date().toISOString(),
        editadoEm: null,
        historico: [],
        avaliacoes: [],
      },
    ]);

    setItemTipo('comida');
    setItemNome('');
    setItemDescricao('');
    setItemValor('');
    setItemFoto(null);
  }

  function removerItemDoCardapio(itemId) {
    setItensCardapio(itensCardapio.filter((item) => item.id !== itemId));
  }

  async function salvarNovoBar() {
    if (salvando || saved || carregandoLocalizacao) return;
    setErrorMsg('');
    if (!nome.trim() || !endereco.trim()) {
      setErrorMsg('Preencha o nome e o endereço do bar.');
      return;
    }

    if (!foto) {
      setErrorMsg('Tire uma foto do bar antes de salvar.');
      return;
    }

    if (!detalhes.trim()) {
      setErrorMsg('Escreva os detalhes do bar (ambiente, especialidades...).');
      return;
    }

    if (itensCardapio.length < 3) {
      setErrorMsg('Adicione pelo menos 3 itens ao cardápio (comidas e/ou bebidas) antes de salvar.');
      return;
    }

    setSalvando(true);

    const novoBar = {
      id: Date.now().toString(),
      nome: nome.trim(),
      endereco: endereco.trim(),
      cep: cepSalvo,
      foto,
      criadoPor: usuarioLogado ? usuarioLogado.usuario : 'anônimo',
      detalhes: detalhes.trim(),
      // Sem GPS o bar é salvo sem coordenada: ele existe na lista, mas não no mapa.
      latitude: localizacao !== null ? localizacao.latitude : null,
      longitude: localizacao !== null ? localizacao.longitude : null,
      avaliacoes: [],
      cardapio: itensCardapio,
    };

    try {
      await onCadastrar(novoBar);
      setSaved(true);
    } catch (error) { setErrorMsg(error.message); }
    finally { setSalvando(false); }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVoltar}>
          <Text style={styles.btnVoltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Novo bar</Text>
      </View>

      {!!errorMsg && <MensagemErro>{errorMsg}</MensagemErro>}
      <KeyboardAvoidingView
        style={styles.conteudo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formulario}
          keyboardShouldPersistTaps="handled"
        >
          {localizacao === null && (
            <View style={styles.avisoSemLocalizacao}>
              <Text style={styles.avisoSemLocalizacaoTexto}>
                Sem posição no mapa. Você pode consultar o CEP ou digitar o endereço abaixo.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.areaFoto} onPress={() => setCapturandoFotoPara('bar')}>
            {foto ? (
              <Image source={{ uri: foto }} style={styles.fotoPreview} />
            ) : (
              <Text style={styles.areaFotoTexto}>📷 Tirar foto do bar</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Boteco do Zé"
            placeholderTextColor="#9ca3af"
            value={nome}
            onChangeText={setNome}
          />

          <CampoEndereco key={usuarioLogado?.id} endereco={endereco} onChange={alterarEndereco} cepSalvo={cepSalvo} onCepChange={setCepSalvo} disabled={salvando}/>
          <Text style={styles.ajudaEndereco}>
            O CEP preenche o endereço, mas não define a posição no mapa. Se estiver no bar, use sua localização abaixo. Ao alterar o endereço, defina a posição novamente.
          </Text>
          <TouchableOpacity style={styles.btnTentarNovamente} disabled={salvando || carregandoLocalizacao} onPress={obterLocalizacao}>
            <Text style={styles.btnVoltarErroTexto}>{carregandoLocalizacao ? 'Obtendo localização…' : 'Estou no bar: usar minha localização'}</Text>
          </TouchableOpacity>
          {carregandoLocalizacao && <TouchableOpacity style={styles.btnSemLocalizacao} onPress={() => {
            locationRequest.current = null; setCarregandoLocalizacao(false);
          }}>
            <Text style={styles.btnVoltarErroTexto}>Continuar sem aguardar a localização</Text>
          </TouchableOpacity>}
          {localizacao !== null && <TouchableOpacity style={styles.btnSemLocalizacao} disabled={salvando} onPress={() => setLocalizacao(null)}>
            <Text style={styles.btnVoltarErroTexto}>Remover posição do mapa</Text>
          </TouchableOpacity>}

          <Text style={styles.label}>Detalhes do bar</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Conte como é o bar: ambiente, especialidades, diferenciais..."
            placeholderTextColor="#9ca3af"
            value={detalhes}
            onChangeText={setDetalhes}
            multiline
          />

          <Text style={styles.subtitulo}>Cardápio</Text>
          <Text style={styles.ajudaCardapio}>
            Adicione pelo menos 3 itens (comidas e/ou bebidas). {itensCardapio.length}/3
            {itensCardapio.length >= 3 ? ' ✓' : ''}
          </Text>

          {itensCardapio.map((item) => (
            <View key={item.id} style={styles.itemAdicionado}>
              <Text style={styles.itemAdicionadoTexto}>
                {item.tipo === 'bebida' ? '🍺' : '🍢'} {item.nome} — R${' '}
                {item.valor.toFixed(2).replace('.', ',')}
              </Text>
              <TouchableOpacity onPress={() => removerItemDoCardapio(item.id)}>
                <Text style={styles.itemAdicionadoRemover}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.novoItemCard}>
            <View style={styles.seletorTipo}>
              <TouchableOpacity
                style={[styles.btnTipo, itemTipo === 'comida' && styles.btnTipoSelecionado]}
                onPress={() => setItemTipo('comida')}
              >
                <Text
                  style={[
                    styles.btnTipoTexto,
                    itemTipo === 'comida' && styles.btnTipoTextoSelecionado,
                  ]}
                >
                  🍢 Comida
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnTipo, itemTipo === 'bebida' && styles.btnTipoSelecionado]}
                onPress={() => setItemTipo('bebida')}
              >
                <Text
                  style={[
                    styles.btnTipoTexto,
                    itemTipo === 'bebida' && styles.btnTipoTextoSelecionado,
                  ]}
                >
                  🍺 Bebida
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.areaFotoItem}
              onPress={() => setCapturandoFotoPara('item')}
            >
              {itemFoto ? (
                <Image source={{ uri: itemFoto }} style={styles.fotoPreview} />
              ) : (
                <Text style={styles.areaFotoItemTexto}>📷 Foto do item (opcional)</Text>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Nome do item"
              placeholderTextColor="#9ca3af"
              value={itemNome}
              onChangeText={setItemNome}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Detalhes (ingredientes, tamanho...)"
              placeholderTextColor="#9ca3af"
              value={itemDescricao}
              onChangeText={setItemDescricao}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder="Valor (R$)"
              placeholderTextColor="#9ca3af"
              value={itemValor}
              onChangeText={setItemValor}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.btnAdicionarItem} onPress={adicionarItemAoCardapio}>
              <Text style={styles.btnAdicionarItemTexto}>+ Adicionar ao cardápio</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnSalvar, (salvando || carregandoLocalizacao) && styles.btnSalvarDesabilitado]}
            onPress={salvarNovoBar}
            disabled={salvando || carregandoLocalizacao}
          >
            <Text style={styles.btnSalvarTexto}>
              {salvando ? 'Salvando...' : 'Salvar bar'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 8,
  },
  avisoSemLocalizacao: {
    backgroundColor: '#fff4d6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0c674',
    padding: 12,
    marginBottom: 16,
  },
  avisoSemLocalizacaoTexto: {
    fontSize: 13,
    color: '#7a5d00',
  },
  btnSemLocalizacao: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnTentarNovamente: {
    backgroundColor: '#6c63ff',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnVoltarErroTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1a1a2e',
  },
  btnVoltarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 16,
  },
  titulo: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conteudo: {
    flex: 1,
  },
  formulario: {
    padding: 16,
  },
  areaFoto: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  areaFotoTexto: {
    fontSize: 15,
    color: '#6c63ff',
    fontWeight: '600',
  },
  fotoPreview: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  ajudaEndereco: {
    fontSize: 12,
    color: '#666',
    marginTop: -8,
    marginBottom: 16,
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  subtitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginTop: 8,
    marginBottom: 4,
  },
  ajudaCardapio: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  itemAdicionado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  itemAdicionadoTexto: {
    fontSize: 14,
    color: '#1a1a2e',
    flex: 1,
    marginRight: 8,
  },
  itemAdicionadoRemover: {
    fontSize: 15,
  },
  novoItemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  seletorTipo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  btnTipo: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6c63ff',
    alignItems: 'center',
    marginRight: 8,
  },
  btnTipoSelecionado: {
    backgroundColor: '#6c63ff',
  },
  btnTipoTexto: {
    color: '#1a1a2e',
    fontWeight: '600',
    fontSize: 13,
  },
  btnTipoTextoSelecionado: {
    color: '#fff',
  },
  areaFotoItem: {
    height: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  areaFotoItemTexto: {
    fontSize: 13,
    color: '#6c63ff',
    fontWeight: '600',
  },
  btnAdicionarItem: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnAdicionarItemTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnSalvar: {
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  btnSalvarDesabilitado: {
    opacity: 0.6,
  },
  btnSalvarTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
