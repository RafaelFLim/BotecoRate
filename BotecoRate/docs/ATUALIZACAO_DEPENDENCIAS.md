# Atualização de dependências — Expo SDK 58 (26/10/2026)

Usuário solicitou migração de SDK 57 para 58 após atualizar o Expo Go. Atualizados Expo e os módulos indicados por `expo install --fix`, com package-lock reproduzível. A implementação local do ViaCEP e o trabalho remoto de administração/copropriedade foram preservados.

## Versões instaladas nesta migração

| Pacote | Antes (lock versionado) | Depois |
| --- | --- | --- |
| `expo` | 57.0.31 | 58.0.19 |
| `expo-camera` | 57.0.6 | 58.0.12 |
| `expo-crypto` | 57.0.4 | 58.0.7 |
| `expo-file-system` | 57.0.7 | 58.0.11 |
| `expo-local-authentication` | 57.0.3 | 58.0.2 |
| `expo-location` | 57.0.22 | 58.0.19 |
| `expo-media-library` | 57.0.5 | 58.0.12 |
| `expo-splash-screen` | 57.0.10 | 58.0.11 |
| `expo-sqlite` | 57.0.4 | 58.0.14 |
| `expo-status-bar` | 57.0.1 | 58.0.4 |
| `react` | 19.2.3 | 19.3.0 |
| `react-native` | 0.86.3 | 0.88.0 |
| `react-native-maps` | 1.27.2 | 1.29.11 |
| `react-native-safe-area-context` | 5.7.0 | 5.10.1 |
| `react-native-screens` | 4.26.2 | 4.30.0 |

AsyncStorage 2.2.0 e NetInfo 12.0.1 continuam nas versões recomendadas pelo SDK 58; Firebase e navegação não precisaram de atualização. Node local 24.20.0 atende ao requisito do SDK 58 (24.3+ na linha 24). Não foi necessário modificar APIs das telas, arquivos ou banco para esta migração: os usos de FileSystem e MediaLibrary continuam pelos exports legacy disponíveis; não há uso de libSQL ou File.write() afetados pelas mudanças publicadas.

## Inspetor SQLite

Conferido o bundle original de expo-sqlite 58.0.14: DataBrowser ainda depende do callback instável onLoadData. Adaptado o workaround existente somente para as versões verificadas 57.0.4 e 58.0.14, com trechos exatos, referência estável, backup por versão e reaplicação pelo postinstall. Aplicação, segunda execução sem mudanças e análise sintática do bundle aprovadas. Não altera o SQLite nativo/esquema/dados. Estabilidade visual precisa ser conferida no aparelho/inspetor.

## Validação

- `npx expo install --check`: dependências compatíveis.
- `npx expo-doctor`: 20/20 verificações aprovadas.
- `npm ls --depth=0`: dependências resolvidas sem erro.
- `npm test`: 55 aprovados, 23 cenários dependentes de emulador pulados.
- Exportações Android/iOS concluídas em `dist/validacao-sdk58`; não são APK/IPA e não substituem os testes físicos.
- Auditoria reportada pela instalação npm: 12 alertas (10 altos, 2 moderados). Não executado `npm audit fix --force`; árvore não é declarada livre de vulnerabilidades.

## Ícone ausente no carregamento do Expo Go 58

Em 26/10/2026, usuário enviou captura com nome do app e ícone ausente durante Bundling 99%. Ícone/configuração não foram alterados e a imagem original retorna HTTP 200.

Diagnóstico reproduzido no CLI 58.1.15: sem Forwarded, iconUrl é absoluta; com Forwarded, passa a assets/assets/icone.png. No código Android SDK 58, Manifest.getIconUrl() devolve o texto diretamente e SplashScreenView usa rememberAsyncImagePainter(imageUrl), sem resolver esse caminho relativo. Isso explica a incompatibilidade observada; confirmação visual no Expo Go instalado ainda depende do usuário.

Acrescentado scripts/fix-expo-go-icon.cjs ao postinstall. Correção limitada ao CLI 58.1.15 e a um trecho exato: após resolver assets, torna somente iconUrl absoluta usando protocolo/autoridade reconhecidos do cliente. Mantém bundle/outros assets relativos; não altera PNG, app.json ou splash. Preserva original em .tools/expo-cli-58.1.15-manifest-original.js e não reaplica quando já corrigido. Versões diferentes precisam de nova conferência.

Verificado em Metro temporário na porta 8097: sem Forwarded, HTTP com porta, host externo com porta e HTTPS sem porta; URL do ícone correta nos quatro cenários. Requisições locais da imagem retornaram HTTP 200 e bytes idênticos ao PNG original; bundle continua relativo para clientes novos. Servidor temporário encerrado, servidor do usuário preservado. Ambiente restrito usou fallback de React Native DevTools durante esse teste, sem impedir o manifesto. Testes de sintaxe/idempotência aprovados. Reabrir o servidor atual e o Expo Go para conferir a imagem.

Confirmação física em 26/10/2026: após reiniciar, o usuário informou “Boa! Resolveu.”. Exibição do ícone confirmada no Expo Go Android. Essa confirmação não equivale à validação de todos os fluxos do app no SDK 58.

Fontes: [Manifest Android SDK 58](https://github.com/expo/expo/blob/sdk-58/packages/expo-manifests/android/src/main/java/expo/modules/manifests/core/Manifest.kt), [SplashScreenView Android SDK 58](https://github.com/expo/expo/blob/sdk-58/apps/expo-go/android/expoview/src/main/java/host/exp/exponent/experience/splashscreen/legacy/SplashScreenView.kt) e ManifestMiddleware instalado no CLI 58.1.15. A documentação oficial mantém o ícone como imagem da abertura no Expo Go.

## Teste no Expo Go 58

Encerrar o Metro anterior e iniciar `npx expo start --clear`. Reabrir o projeto pelo QR Code no Expo Go atualizado. Verificar entrada local/e-mail/biometria, abertura e persistência do banco, consulta ViaCEP/manual, cadastro/edição/exclusão de bar, câmera/galeria, mapa/GPS, navegação e inspetor SQLite. Testes físicos ainda pendentes. Nenhum banco, credencial, regra ou conteúdo do Firebase foi alterado nesta migração; nenhum commit/push executado.

Fontes: [guia oficial de atualização](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [notas do SDK 58](https://expo.dev/changelog/sdk-58), [referência SDK 58](https://docs.expo.dev/versions/v58.0.0/) e [SQLite SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/). A referência SDK 57 exigida por AGENTS.md também foi lida antes das alterações.

---

## Histórico — atualização de dependências em 22/10/2026

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
