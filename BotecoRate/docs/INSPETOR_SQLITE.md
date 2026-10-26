# Visualização do SQLite e correção do inspetor

Atualização de 26/10/2026: projeto migrado para Expo SDK 58 e expo-sqlite 58.0.14. O bundle novo conserva o callback instável; o script agora cobre explicitamente 57.0.4 e 58.0.14, preservando backup por versão e recusa de trechos desconhecidos. Aplicação/idempotência/sintaxe aprovadas; estabilidade visual dessa versão ainda depende de teste. Demais registros abaixo descrevem o diagnóstico original do SDK 57. Ver `ATUALIZACAO_DEPENDENCIAS.md`.

Data: 22/10/2026. O banco real `botecorate.db` fica no aparelho. Para consultar: iniciar `npx expo start --clear`, abrir o app no celular, manter em primeiro plano e pressionar Shift+M → Open expo-sqlite no terminal. O launcher Cloudflare não repassa atalhos interativos.

## Diagnósticos distintos

1. Timeout de 30 segundos: o app falhava antes de inicializar, por configuração incorreta das propriedades de retry do Storage. Após corrigir, usuário confirmou abertura normal. Consulta real ao canal DevTools listou `botecorate.db` e suas 20 tabelas. Ver registro em `SINCRONIZACAO_DIRETA.md`.
2. Tela do navegador piscando após selecionar tabela: observado passivamente no WebSocket um total de 5.947 consultas SQL e suas respostas em 18 segundos. Usuário confirmou uma só aba. A interface instalada de `expo-sqlite` 57.0.4 cria um callback `onLoadData` novo ao renderizar; DataBrowser depende desse callback no efeito de carregamento. O carregamento altera o estado do pai, recria o callback e repete o efeito.

## Correção local da ferramenta

`scripts/fix-sqlite-inspector.cjs` aplica correção específica ao bundle web do inspetor 57.0.4. DataBrowser mantém uma referência atual ao callback e usa um carregador estável, preservando a carga ao trocar de tabela e os comandos manuais de paginação/edição. Não modifica o SQLite nativo, esquema, registros, sincronização ou Firebase.

O script verifica versão e três trechos exatos antes de escrever, preserva o bundle original em `.tools/sqlite-inspector-57.0.4-original.js`, é idempotente e roda pelo `postinstall` para reaplicar após instalação. Para outra versão, não aplica automaticamente esse patch; conferir se a versão nova já corrige o problema. A cópia em `node_modules` não é versionada; o script é. Não houve atualização de pacote nesta correção.

Após aplicar, fechar/reabrir o inspetor ou usar Ctrl+Shift+R para evitar o bundle antigo em cache. Abrir apenas uma aba do mesmo plugin, pois o Expo encerra conexões duplicadas do navegador.

Validação inicial: patch aplicado, segunda execução sem mudanças e análise sintática do bundle corrigido aprovada. A confirmação de estabilidade visual exige recarregar a aba; contagens posteriores e retorno do usuário devem ser registrados abaixo.

Verificado também que o Metro serve o JavaScript corrigido por HTTP 200. Em 36 segundos de observação passiva posterior não houve consultas repetidas; como foi solicitado fechar a aba, isso não comprova isoladamente a estabilidade da tabela aberta. Solicitada ao usuário reabertura/recarga completa e confirmação visual.

Validação visual concluída: após reabrir/recarregar o visualizador e selecionar uma tabela, o usuário confirmou: “Parou e consigo consultar a tabela”. Correção confirmada nesta sessão, sem apagar dados ou alterar o banco.
