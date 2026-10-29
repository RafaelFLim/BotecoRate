import { useContext, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Aviso, Botao, FormScrollContext } from './Formulario';
import { paginate } from '../utils/pagination';

// Filtrar/ordenar antes de entregar os itens. Nunca acumular páginas na tela.
export default function ListaPaginada({ items = [], renderItem, resetKey = '', label = 'registros', empty = 'Nenhum registro encontrado.' }) {
  const [position, setPosition] = useState({ key: resetKey, page: 1 });
  const scrollTop = useContext(FormScrollContext);
  const result = paginate(items, position.key === resetKey ? position.page : 1);
  useEffect(() => {
    setPosition(previous => ({ key: resetKey, page: previous.key === resetKey ? Math.min(previous.page, result.pages) : 1 }));
  }, [resetKey, result.pages]);
  function change(page) { setPosition({ key: resetKey, page }); scrollTop?.(); }
  const controls = suffix => <View key={suffix} accessibilityLabel={`Paginação de ${label}`}>
    <Text accessibilityLiveRegion="polite">{result.first}–{result.last} de {result.total} {label} · Página {result.page} de {result.pages}</Text>
    {result.pages > 1 && <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}><Botao secondary disabled={result.page === 1} onPress={() => change(result.page - 1)}>Anterior</Botao></View>
      <View style={{ flex: 1 }}><Botao secondary disabled={result.page === result.pages} onPress={() => change(result.page + 1)}>Próxima</Botao></View>
    </View>}
  </View>;
  return <>
    {controls('top')}
    {!result.total && <Aviso>{empty}</Aviso>}
    {result.items.map(renderItem)}
    {result.pages > 1 && controls('bottom')}
  </>;
}
