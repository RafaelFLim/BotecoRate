# Atualização de dependências — 22/10/2026

Escopo autorizado: atualizar bibliotecas existentes antes das alterações funcionais e aguardar testes do usuário. Mantido Expo SDK 57, compatível com a referência principal do professor. Nenhum código de tela/serviço foi modificado; SQLite, Firebase e NetInfo ainda não foram instalados.

## Versões

| Pacote | Instalado antes | Instalado depois | Faixa anterior no package.json |
| --- | --- | --- | --- |
| `expo` | 57.0.24 | 57.0.31 | ~57.0.25 |
| `expo-camera` | 57.0.5 | 57.0.6 | ~57.0.5 |
| `expo-location` | 57.0.19 | 57.0.22 | ~57.0.20 |
| `expo-splash-screen` | 57.0.9 | 57.0.10 | ~57.0.9 |

`package.json` e `package-lock.json` foram atualizados. Executado também `npm update` dentro das faixas declaradas para atualizar dependências transitivas. React, React Native, mapas, safe-area, AsyncStorage e demais módulos mantêm versões diretas compatíveis recomendadas pelo Expo.

Existem versões principais mais novas: Expo 58, React Native 0.88 e AsyncStorage 3, além de outras bibliotecas. Não foram aplicadas por exigirem migração e nova análise de compatibilidade; “latest” no npm não significa compatível com o SDK 57. Sem overrides ou `npm audit fix --force`.

## Verificações

- `expo install --check`: dependências atualizadas e compatíveis.
- `expo-doctor`: 21/21 verificações aprovadas.
- `npm ls --depth=0`: versões diretas resolvidas sem erro.
- Exportação de bundles Android/iOS: concluída com sucesso (671 módulos Android, 673 iOS). Artefatos em pasta temporária fora do repositório; não são APK/IPA.
- `npm audit`: após atualizações restam 18 alertas (16 altos e 2 moderados), nenhum crítico. Contagem agrega dependências afetadas e não equivale a 18 falhas independentes exploráveis no app.

As sugestões automáticas remanescentes incluem downgrades incompatíveis de Expo/React Native; `@expo/ngrok` também possui alerta transitivo sem correção automática indicada. Pendência registrada para revisão específica; não declarar a árvore livre de vulnerabilidades. A atualização removeu o alerta crítico observado durante a instalação inicial.

## Testes manuais antes de continuar

1. Reiniciar o servidor Expo com cache limpo (`npx expo start --clear`) na pasta BotecoRate e abrir o aplicativo atual em Android e iOS.
2. Cadastro/login, entrada biométrica, perfil e troca de senha.
3. Foto de bar/item, permissão de câmera e salvamento na galeria.
4. Localização, mapa, distância e recuperação de permissão negada/GPS desligado.
5. Cadastro de bar/cardápio, avaliações/edições/históricos e persistência após fechar e reabrir.
6. Splash screen e retorno entre telas.

Exportação JavaScript não é build nativa nem valida sensores/permissões em dispositivo. Se houver binário de desenvolvimento com módulos nativos incorporados, ele pode precisar ser reconstruído para as novas versões; não foram gerados APK/IPA nesta etapa. Aguardar retorno dos testes antes de implementar novas funcionalidades.

Referência: [atualização do Expo](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
