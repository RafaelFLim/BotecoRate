# BotecoRate

Aplicativo acadêmico de avaliação e gestão de bares, desenvolvido por **Rafael Ferreira e Emanuel Franco** para Laboratório de Desenvolvimento de Aplicativos Híbridos. Usa React Native com Expo, SQLite no aparelho, Firebase Authentication e sincronização direta com Firebase Realtime Database.

Este guia reúne o necessário para instalar, abrir e testar a entrega. Revisão documental 2026.11.17.2. Os comandos de terminal abaixo usam PowerShell no Windows, salvo indicação em contrário.

Para avaliar apenas os testes, siga Instalar e abrir até `npm ci` e execute `npm test`. Para a suíte de integração, instale também Java e execute `npm run test:integration`. A configuração Firebase é necessária para usar o catálogo e as contas online no celular, mas não para esses testes Jest.

## O que instalar

| Para fazer | Requisitos |
| --- | --- |
| Abrir o app em um celular | Git, Node.js 24 a partir de 24.3 com npm, internet na instalação e Expo Go compatível com SDK 58 |
| Executar os testes unitários | Git e Node.js 24 com npm; dispensa celular e configuração Firebase |
| Executar a integração e regras | Requisitos dos unitários e JDK 17 ou superior no PATH; dispensa conta Firebase e credencial administrativa |
| Executar testes de interface | Java 17+, Maestro CLI, Android SDK Platform Tools com adb e Android conectado por USB ou emulador Android |

O caminho de avaliação recomendado é Android com Expo Go. O projeto também tem configuração para iOS; emulador iOS requer macOS/Xcode. A interface web não faz parte deste roteiro de avaliação. O SQLite e os testes usam recursos nativos ou o SQLite do Node.

Instale Node pela [página oficial](https://nodejs.org/en/download), Expo Go pela [distribuição oficial do Expo](https://expo.dev/go?sdkVersion=58&platform=android&device=true) e, para a integração, um [JDK 17 ou superior](https://adoptium.net/temurin/releases/). Não é necessário instalar Expo CLI ou Jest globalmente. Python, Flask, MySQL, Docker e Firebase Storage não são requisitos para abrir o app ou executar a suíte JavaScript.

## Instalar e abrir

Clone o repositório da entrega e entre na pasta que contém `package.json`:

```powershell
git clone https://github.com/RafaelFLim/BotecoRate.git
cd BotecoRate/BotecoRate
node --version
npm ci
```

Existem duas pastas chamadas BotecoRate: a primeira é o repositório clonado; a segunda é o aplicativo. Se já abriu este repositório na IDE, execute apenas `cd BotecoRate` a partir da raiz. Os demais comandos deste guia são executados na pasta do aplicativo.

Para abrir em modo de consulta local:

```powershell
npx expo start --clear
```

No Android, abra Expo Go e leia o QR exibido no terminal. No iPhone, abra o QR pela câmera com Expo Go compatível. Computador e celular precisam alcançar a mesma rede; mantenha o terminal aberto. A tela inicial deve mostrar BotecoRate, Mapa e o acesso às opções de conta. Sem configuração Firebase e sem dados anteriores, a lista pode estar vazia. É possível cadastrar e autenticar uma conta local no aparelho; ela permite consulta e não publica alterações online.

Para receber o catálogo do grupo, criar conta por e-mail e testar as funções online, faça a configuração seguinte antes de iniciar o Expo. Os bares de demonstração foram importados para o banco remoto; o aplicativo não recria bares mockados a cada abertura.

## Habilitar o modo online

O `.env.local` informa a qual Firebase o aplicativo deve se conectar. Ele fica na pasta do aplicativo, ao lado de `package.json`, e não é baixado pelo `git clone`. O `.env.example` versionado é apenas o modelo, com os campos a preencher.

Se a entrega acompanhar um `.env.local` já preenchido, salve esse arquivo na pasta do aplicativo e avance para Conferir e iniciar. Para configurar manualmente, siga os passos abaixo.

### Criar a configuração local

1. No terminal, dentro da pasta do aplicativo, copie o modelo. Execute o comando apenas se ainda não tiver um `.env.local` preenchido:

```powershell
Copy-Item .env.example .env.local
```

2. Abra o `.env.local` no editor. No [Console Firebase](https://console.firebase.google.com/), selecione o projeto desejado e acesse Configurações do projeto → Geral → Seus aplicativos → aplicativo Web → configuração do SDK. Copie os campos da configuração Web conforme a tabela abaixo. Não é necessário executar o código JavaScript mostrado pelo console.
3. Em Realtime Database → Dados, copie a URL completa do banco para `EXPO_PUBLIC_FIREBASE_DATABASE_URL`. Todos os valores devem pertencer ao mesmo projeto.

| Variável obrigatória | Campo do Firebase |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `EXPO_PUBLIC_FIREBASE_DATABASE_URL` | URL completa do Realtime Database |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | `appId` |

4. Salve o arquivo. O formato é uma variável por linha, sem `const`, chaves de objeto ou vírgulas. O exemplo abaixo mostra o formato; substitua os textos ilustrativos pelos valores do seu projeto:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=VALOR_DO_CAMPO_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=VALOR_DO_CAMPO_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID=ID_DO_PROJETO
EXPO_PUBLIC_FIREBASE_DATABASE_URL=URL_COMPLETA_DO_REALTIME_DATABASE
EXPO_PUBLIC_FIREBASE_APP_ID=VALOR_DO_CAMPO_APP_ID
```

Para conectar ao Firebase do grupo, utilize a configuração cliente incluída separadamente na entrega ou consulte esse projeto com uma conta que tenha acesso ao console. Uma conta criada pelo aplicativo não concede acesso ao Console Firebase. Se usar um projeto próprio, configure seus serviços conforme a orientação abaixo; o catálogo inicial será o desse novo banco.

`EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` é opcional e pode ficar vazio: as fotos atuais usam Base64 no RTDB. Não colocar conta de serviço, chave privada ou JSON Admin SDK nessas variáveis. A configuração do cliente é incorporada ao app; o acesso aos dados é controlado por Authentication e regras remotas.

### Conferir e iniciar

Confira a configuração e abra o app:

```powershell
npm run check:firebase
npx expo start --clear
```

O diagnóstico deve indicar `configured: true` e `missing: []`. Após editar o ambiente, encerre o Expo com Ctrl+C e inicie novamente. Para conferir também acesso de rede, use `npm run check:firebase -- --online`; esse diagnóstico consulta os serviços sem criar cadastros.

No projeto do grupo, use o banco e as regras preparados para a entrega. Em um projeto próprio, habilite Authentication → E-mail/senha, crie o Realtime Database e publique `firebase/database.rules.json` antes de testar gravações. A configuração de um projeto novo e o bootstrap de admin estão no [guia de desenvolvimento](BotecoRate/docs/DESENVOLVIMENTO_E_TESTES.md). Criar um projeto novo não importa o catálogo do grupo.

### Contas e permissões para avaliação

Uma conta local fica somente no aparelho. Para as funções online, cadastre uma conta com e-mail, confirme o link recebido e entre novamente/atualize a confirmação no aplicativo. A conta deve estar ativa. Conta comum pode avaliar e solicitar habilitação de dono; para cadastrar bar é necessário CNPJ aprovado ou papel admin.

As contas são criadas pelo próprio avaliador na tela de cadastro do aplicativo. Uma conta nova começa como usuário comum; criar a conta e confirmar o e-mail não concede papel administrativo. O painel exige uma conta com permissão `admin` no projeto utilizado. Os testes Jest de integração já preparam identidades fictícias e cobrem essas permissões sem precisar de uma conta real. Senhas reais e credenciais administrativas não são distribuídas neste repositório.

## Executar os testes

### Testes unitários com Jest

Depois de `npm ci`, execute:

```powershell
npm test
```

Executa validações, filtros, apresentação e serviços com as fronteiras nativas simuladas. Não exige `.env.local`, Java, internet durante os testes, celular ou Firebase real. O resultado esperado é todas as suítes selecionadas aprovadas. A configuração fica em `jest.config.cjs`; os arquivos estão em `tests/*.test.js`.

### Integração SQLite e Firebase Emulator

Confirme que `java -version` mostra 17 ou superior e execute:

```powershell
java -version
npm run test:integration
```

O comando instala/usa Firebase CLI 14.17.0 por npx, inicia o emulador RTDB, executa o projeto de integração Jest e solicita o encerramento dos emuladores ao terminar. Na primeira execução, aceite a instalação se o npx perguntar; é necessária internet para baixar CLI/emulador e essa etapa pode levar mais tempo. Não exige login no Firebase CLI, projeto real, `.env.local` ou conta de serviço. Os testes usam exclusivamente o projeto local `demo-botecorate`, dados fictícios e SQLite do Node.

As portas configuradas em `firebase.json` são 19000 para RTDB, 14000 para a interface, 14400 para o hub e 14500 para logs. Deixe-as livres antes do comando. Se uma execução anterior deixou um emulador aberto, encerre aquela sessão antes de repetir.

No Windows, a versão utilizada do CLI pode deixar o processo Java do RTDB aberto mesmo após informar o encerramento. Se a próxima execução acusar a porta 19000 ocupada, identifique o processo com os comandos abaixo. Encerre esse PID no Gerenciador de Tarefas somente se a linha de comando indicar `firebase-database-emulator` e a porta 19000; preserve outros processos Java.

```powershell
Get-NetTCPConnection -LocalPort 19000 -State Listen | Select-Object OwningProcess
Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Select-Object ProcessId, CommandLine
```

Para avaliar a suíte completa, execute os dois comandos:

```powershell
npm test
npm run test:integration
```

`npm run test:all` sozinho não inicia o emulador e pula os cenários que precisam dele. Para avaliar apenas as regras de segurança, use `npm run test:rules`, que inicia seu próprio emulador.

Verificação desta revisão em 17/11/2026, com Node 24.14.0 e Java 17: instalação limpa por `npm ci`, 35 testes unitários aprovados em 9 suítes e 100 de integração aprovados em 11 suítes. Total de 135 testes aprovados, sem testes pulados nessas execuções. Ao repetir, use o relatório do terminal para conferir seu resultado.

### Interface Android com Maestro

Este bloco exige preparação do dispositivo. Os seis fluxos cobrem visitante, cadastro/login local, nome inválido, teclado, gesto de atualização e confirmação de senha. Os YAML estão em `maestro/`; os arquivos `_*.yaml` são auxiliares. A suíte cria uma conta local fictícia com nome único, preserva os dados existentes e não exige uma conta Firebase para executar os fluxos.

1. Instale Java 17+ e configure `JAVA_HOME` para o JDK. Instale o [Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli). No Windows, baixe o [ZIP oficial](https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip), extraia e adicione a pasta `bin` ao PATH. Confirme `maestro --version`.
2. Instale [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools), disponibilize `adb` no PATH e conecte um Android com depuração USB autorizada, ou inicie um emulador pelo Android Studio. `adb devices -l` precisa mostrar o dispositivo como `device`.
3. No primeiro terminal, execute `npx expo start --clear`. Abra o projeto no Expo Go do Android, conclua os diálogos iniciais e deixe a lista do aplicativo aberta, com teclado virtual habilitado.
4. No segundo terminal, na mesma pasta do aplicativo, execute:

```powershell
maestro --version
adb devices -l
npm run test:e2e
```

O script usa o appId Android do Expo Go, `host.exp.exponent`, e seleciona apenas a tag `e2e`. Se o Expo Go abrir seu launcher em vez do projeto, informe o deep link efetivamente mostrado pelo Metro. Substitua o endereço ilustrativo abaixo pelo seu:

```powershell
npm run test:e2e -- -e EXPO_URL=exp://192.168.0.10:8081
```

Com mais de um Android conectado, escolha o serial real exibido pelo adb e use o comando direto, substituindo também o endereço:

```powershell
maestro --device SERIAL_DO_ADB test --include-tags=e2e -e APP_ID=host.exp.exponent -e EXPO_URL=exp://192.168.0.10:8081 maestro
```

Não é necessário apagar dados nem reinstalar o Expo Go. A conta de teste permanece no SQLite. O fluxo de arraste verifica interação/responsividade e não prova sozinho uma sincronização remota. O teclado deve ser conferido visualmente na primeira execução. A referência registrada dos YAML é validação estática; ainda não há execução Maestro em dispositivo registrada nesta entrega. Preparação avançada, relatórios e roteiro manual em dois celulares estão no [guia de desenvolvimento e testes](BotecoRate/docs/DESENVOLVIMENTO_E_TESTES.md).

## Roteiro rápido de avaliação manual

1. Abra como visitante e consulte a lista. No perfil, crie uma conta local, saia e entre com o mesmo usuário e senha.
2. Tente um nome sem três letras e senhas diferentes no cadastro; confira as mensagens vermelhas e a preservação do formulário.
3. Com Firebase configurado, entre com e-mail verificado e consulte o catálogo sincronizado. Crie/edite uma avaliação em um bar de teste permitido.
4. Com conta dona habilitada ou admin, cadastre/gerencie um bar com três itens, endereço separado e foto; consulte CEP e confira a cidade após aplicar a resposta.
5. Com outra conta autorizada, confira a sincronização, os convites e os aceites. Exclusão de bar compartilhado exige os consentimentos previstos.
6. Abra histórico e lixeira, pesquise e use a paginação. Restaure uma exclusão de teste dentro do prazo e com permissão válida.

Use registros descartáveis de teste. Dados de outro aparelho chegam após sincronização; para atualizar manualmente, puxe a lista para baixo. O roteiro completo e os resultados já confirmados estão no guia de desenvolvimento.

## Consultar o banco SQLite

Com o app aberto e em primeiro plano no celular, use Shift+M no terminal Expo e escolha Open expo-sqlite. No navegador, selecione `botecorate.db`. As tabelas e views de histórico estão descritas no [guia do banco](BotecoRate/docs/BANCO_E_ARQUITETURA.md).

O arquivo é criado no aparelho pelo código de `src/database/database.js`. Não é necessário criar/copiar um `.db` no computador. O Firebase recebe registros, não o arquivo inteiro. No Console Firebase, veja o catálogo em Realtime Database → Dados → `v1/direct`; veja as contas em Authentication → Users.

## Problemas frequentes

| Sintoma | O que conferir |
| --- | --- |
| npm não encontra package.json | Entre na subpasta do aplicativo, `BotecoRate/BotecoRate` após o clone |
| Expo Go informa SDK incompatível | Instale Expo Go compatível com SDK 58 pelo link oficial; não altere as dependências para contornar |
| QR não abre ou Metro não responde | Celular/computador na mesma rede e acesso liberado ao Metro; em Windows x64, tente `npm run start:tunnel` e use o QR temporário gerado |
| Lista vazia | Sem Firebase configurado/cache prévio isso é esperado; confira `.env.local` e o banco usado |
| Login online indisponível | Execute `npm run check:firebase`, preencha os campos ausentes e reinicie o Expo |
| Permission denied | Confira e-mail verificado, sessão, estado/papel, vínculo e regras do projeto correto |
| Integração não inicia | Confira Java 17+, internet no primeiro download e portas do emulador livres |
| Maestro ou adb não encontrado | Instale as ferramentas do bloco E2E e inclua seus diretórios no PATH do terminal |
| Maestro não encontra a tela inicial | Abra o projeto manualmente no Expo Go e passe o EXPO_URL real do Metro |
| Inspetor SQLite apresenta timeout | Primeiro confirme que o app abriu no celular; mantenha-o em primeiro plano e reabra uma única aba do inspetor |

O launcher de túnel do projeto foi preparado para Windows x64. Outros sistemas usam o fluxo LAN ou uma alternativa compatível configurada pelo responsável. Detalhes operacionais ficam no guia de desenvolvimento.

## Estrutura e documentação

| Caminho dentro do aplicativo | Conteúdo |
| --- | --- |
| `App.js`, `src/screens`, `src/components` | Inicialização e interface |
| `src/database` | SQLite, esquema versão 10, stores e históricos |
| `src/services` | Authentication, sincronização, propriedade, administração e lixeira |
| `firebase/database.rules.json` | Regras versionadas do RTDB |
| `tests`, `jest.config.cjs` | Suítes Jest unitárias e de integração |
| `maestro` | Fluxos de interface Android |
| `scripts` | Diagnóstico, geradores e ferramentas de desenvolvimento |
| `server` | Ferramentas administrativas e API histórica, opcionais para este roteiro |

| Guia | Markdown | Word |
| --- | --- | --- |
| Instalação e avaliação | [Abrir Markdown](BotecoRate/docs/README.md) | [Abrir Word](BotecoRate/docs/README.docx) |
| Regras de negócio | [Abrir Markdown](BotecoRate/docs/REGRAS_DE_NEGOCIO.md) | [Abrir Word](BotecoRate/docs/REGRAS_DE_NEGOCIO.docx) |
| Banco e arquitetura | [Abrir Markdown](BotecoRate/docs/BANCO_E_ARQUITETURA.md) | [Abrir Word](BotecoRate/docs/BANCO_E_ARQUITETURA.docx) |
| Desenvolvimento e testes completos | [Abrir Markdown](BotecoRate/docs/DESENVOLVIMENTO_E_TESTES.md) | [Abrir Word](BotecoRate/docs/DESENVOLVIMENTO_E_TESTES.docx) |
| Histórico e decisões | [Abrir Markdown](BotecoRate/docs/HISTORICO_E_DECISOES.md) | [Abrir Word](BotecoRate/docs/HISTORICO_E_DECISOES.docx) |

Os Markdown em `docs` são as fontes dos Word. O README da raiz é uma cópia gerada deste guia, com os links ajustados. A partir da pasta do aplicativo, `python scripts/build-docs.py` atualiza os arquivos e `python scripts/build-docs.py --check` verifica igualdade. Para manter a documentação, instale antes `scripts/requirements-docs.txt` em seu ambiente Python; isso é opcional para rodar/testar o app.

## Escopo da entrega

Implementados: contas locais e online, catálogo SQLite/Firebase, filas/conflitos, gestão de bares, avaliações/ranking, administração/moderação, aprovação de donos e CNPJs, copropriedade/transferência, custódia, históricos paginados, lixeira e restauração online. Endereço usa ViaCEP com preenchimento manual; fotos novas usam Base64 no RTDB.

Permanecem documentados: hard delete manual/automático e limpeza distribuída após 30 dias; integração direta com Correios; execução real dos fluxos Maestro e regressão física das mudanças recentes, incluindo iOS. O vencimento dos 30 dias bloqueia restauração, mas ainda não executa expurgo automático. O [histórico de decisões](BotecoRate/docs/HISTORICO_E_DECISOES.md) detalha esses limites e as evidências anteriores.
