# Cadastro e abertura — 22/10/2026

## Atualização atual — perfil e biometria

- Ativação da conta neste aparelho agora tem duas opções visíveis e selecionáveis: “Criar uma conta com e-mail” e “Já tenho uma conta”. A primeira cria uma conta no BotecoRate e pede senha nova/confirmada; a segunda exige entrar na conta existente para vincular o UID autenticado. O texto esclarece que a senha é do BotecoRate, não da caixa de e-mail. Não há associação por coincidência de nome.
- Removido “Senha da conta Firebase” da interface. Campos de senha de ativação e de troca de senha são independentes, e salvar nome/reenvio de confirmação não apaga os rascunhos das outras seções. Alterar o modo de ativação limpa a senha daquele modo. Ações de saída avisam sobre dados não salvos antes de encerrar/bloquear.
- A causa do desaparecimento da biometria era a busca exclusiva de uma sessão Firebase persistida: a conta local não era candidata, e o logout remoto apagava a sessão necessária. A tela também verificava a candidata apenas na montagem.
- Após cadastro/login bem-sucedido, o app lembra **apenas o ID da última conta** em `app_settings.last_login_account`. Nenhuma senha é guardada para biometria e essa configuração não entra na fila de sincronização. Apenas uma conta fica selecionada por aparelho.
- “Bloquear app” no perfil volta ao login e preserva o acesso rápido. “Sair da conta” encerra a sessão de e-mail, quando houver, e esquece a candidata biométrica; a próxima entrada exige senha. Bloqueio é manual, não um bloqueio automático ao colocar o app em segundo plano.
- Login consulta a candidata toda vez que a tela recebe foco. O botão aparece somente com hardware disponível, biometria cadastrada e uma conta elegível. Contas locais anteriores ao ajuste precisam de uma entrada com senha para serem lembradas. Sessões remotas já persistidas na versão anterior são reconhecidas para compatibilidade.
- A confirmação do sistema é feita **dentro do serviço de autenticação**, antes de abrir a sessão, com fallback para senha do aparelho desabilitado. Conta local continua só consulta. Conta com e-mail exige que a sessão salva corresponda ao mesmo UID; online revalida situação e credencial, offline usa a autoridade já conhecida. A biometria não verifica e-mail nem concede papel. Cancelamento, troca de conta, conta inválida e falha biométrica não abrem sessão. No Android, sair da tela durante uma solicitação cancela o prompt.
- A tela oferece nova tentativa e entrada com senha em caso de falha. Não depende da API Flask nem acrescenta dependências.

Validação: `npm test` com 26 aprovados e 5 testes de regras pulados por falta de emulador nesse comando. Foram incluídos testes de bloqueio/desbloqueio local, cancelamento, falta de cadastro biométrico, alvo incorreto, troca de sessão, conta de e-mail salva, banimento online e distinção entre cadastro novo/vínculo existente. A biometria nativa e o Firebase são simulados nos testes: **é necessário validar o sensor no aparelho**. Bundles Android/iOS gerados.

Roteiro Android/Expo Go: cadastrar uma digital nas configurações do Android; entrar com senha; abrir Perfil → “Bloquear app”; selecionar “Entrar com biometria como …”; confirmar a digital; repetir cancelando; testar “Sair da conta” e conferir que senha volta a ser exigida. Repetir para conta local e conta com e-mail, incluindo reinício do app. Face ID no Expo Go para iOS tem limitação específica: [documentação SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/).

## Ajuste anterior — conta local proporcional ao Expo Go

O usuário confirmou funcionamento de cadastro, login e redefinição de senha por e-mail. No Android com Expo Go, cadastro local permanecia em “Protegendo sua senha” e login em “Aguarde”. Autorizou manter o Expo Go com proteção proporcional ao caráter acadêmico e ao acesso local de consulta.

- Novos cadastros, troca de senha local e migração de usuários do AsyncStorage usam PBKDF2-HMAC-SHA256 com **10.000 iterações**, salt aleatório de 16 bytes por senha e saída de 32 bytes. Nenhuma senha em texto puro é gravada no SQLite, fila ou histórico.
- Esse custo é uma concessão explícita para este protótipo, abaixo da recomendação de produção de PBKDF2. Não apresentar como equivalente a uma política forte de senhas de produção. A conta local continua apenas consulta, sem autorização Firebase. Quem extrair o banco pode tentar descobrir senhas; a pausa entre tentativas na interface não impede ataques sobre uma cópia extraída. Não reutilizar essa política em contas privilegiadas.
- Contas antigas mantêm o seu salt, hash e número de iterações até uma verificação correta. A primeira entrada antiga ainda pode demorar cerca de um minuto ou mais. A interface explica isso; após senha correta, um novo salt e o custo de 10.000 são gravados atomicamente, preservando o ID. Senha errada nunca migra a conta. Não existe conversão segura de um hash antigo para o novo custo sem conferir a senha.
- Cinco erros de login local impõem pausa de 30 segundos, persistida em `local_login_attempts`. Expiração permite tentar novamente e sucesso limpa os contadores. SQLite passou à versão **3** com essa tabela; migração é aditiva e preserva contas/catálogo.
- Login mostra a etapa atual e impede envios paralelos. Mudança de sessão durante a verificação impede que a conclusão tardia entre na conta anterior.
- Nenhuma biblioteca nativa ou dependência nova, APK próprio ou serviço remoto é necessário para o ajuste.

Medição local sem JIT: antes, 600.000 iterações levaram 62,335 s; com 10.000, três amostras levaram 1,171 s, 1,054 s e 1,200 s (média 1,142 s). Isso demonstra a redução no mesmo tipo de teste de interpretação, **não é uma medição de Hermes no aparelho Android**. Ainda validar no Expo Go: criar uma conta local nova, sair, entrar novamente, reiniciar o app, errar senha cinco vezes e aguardar a pausa; testar também uma conta antiga com a espera inicial única. Não apagar contas nem reinstalar o Expo Go para fazer o teste.

Testes automatizados cobrem consulta sem Firebase, armazenamento do verificador, migração somente após senha correta, preservação do ID, senha antiga de 600.000 iterações, pausa por erros e mudança de sessão durante verificação. A derivação antiga também é comparada ao `crypto.pbkdf2Sync` do Node. Os bundles Android/iOS são gerados para conferir integração; não comprovam navegação/desempenho físicos.

## Registro anterior — correções após teste do usuário

- Nesta cópia do projeto faltava `.env.local`. Restaurada a configuração pública fornecida pelo usuário e a URL RTDB anteriormente registrada em `IMPLEMENTACAO_ETAPA_1.md`. O arquivo permanece ignorado pelo Git; nenhum valor foi incluído nesta documentação. A URL da API Flask permanece vazia porque o servidor ainda não foi hospedado.
- Consultas somente de leitura retornaram HTTP 200 para configuração pública do Authentication e catálogo público. Isso confirma acesso à configuração, não cadastro de conta, envio de e-mail ou login no aparelho. Nenhuma conta foi criada pelo diagnóstico.
- O cadastro local antes exigia continuar na tela de sucesso e depois entrar com usuário/senha, calculando novamente o verificador. Agora cria a conta, abre sessão local e segue automaticamente para a lista. Permanece somente consulta; não recebe permissões de avaliação ou gestão.
- Bloqueados envios duplicados e saída durante criação; campos ficam bloqueados e teclado é fechado. Erros aparecem em alerta e no formulário. Exibidos indicador de andamento e aviso se a operação demorar. Duplicidade é checada antes de repetir o cálculo da senha, com nova checagem transacional para concorrência.
- Na correção anterior foi preservado PBKDF2-HMAC-SHA256 com 600.000 iterações. O custo foi revisto posteriormente na atualização descrita acima após novo relato no Android/Expo Go.
- A preparação dos dados ao iniciar continua necessária, especialmente na primeira abertura ou migração. A nova `TelaAbertura` mostra marca, indicador e mensagens simples. Detalhes técnicos ficam disponíveis apenas por ação explícita quando há erro, com tentativa novamente sem apagar dados.

## O que testar agora

| Fluxo | Comportamento esperado |
| --- | --- |
| Abertura | Tela da marca enquanto carrega; login em seguida; sem tela técnica sobre o banco |
| Criar conta neste aparelho | Nome e senha válidos; indicador; entrada automática na lista; persistência após reabrir |
| Login local | Usar a opção de conta local; nome e senha cadastrados; consulta de bares/endereços em cache |
| Cadastro com e-mail | Firebase configurado, internet e provedor E-mail/senha habilitado; envio de verificação; mensagem de sucesso |
| Conta não verificada | Perfil permite reenviar e-mail e atualizar verificação; ações de negócio bloqueadas |
| Conta verificada | Pode preparar avaliação em catálogo disponível; gestão exige papel de dono/admin e vínculo |
| Catálogo vazio | Estado vazio explicado; nenhum bar de demonstração recriado automaticamente |
| Sincronização/fotos entre aparelhos | Ainda depende de configurar/hospedar a API Flask e o bucket; somente SQLite local enquanto isso |

A carga dos quatro bares e a promoção dos administradores continuam sem execução. Painel administrativo, validação de donos, convites, transferências, custódia e Correios permanecem pendentes.

## Recarregar a configuração

Na raiz do app, ao lado de `package.json`:

```powershell
npm run check:firebase
npx expo start --clear
```

Recarregue o app pelo novo Metro/QR; se estiver usando binário com bundle embutido, gere uma versão com a configuração atualizada. O diagnóstico `node scripts/check-firebase.cjs --online` consulta apenas configuração e catálogo e não imprime os valores. O Expo substitui `EXPO_PUBLIC_*` no bundle; esses campos são configuração pública, nunca local para chave administrativa. Referências: [ambiente Expo](https://docs.expo.dev/guides/environment-variables/) e [configuração Firebase](https://firebase.google.com/docs/web/learn-more#config-object).

## Verificações

`npm test`: 18 testes aprovados, incluindo três novos cenários com serviço de autenticação local, SQLite e PBKDF2 reais: criação/sessão automática/login, duplicidade sem recalcular senha e rejeição de entradas inválidas sem escrita. Os cinco testes de regras são pulados nesse comando sem emulador; sua última execução específica está documentada na etapa de sincronização. Gerados bundles Android e iOS com as variáveis cliente carregadas. A navegação e a duração no celular ainda precisam de teste físico.
