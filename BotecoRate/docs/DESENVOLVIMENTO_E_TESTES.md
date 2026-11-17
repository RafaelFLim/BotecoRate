# Desenvolvimento e testes do BotecoRate

Versão documental 2026.11.10.1. Este guia reúne instalação, configuração, operação do banco, segurança do versionamento e validação com duas pessoas e dois celulares. Os resultados relatados são separados dos cenários ainda necessários.

## Preparação do projeto

Abra um terminal na pasta `BotecoRate`. O projeto foi verificado com Node.js 24. Para executar o Firebase Emulator, mantenha Java 17 ou superior no PATH. O ambiente Python `server/.venv` serve às ferramentas administrativas e à API anterior; ele não é o ambiente do aplicativo Expo. A ativação desse ambiente no terminal não significa que o app passou a usar Python.

```powershell
npm ci
npx expo start --clear
```

O Expo Go deve ser compatível com o SDK declarado no projeto. A faixa atual é Expo `~58.0.21`, React `19.3.0`, React Native `0.88.1`, expo-sqlite `~58.0.14` e Firebase `^12.19.0`. O `package-lock.json` determina a resolução reproduzível. Antes de atualizar dependências, conferir compatibilidade, comunicar a atualização e testar a base antes de novas funcionalidades.

O `postinstall` aplica correções locais controladas do inspetor SQLite e do ícone no Expo Go. Esses scripts são versionados; `node_modules` e suas cópias de backup não são. Atualizar o Expo pode exigir rever os trechos reconhecidos pelos scripts e reconstruir um cliente nativo próprio.

### Configuração Firebase

Copie `.env.example` para `.env.local` e preencha a configuração do aplicativo Web do projeto. Ela fica em Console Firebase → Configurações do projeto → Geral → Seus aplicativos → aplicativo Web → configuração do SDK. Não use o JSON de conta de serviço nesse arquivo.

Os campos usados incluem `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_DATABASE_URL` e `EXPO_PUBLIC_FIREBASE_APP_ID`. Use o modelo do repositório para os opcionais. A URL do Realtime Database é obtida na página do produto. O bucket opcional não é necessário para o fluxo atual de fotos Base64. `EXPO_PUBLIC_API_URL` pertence ao transporte anterior e não é necessário à sincronização direta.

Em Authentication → Sign-in method, habilite E-mail/senha. Em Authentication → Users, veja contas, UID e verificação do e-mail. Em Realtime Database → Dados, consulte os nós `v1` e suas subdivisões. Papéis/status estão em `access_control`, e não na lista de contas do Authentication. Um `null` na raiz do RTDB significa ausência de dados naquele banco; criar uma conta Auth não cria automaticamente todas as entidades de negócio.

```powershell
npm run check:firebase
npm run check:secrets
```

Alterações de `.env.local` exigem reiniciar o Metro. Se houver Permission denied, confirmar projeto, sessão, e-mail verificado, token atualizado, estado da conta e regras publicadas. Não abrir leitura/escrita na raiz para ocultar uma falha de autorização.

## Rede local e túnel

Na mesma rede, abra pelo QR de `npx expo start --clear`. Para outra pessoa em outra rede, mantenha o computador e o terminal ligados e use o launcher do projeto.

```powershell
npm run start:tunnel
npm run start:tunnel -- --port 8082
npm run start:tunnel -- --check
```

Compartilhe a URL `exps://...trycloudflare.com` ou seu QR. O launcher Windows x64 baixa Cloudflared portátil oficial, confere SHA256 e guarda o executável em `.tools`. Ele define o proxy antes de iniciar o Expo, sem editar `.env.local`. A sessão fica em `.expo/cloudflare-tunnel.json`. Ctrl+C encerra os processos da sessão; uma nova execução gera outro endereço. A ferramenta não encerra servidores alheios em portas ocupadas.

Os atalhos interativos do Expo não são repassados por esse launcher. Para usar o inspetor pelo terminal, prefira a inicialização normal. O erro antigo do túnel Ngrok, que aparecia como leitura de `body` indefinida, foi diagnosticado como limite da conta compartilhada. Isso não indicava erro do Firebase. O túnel de desenvolvimento deve ser encerrado após os testes; ele não hospeda a aplicação em produção.

## Consultar o SQLite

1. Inicie `npx expo start --clear` e abra o aplicativo no celular.
2. Confirme que a lista abriu sem tela vermelha e mantenha o app em primeiro plano.
3. No terminal Expo, use Shift+M e escolha Open expo-sqlite.
4. No navegador, selecione `botecorate.db`, uma tabela ou o editor SQL.
5. Consulte as views e os exemplos do [Guia de banco e arquitetura](BANCO_E_ARQUITETURA.md).

O aplicativo registra a conexão no visualizador por `useSQLiteDevTool`. O arquivo fica no celular; não é necessário existir um `.db` na pasta do computador. Cada aparelho mostra seu próprio conteúdo sincronizado. Não limpe os dados do Expo Go para diagnosticar conexão sem antes preservar as alterações locais.

Timeout de 30 segundos pode ocorrer se o app falhou antes de abrir o banco, perdeu a conexão ou está usando uma sessão antiga. Primeiro resolva a falha de inicialização, depois reabra o inspetor. A oscilação antiga foi corrigida em `scripts/fix-sqlite-inspector.cjs`; abra uma única aba e use Ctrl+Shift+R para abandonar o bundle em cache. O script reconhece versões específicas, faz backup e não modifica dados. O usuário confirmou estabilidade na sessão original; atualização de dependência exige nova checagem.

## Regras remotas e ferramentas administrativas

As regras do catálogo são geradas a partir de `scripts/build-direct-rules.cjs` e dos geradores auxiliares de propriedade, custódia, validação, CNPJ e exclusão. Gere o JSON e execute os testes antes de publicar.

```powershell
node scripts/build-direct-rules.cjs
npm run test:rules
npx firebase-tools@14.17.0 deploy --only database --project botecorate
```

O último comando publica regras no projeto real e exige a sessão autorizada da equipe. Executá-lo somente após revisar destino e resultado dos testes. Releia as regras publicadas e confira os fluxos; uma exportação de bundle não valida autorização remota.

As ferramentas Python usam `server/requirements.txt`. Para preparar um ambiente local, a partir de BotecoRate:

```powershell
py -m venv server/.venv
./server/.venv/Scripts/python.exe -m pip install -r server/requirements.txt
./server/.venv/Scripts/python.exe -m server.manage --help
```

Configure `GOOGLE_APPLICATION_CREDENTIALS` apenas no processo administrativo, apontando para a conta de serviço privada, além de `FIREBASE_PROJECT_ID` e `FIREBASE_DATABASE_URL` com o destino correto. `server.manage` oferece `promote-admin`, `import-demo`, `prepare-direct`, `sync-user-directory`, `prepare-ownership` e `prepare-profile-names`. Os comandos exigem `--confirm-project` e, normalmente, `--actor-uid`. `promote-admin` recebe `--uid`; `--bootstrap` destina-se somente à primeira promoção quando ainda não há admin.

Não repetir importações ou migrações de produção como teste. As preparações são aditivas/idempotentes conforme suas implementações, mas devem ter destino conferido, backup e resultado inspecionado. O arquivo administrativo nunca é enviado ao app nem ao Git. Nenhuma dessas rotinas precisa ficar executando para o celular sincronizar.

## Segurança antes de commit

O `.gitignore` protege ambientes, conta de serviço, chaves privadas, bancos e sidecars, backups, ferramentas e relatórios. Exemplos vazios, DDL, regras e código continuam versionáveis. Ignore não retira automaticamente um arquivo já rastreado, nem elimina uma exposição anterior.

```powershell
git status
npm run check:secrets
npm run check:secrets -- --staged
git diff --cached
```

A checagem de staging examina o conteúdo preparado, mesmo se a cópia da pasta tiver sido alterada depois. O scanner não garante reconhecer toda senha arbitrária nem inspeciona o conteúdo interno de arquivos Word; revise também os textos fonte usados para gerá-los. A configuração cliente Firebase é incorporada ao app e depende das regras de segurança. Chave Admin SDK é uma credencial privada separada, mesmo entre integrantes que são proprietários do Firebase.

Se houver chave privada publicada, revogar/substituir e avaliar o histórico. Não basta adicioná-la ao ignore. Ao preparar o commit, confira também arquivos modificados na raiz do workspace: `git add .` dentro de BotecoRate não inclui o diretório pai.

## Backup e restauração

O backup estável inicial está em `.backups/BotecoRate-estavel-2026-10-22-ba74f093.tar.gz`, acompanhado de SHA256. Ele inclui código, configurações locais, alterações daquele momento e histórico Git; exclui `node_modules` e cache Expo. Não contém o SQLite/fotos/permissões dos celulares. É privado e sua presença atual deve ser conferida antes de depender dele.

O SHA256 registrado é `5EA274D2545B5B30973EFEFF509B6EA671F5779FF231BEDD4806F886A325D175`. Para restaurar, compare o hash e extraia em uma pasta nova vazia, conservando o workspace atual; depois execute `npm ci`. Os arquivos GSD do teste foram retirados da pasta ativa para `.backups/gsd-retirado-ba74f093`. Restaurar o backup integral também traz esses arquivos antigos.

A consolidação documental de 10/11/2026 preserva a pasta anterior em um ZIP `documentacao-antes-consolidacao-*.zip` em `.backups`, com manifesto SHA256 por arquivo. Isso recupera a documentação original, inclusive as alterações ainda não commitadas. Não equivale a backup do banco ou do código atual completo.

## Testes unitários e de integração com Jest

A configuração `jest.config.cjs` segue o exemplo do professor em `../Exemplo-Teste`: ambiente Node, arquivos `tests/*.test.js` e asserções Jest. O projeto `unit` reúne validações, filtros, apresentação e serviços com fronteiras nativas simuladas. O projeto `integration` preserva cenários com SQLite real e Firebase Emulator. Integração com banco não é rotulada como teste unitário.

| Comando | Escopo |
| --- | --- |
| `npm test` ou `npm run test:unit` | Unitários, sem aparelho nem Firebase remoto |
| `npm run test:watch` | Unitários em observação |
| `npm run test:integration` | Integrações SQLite e RTDB no emulador |
| `npm run test:all` | Todos os projetos no ambiente disponível |
| `npm run test:rules` | Regras de segurança no emulador |
| `npm run test:direct` | Atalho para a integração atual |
| `npm run test:server` | Ferramentas e API Python preservadas |
| `npm run test:sync:emulator` | Integração do servidor anterior com emulador |
| `npm run test:e2e` | Fluxos Maestro em Android preparado |

`scripts/jest-transform.cjs` adapta imports, JSX e `import.meta.url` ao Jest; não modifica as fontes do app. Os cenários anteriores de `node:test` foram migrados. A configuração aceita 30 segundos por teste para acomodar derivação de senha local.

Resultado registrado na migração: **135 testes aprovados em 20 suítes**, sendo 35 unitários e 100 de integração, com o Firebase Emulator. Sem o emulador, `test:all` aprovou 94 e pulou 41 cenários remotos; esses skips não contam como aprovação. Os scripts usam `demo-botecorate`, sem contas de produção nem chave administrativa. Verifique Java e as portas de `firebase.json` se a inicialização falhar. O RTDB está configurado na porta 19000.

Exportações Android e iOS também passaram nessa etapa. São compilações JavaScript, não APK/IPA nem teste físico. A revisão de dependências ainda registrou alertas de auditoria; não foi aplicada correção forçada incompatível. As contagens são evidência da execução registrada, não uma garantia para futuras alterações.

## Testes de interface com Maestro

Os YAML em `maestro/` usam `appId: ${APP_ID}`, ações reais e asserções de interface. Os seis fluxos principais têm tag `e2e`; quatro subfluxos têm tag `auxiliar`. O filtro é obrigatório porque o prefixo `_` sozinho não impede descoberta.

| Fluxo | Verificação |
| --- | --- |
| `01-visitante.yaml` | Lista, opções de conta, login local e retorno sem autenticar |
| `02-conta-local.yaml` | Criar conta local única, sair e autenticar a mesma conta |
| `03-nome-invalido.yaml` | Nome sem três letras, mensagem e permanência no formulário |
| `04-teclado.yaml` | Foco, rolagem, mostrar/ocultar e fechamento do teclado |
| `05-atualizacao-gesto.yaml` | Arraste na lista e responsividade depois do gesto |
| `06-confirmacao-senha.yaml` | Senhas divergentes e descarte do rascunho |

**Situação:** YAML e referências foram validados estaticamente. Maestro não estava instalado e nenhum aparelho foi identificado para a execução nessa tarefa. Ainda não há resultado E2E em dispositivo. A asserção de visibilidade não comprova, sozinha, que o teclado virtual apareceu ou que não cobriu o campo. O gesto é um teste de interação; não prova uma sincronização remota concluída.

### Preparar Windows e Android

1. Instale Java 17 ou superior. Baixe o ZIP da [release oficial do Maestro](https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip), extraia em pasta estável e acrescente o diretório `bin` ao PATH da sessão.
2. Instale Android SDK Platform Tools, disponibilize `adb` e conecte o celular com depuração USB autorizada, ou inicie um emulador Android.
3. Confirme `java -version`, `maestro --version`, `maestro test --help` e `adb devices -l`. Resolva estados `unauthorized` e `offline` antes de continuar.
4. Inicie o Metro, abra o projeto em Expo Go compatível com o SDK, conclua os diálogos iniciais e deixe a lista pronta. Habilite o teclado virtual.
5. Execute primeiro visitante, depois conta local e validações. Confira os seletores no Inspector do Maestro.

```powershell
npm run test:e2e
npm run test:e2e -- -e EXPO_URL=exp://SEU_HOST:8081
```

Para selecionar um dispositivo, substitua o serial pelo valor real de `adb devices -l`:

```powershell
maestro --device SERIAL_REAL test --include-tags=e2e -e APP_ID=host.exp.exponent -e EXPO_URL=exp://SEU_HOST:8081 maestro
```

`EXPO_URL` é o deep link efetivo do Metro, com `exp://` ou `exps://`. O helper só chama `openLink` quando a variável está preenchida. Sem ela, `launchApp` precisa voltar diretamente ao projeto. Para APK próprio, use o application ID real e omita EXPO_URL quando desnecessário. iOS requer ambiente apropriado em macOS; os dois Android não validam iOS.

Para um único fluxo, substitua `maestro` pelo caminho YAML e ajuste o filtro. Para relatório, use `--format JUNIT --output maestro-resultados.xml`. Registre versão do Maestro, Android, Expo Go, aparelho, comando, resultado e evidência. Relatórios e screenshots ficam ignorados.

Não usar `clearState`, `clearKeychain`, `adb shell pm clear`, reinstalação ou desinstalação para preparar estes fluxos. A conta fictícia criada pela interface fica no SQLite; uma nova execução usa outro nome. Os testes não fazem login Firebase nem usam senhas reais, mas a inicialização e o refresh podem ler o catálogo configurado. Use ambiente de teste separado para isolar também a rede.

Os IDs implementados incluem `cadastro-usuario`, `cadastro-senha`, `cadastro-confirmacao`, `login-usuario`, `login-senha` e `lista-bares`. Textos acessíveis completam a seleção. Mudanças nos rótulos exigem revisão dos YAML.

## Roteiro com duas pessoas e dois celulares

Use aparelhos A e B, ambos com o mesmo código atualizado. Uma pessoa opera A e a outra B; o assistente ajuda a interpretar falhas e preparar correções. Não são necessários mais celulares. São necessárias contas de teste com papéis distintos: podem ser usadas sequencialmente nos mesmos aparelhos. Duas contas admin não demonstram que um usuário comum está bloqueado.

Prepare um bar descartável, legítimo para as contas de teste, com três itens. Confira filas antes de cada bloco; não descarte trabalho de terceiros. Para testar offline no Expo Go, abra o app e baixe o bundle antes de desligar a rede. Falha ao obter o bundle do Metro não significa perda do SQLite. Início totalmente offline precisa de uma build instalada e teste separado.

| Bloco | Passos entre A e B | Resultado esperado |
| --- | --- | --- |
| Consulta e login | A visitante/local; B e-mail confirmado; alternar contas | Consulta liberada; interação só com autorização remota |
| Nome e senha | Tentar ponto, emoji, números, nome ocupado e senha divergente | Erro vermelho junto ao campo; nenhum dado perdido; reset por e-mail separado |
| Aprovação inicial | A comum envia CNPJ; B admin decide com motivo | A recebe decisão; cadastro liberado apenas após aprovação |
| CNPJs adicionais | A usa o primeiro e envia vários; B aprova parte e recusa parte | Seletor mostra aprovados livres; cada CNPJ tem estado/motivo próprios |
| Duplicidade de CNPJ | Preparar dois cadastros concorrentes com o mesmo CNPJ da conta | Apenas um vínculo canônico aceito; outro fica revisável |
| Endereço e CEP | Consultar 01001-000 e 27700-000; aplicar; editar; testar sem rede | Cidade/UF persistem; campos separados; manual disponível |
| Foto e offline | A troca foto de bar/item sem rede; reconecta; B atualiza e reabre | Foto nova recebida e persistida; fila confirmada |
| Troca de conta | A prepara edição offline, entra local, reconecta e volta à conta original | Proposta não aparece nem é enviada pela conta local |
| Conflito | A e B editam o mesmo campo offline; reconectar A e depois B | Conflito preservado em B; revisão consciente e convergência |
| Copropriedade | A convida B; B aceita; repetir com outro dono já vinculado | Remetente já aceito; demais donos precisam aceitar; aviso de espera claro |
| Transferência | Escolher dono substituído e coletar todos os aceites | Só o escolhido sai; demais vínculos/autoria preservados |
| Exclusão compartilhada | A solicita com motivo; B responde; confirmar após unanimidade | Bar ativo até confirmação final; pedido visível em Gerenciar bar |
| Administração e custódia | B administra contas de teste e torna último dono inelegível | Comandos bloqueados para banido; custódia registrada e encerrada conscientemente |
| Moderação | Avaliação fictícia recebe decisão justificada | Conteúdo preservado, ranking atualizado e restauração só administrativa |
| Lixeira | A exclui; B comum não vê como sua; B admin filtra e restaura | Escopo pelo autor da exclusão; prazo e integridade respeitados |
| Cascata | Excluir item antes do bar; restaurar o bar depois | Filho antigo continua excluído; grupo correto volta com três itens |
| Histórico e páginas | Gerar mais de 20 eventos e combinar filtros | Páginas sem repetição; total correto; novos filtros voltam à primeira |
| Teclado e acessibilidade | Nome do bar, e-mail, cidade e senha com teclado aberto e fonte ampliada | Campo focado visível, erro perceptível, rascunho preservado |
| Navegação | Gesto/botão Voltar e retorno da câmera | Destino correto; continuar/descartar funciona |
| Atualização | A salva; B puxa lista para baixo | Spinner acompanha a operação; catálogo e falhas coerentes |

### Evidência já registrada

Na rodada de 27/10, o usuário confirmou em dois Android fotos novas de bar/item, chegada e persistência, edição offline/retorno ao primeiro plano, troca Firebase → local → original com isolamento da fila, conflito com proposta preservada e convergência, consulta de visitante/local, edição/exclusão propagada, CEP manual/geral e gestos/retorno da câmera. A limpeza final da fila no conflito não foi confirmada explicitamente. Esses relatos não validam funcionalidades acrescentadas depois.

Posteriormente, o usuário confirmou a volta do login após a correção. O fluxo de restauração foi corrigido e tem cobertura automatizada, mas o relato antigo da exclusão não comprova a restauração atual. A falha recente de CEP/cidade e a nova correção de teclado precisam de nova verificação física. O inspetor foi confirmado estável na sessão original.

Continuam importantes a execução real do Maestro, testes negativos com comum/dono sem vínculo, fluxo completo de vários CNPJs, consenso com mais donos, custódia, restauração com cascata e limite de prazo, e validação em iOS. Hard delete automático não pode ser aprovado enquanto o executor não existir.

Para cada execução, anote ID do cenário, data, versão/commit, papéis de A e B, passos, resultado esperado/observado e evidência sem credenciais. O PDF antigo em `output/pdf` representa o roteiro da época; este guia é a referência atualizada.

## Manter Markdown e Word sincronizados

Os cinco Markdown em `docs/` são a fonte de conteúdo. Edite o guia correspondente, atualize a versão documental nos cinco quando publicar uma revisão conjunta e execute o gerador com Python e `python-docx` instalado no ambiente de documentação.

```powershell
python -m pip install -r scripts/requirements-docs.txt
python scripts/build-docs.py
python scripts/build-docs.py --check
```

O gerador produz os cinco `.docx` com os mesmos títulos, parágrafos, listas, tabelas e trechos de código. Registra o hash da fonte e valida o conteúdo textual contra o modelo Markdown. `--check` verifica os arquivos existentes sem regenerar. Inclua os dois formatos no commit. Para revisão visual, abra os Word e confira tabelas, páginas e links; a checagem textual não substitui a visual.

## Referências de execução

[Instalação do Maestro](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli), [comandos do Maestro](https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options), [tags dos fluxos](https://docs.maestro.dev/maestro-flows/workspace-management/test-discovery-and-tags), [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) e [atualização do Expo](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/). As instruções descrevem a configuração registrada do projeto; confira compatibilidade antes de alterar versões.
