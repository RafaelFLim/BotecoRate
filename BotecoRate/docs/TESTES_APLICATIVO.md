# Cadastro e abertura — 22/10/2026

## Atualização atual — perfil por ações e senha visível sob comando

- Todos os campos de senha de entrada, cadastro, troca e vínculo oferecem “Mostrar”/“Ocultar”, com rótulo acessível por campo. Começam ocultos; limpar o campo restaura esse estado. A opção altera apenas a exibição, sem guardar a senha ou alterar sua proteção no banco.
- O perfil autenticado passa a ser um menu de cartões, com identificação da conta e atalhos para “Meus dados”, “Trocar senha” e “Acesso e segurança”. Cada ação abre sua própria tela; os formulários deixam de disputar espaço na página principal.
- Conta local também oferece “Usar uma conta com e-mail”: primeiro escolhe criar ou entrar em uma conta existente, depois preenche somente o formulário correspondente. Conclusão oferece retorno ao perfil já atualizado como conta com e-mail. O vínculo continua exigindo autenticação do destinatário.
- Conta com e-mail mostra “Confirmar meu e-mail” enquanto não confirmada, com reenvio e atualização da situação separados das demais ações. Alterar nome continua exigindo confirmação para contas online.
- Troca de senha pede senha atual, nova senha e confirmação. Rascunhos avisam antes de voltar; durante gravação a saída é bloqueada. Ao salvar a senha, os três campos são limpos.
- “Acesso e segurança” reúne a disponibilidade de biometria, “Bloquear app” quando elegível e “Sair da conta”. Bloqueio/saída retornam aos bares como visitante; a distinção entre preservar e esquecer o acesso rápido permanece.

Validação desta atualização: `npm test` — 26 aprovados, 5 testes de regras pulados por falta de emulador. Bundles Android/iOS gerados em `dist/validacao-perfil-opcoes`; esses testes não substituem a interação física.

Roteiro Android/Expo Go:

1. Em login e cadastro de ambos os tipos, digitar senha → Mostrar → Ocultar; conferir manutenção do texto e funcionamento independente da confirmação. Limpar o campo e conferir que volta oculto. Conferir teclado e foco no aparelho.
2. Entrar na conta local → Perfil → conferir cartões sem formulários → editar nome → salvar e voltar. Abrir troca de senha, testar confirmação diferente e alteração correta; sair e entrar com a nova senha.
3. Digitar alterações e usar Voltar/gesto de retorno: conferir aviso e opções de continuar ou descartar. Tentar sair durante uma gravação: conferir bloqueio temporário.
4. Na conta local, abrir vínculo → escolher cadastro novo ou conta existente → conferir campos próprios e Mostrar/Ocultar. Concluir o vínculo e voltar ao perfil, agora com opções da conta com e-mail.
5. Repetir dados/senha com conta com e-mail; testar reenvio e atualização de confirmação quando pendente. Conta já confirmada não deve mostrar o cartão de confirmação.
6. Abrir Acesso e segurança → bloquear → bares como visitante → Perfil → tipo da conta → biometria. Repetir usando Sair e conferir que a próxima entrada exige senha.

Os passos de interface, sensor e teclado permanecem pendentes de validação no aparelho físico.

## Ajuste anterior — bares primeiro e contas separadas

- O app inicia na lista de bares como visitante. A preparação inicial do SQLite permanece, mas a primeira tela de conteúdo é `Lista`, não o formulário de entrada. O início limpa a sessão visível antes de carregar o catálogo, sem enviar a fila de outra conta.
- O ícone de perfil sempre abre `Perfil`: sem login mostra “Como você quer entrar?” com “Conta local” e “Conta com e-mail”; com login mostra o gerenciamento da conta atual.
- `ContaLocal` oferece entrada por usuário/senha, cadastro local e biometria somente da conta local lembrada. `ContaEmail` oferece e-mail/senha, cadastro online, recuperação e biometria somente da sessão de e-mail lembrada. Não existe mais um botão que altera o tipo do formulário.
- Cadastros também são rotas separadas (`CadastroLocal`/`CadastroEmail`); o tipo vem da rota escolhida, sem alternância no meio do preenchimento. A criação online continua exigindo confirmação de e-mail para participar.
- Voltar permite retornar da entrada para a escolha de conta e então aos bares. Login/cadastro concluídos voltam à lista. Bloquear ou sair também volta à lista como visitante; o perfil volta a exibir a escolha de contas.
- “Sem conta logada” é a sessão visível/de negócio: credenciais de e-mail já persistidas pelo SDK podem continuar disponíveis para uma futura confirmação biométrica, sem entrada automática. Nenhuma senha é guardada por esse fluxo. “Sair da conta” continua encerrando a sessão remota e esquecendo a candidata; “Bloquear app” mantém o acesso rápido dentro da opção de conta correspondente.

Roteiro de validação Android/Expo Go: reabrir o app após uma sessão anterior → conferir lista sem nome/avatar de usuário → perfil → conta local → conferir ausência de campo de e-mail/recuperação → voltar e escolher conta com e-mail → conferir recuperação e cadastro online → criar/entrar → conferir perfil da conta autenticada → bloquear/sair e conferir retorno aos bares como visitante. Repetir com a biometria dentro de cada tipo de conta. Os testes confirmam que lembrar uma sessão/candidata não publica uma sessão ativa; a navegação física ainda precisa ser conferida no aparelho.

## Ajuste anterior — perfil e biometria

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
| Abertura | Tela da marca enquanto carrega; lista de bares como visitante em seguida; sem tela técnica sobre o banco |
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


## Painel administrativo — roteiro físico (22/10/2026)

Usar contas de teste, nunca banir/excluir os administradores reais para experimentar. Entrar com admin verificado e abrir Minha conta → Painel administrativo. Confirmar busca por nome/e-mail/UID, proteção do próprio acesso e obrigatoriedade do motivo. Em conta de teste, mudar comum/dono/admin, banir e restaurar. Manter essa conta em outro celular online e conferir a perda da sessão/biometria após banir; após restaurar, entrar novamente.

Publicar avaliação com outra conta, sincronizar os dois aparelhos e ocultá-la pelo painel. Conferir retirada da lista/ranking e manutenção do texto original no banco. Alterar outro item do bar e confirmar que isso não apaga a opinião oculta. Restaurar a avaliação. Mover para a lixeira, conferir data limite de 30 dias e restauração somente administrativa.

Abrir Histórico geral e o histórico de um registro. Buscar responsável, registro, data ISO e justificativa; comparar campos antigos/novos. No inspetor SQLite, executar as consultas de `HISTORICOS.md`. Desligar a internet e verificar que o painel recusa administrar; reconectar e atualizar. Testar gesto nativo de voltar nos dois níveis do painel e nas telas anteriores.

Os testes automatizados não substituem este roteiro físico Android/iOS. O expurgo automático da lixeira geral ainda não está ativo e não deve ser declarado testado.


## Copropriedade e transferência — roteiro físico

1. Usar contas de teste verificadas e um bar de teste. Compartilhar UID pelo texto selecionável no menu Propriedade e convites. Conferir que uma conta comum vê convites, mas não administra o bar antes da conclusão.
2. Dono A envia convite para B; ambos aceitam, inclusive A. Conferir os dois donos após concluir. Adicionar C somente após aceites de A, B e C, em ordem diferente entre aparelhos.
3. Escolher B como substituído por D. Exigir A, B, C e D; antes do último aceite nada muda. Depois, somente B sai, A/C permanecem e D entra. B não altera mais o bar; `criado_por` não muda.
4. Conferir recusa, cancelamento, histórico geral/por convite, busca por pessoa/data/bar e view SQL `vw_historico_propriedade`. Votar duas vezes não deve duplicar eventos. Voltar por gesto/botão deve retornar de detalhe/formulário; formulário preenchido pede descarte.
5. Abrir duas solicitações para o mesmo bar; concluir uma e conferir invalidação da outra. Alterar acesso de conta de teste pelo painel e conferir que todas as solicitações pendentes anteriores precisam ser refeitas. Não banir administradores reais para testar.
6. Desconectar após carregar os dados: ler a última consulta, sem aceitar/enviar. Reconectar, atualizar e conferir recuperação após uma resposta já registrada. Outra conta não deve receber o cache da anterior.
7. Publicar avaliação antes de tornar seu autor dono. Após concluir vínculo, manter a avaliação visível com aviso e fora da média/ranking; após sair da propriedade, continuar fora. Salvar outra alteração do catálogo não pode enfileirar uma edição fictícia da avaliação.

Compilações/testes automatizados não substituem esse teste físico Android/iOS. Não foram criadas transferências reais para validar a integração.
