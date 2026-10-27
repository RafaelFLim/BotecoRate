# Plano de evolução e registro de mudanças

### 27/10/2026 — fechamento da frente de Emanuel

- Implementações previstas desta frente concluídas: gestão/ranking e ViaCEP já existentes, fotos JPEG Base64 no RTDB acrescentadas hoje sem faturamento, e cenários disponíveis de integração validados em dois Android por relato do usuário. Não desenvolver outras frentes do colaborador.
- Consolidados docs atuais para remover pendências de publicação/fotos/CEP já resolvidas, preservando histórico das etapas anteriores. Permanecem ressalvas físicas para conta comum/dono sem vínculo, iOS e itens específicos indicados na matriz. Galeria e puxar para atualizar continuam adiados.
- Evidência técnica desta entrega: 88 testes aprovados com emulador, dependências compatíveis e exportações Android/iOS concluídas. Revisão final apenas documental, sem repetir testes após ausência de mudanças funcionais. Mensagem de commit preparada; nenhum commit/push executado pelo agente.

### 27/10/2026 — consolidação dos testes nos dois Android

- Usuário aprovou fotos bar/item, recebimento/persistência, atualização manual, offline/segundo plano, troca Firebase/local com fila, conflito/convergência, edição/exclusão, CEP, visitante/local, câmera e botão/gesto Voltar com proteção de rascunho. Documentação consolidada sem nova alteração funcional.
- Teste físico com conta comum/dono sem vínculo e iOS permanecem pendentes de ambiente/conta adequada; histórico da exclusão e limpeza final da fila após conflito não foram confirmados separadamente. Galeria e puxar para atualizar adiados explicitamente. Matriz em `TESTES_INTEGRADOS_2_CELULARES.md`. Nenhum commit/push executado.

### 27/10/2026 — testes físicos de isolamento, CEP e exclusão

- Usuário confirmou que uma edição pendente só chegou a B após retornar à conta original, depois de trocar para conta local. CEP normal, CEP geral 27700-000 e preenchimento manual sem rede também aprovados por relato.
- Exclusão de bar descartável propagou para os dois Android e permaneceu após reabrir B. Histórico não inspecionado manualmente. Matriz e pendências em `TESTES_INTEGRADOS_2_CELULARES.md`; nenhuma alteração funcional ou de papéis nesta rodada.

### 27/10/2026 — teste físico de conflito e convergência

- Usuário confirmou conflito em B, preservação da proposta local, manutenção de “Teste A” em A e convergência de B para “Teste A” após usar servidor. Cenário registrado em `TESTES_INTEGRADOS_2_CELULARES.md`; ausência de pendências após resolução não confirmada explicitamente.
- Nenhum código ou permissão alterados durante a orientação. Próximo teste: gesto Voltar Android e proteção de rascunhos.

### 27/10/2026 — início dos testes integrados da frente de Emanuel

- Usuário confirmou atualização manual funcionando. Escolha de foto da galeria foi sugerida e adiada, junto da proposta de puxar para atualizar. Nenhuma dessas funcionalidades foi implementada.
- Preparado roteiro incremental `TESTES_INTEGRADOS_2_CELULARES.md`: dois Android e duas contas admin/donas confirmados. Fotos de bar offline/recebimento e atualização manual aprovados por relato; próximos casos são foto de item e persistência. Conta comum adicional é necessária para certas negativas; iOS não coberto. Não alterar papéis/banimentos/transferências/custódia da frente do colaborador.

### 27/10/2026 — confirmação das fotos entre dois celulares

- Usuário confirmou publicação das regras, edição offline com nova foto, atualização de updated_at em v1/direct/entities após reconexão e exibição correta da foto do bar no segundo celular. Caminho antigo v1/sync esclarecido como legado.
- Identificada dificuldade para encontrar atualização manual: status da lista já é clicável, mas não é claro; sincronização automática ocorre em intervalo de 30 segundos, recuperação de rede e retorno ao primeiro plano. Registrada proposta posterior de puxar para atualizar e botão explícito, sem implementação nesta verificação. Testes de fotos de itens/troca de conta/demais cenários seguem pendentes.

### 27/10/2026 — fotos Base64 sem conta de faturamento

- Usuário confirmou manter ausência de faturamento e usar Base64. Adaptado fluxo de fotos para JPEG reduzido no RTDB em vez de Storage, preservando arquivos locais/URLs antigas/fila por conta. ImageManipulator compatível com SDK 58 instalado; sem migração SQLite ou mudança de regras de administração/propriedade.
- Limites de 160 KiB por data URI e 8 MiB por envio completo, reaproveitamento de wire_payload e descarte por troca de sessão. Gerador/regras alteram somente validações foto de bares/itens. Publicação remota ainda pendente; usuário foi orientado sobre configuração firebase.json versus credencial administrativa e alternativa pelo console.
- Suíte completa no emulador: 88 aprovados, nenhum pulado; teste de fotos em duas réplicas SQLite, histórico, leitura pública e rejeições. Bundles Android/iOS aprovados; compressão/renderização e sincronização em aparelhos físicos ainda exigem confirmação. Roteiro e trecho de regras em `FOTOS_BASE64.md`.

### 26/10/2026 — ícone no carregamento do Expo Go 58

- Captura do usuário confirmou ausência do ícone após migração. Reproduzida diferença de manifesto com Forwarded: iconUrl relativa, incompatível com uso direto pelo carregador Android consultado. Assets/configuração originais preservados.
- Workaround local versionado para CLI 58.1.15 no postinstall, com backup e verificação de trecho/idempotência; somente iconUrl passa a absoluta. Quatro cenários de manifesto HTTP/HTTPS aprovados e imagem local conferida por bytes/HTTP 200. Servidor temporário encerrado.
- Usuário confirmou em 26/10/2026 que o ícone voltou após a correção/reinício no Expo Go Android. Demais testes físicos continuam pendentes. Detalhes em `ATUALIZACAO_DEPENDENCIAS.md`; nenhum commit/push executado.

### 26/10/2026 — atualização para Expo SDK 58

- A pedido do usuário após atualizar Expo Go, migrados Expo para 58.0.19, React para 19.3.0, React Native para 0.88.0 e módulos compatíveis indicados pelo Expo. Preservadas alterações locais do ViaCEP e funcionalidades do grupo.
- Conferido o inspetor SQLite 58.0.14 e estendido o workaround por versão, com backup e verificações de trechos/idempotência. Nenhuma alteração em dados, esquema ou Firebase.
- Expo Doctor 20/20, dependências compatíveis, 55 testes aprovados/23 de emulador pulados e exportações Android/iOS aprovadas. Auditoria npm reporta 12 alertas remanescentes; teste físico pendente. Versões e roteiro em `ATUALIZACAO_DEPENDENCIAS.md`.

### 26/10/2026 — integração do remoto com ViaCEP local

- Pull interrompido por documentos locais: alterações do ViaCEP preservadas em stash com arquivos novos, avanço simples de `87f90e5` para `ce815a2` e reaplicação sem descartar os commits de administração/copropriedade. Cópia de segurança mantida.
- Três conflitos documentais conciliados, mantendo os novos fluxos e a consulta de CEP. Nenhum conflito de código; nenhum commit/push executado.
- Após integração, `npm test`: 55 aprovados e 23 cenários dependentes de emulador pulados. Teste físico continua pendente.

### 26/10/2026 — consulta de CEP por ViaCEP

- Usuário autorizou substituir Correios por ViaCEP; mantido escopo CEP → endereço com alternativa manual. Consulta pública direta do aplicativo, sem token, Flask, novas dependências ou alteração no protocolo Firebase.
- Cadastro/edição compartilham consulta com prévia e aplicação explícita, timeout e descarte de resposta antiga. Número/complemento continuam no endereço editável; somente o texto final é persistido/sincronizado.
- GPS passou a ser opcional no cadastro, para coordenadas somente; endereço pode ser preenchido sem permissão. Alterar endereço limpa posição anterior e a espera de GPS pode ser dispensada.
- Validação: 44 testes aprovados, 10 de emulador pulados; consulta real do CEP 01001-000 validada e bundles Android/iOS gerados. Roteiro físico e limites em `INTEGRACAO_CEP.md`. Fotos e demais etapas não iniciadas nesta rodada.

### 23/10/2026 — integração da gestão de bares com administração e copropriedade

- Trabalho local preservado no commit `3afaced`; integrada a atualização remota `87f90e5` com resolução dos seis conflitos. Mantidas a tela Gerenciar bar, edição/exclusão, validações e mapa do grupo, junto com painel administrativo, revogação de acesso, convites e históricos.
- Avisos e médias usam o filtro compartilhado de ranking, preservando a explicação de vínculo anterior. A decisão vigente é exclusão permanente das avaliações de quem foi dono, sem reabilitação após saída. Documentos de gestão/testes foram conciliados com sincronização direta SQLite/Firebase e Storage ainda pendente de configuração.
- Verificação: 49 testes locais aprovados (23 dependentes de emulador pulados nessa execução), incluindo sete testes de gestão e a regressão conjunta de edição, moderação oculta e inelegibilidade de ex-dono. Suíte direta Firebase: 30 aprovados no emulador. Python: 16 aprovados na suíte comum e os três de integração aprovados separadamente no emulador. Exportações Android e iOS aprovadas em `.tools/export-merge-final`.
- Não foi necessário alterar esquema SQLite, dependências ou regras publicadas. Testes físicos permanecem pendentes. Push reservado ao usuário.

### 23/10/2026 — conclusão da etapa de copropriedade

- Conferência final aprovada: 41 testes locais (23 dependentes do emulador pulados nessa execução), 30 testes na suíte específica do Firebase Emulator e 14 testes Python (2 de emulador pulados). Exportações Android e iOS aprovadas. Scanner aprovado em 113 arquivos de texto rastreáveis, sem padrões de credenciais privadas detectados; diff sem erros de whitespace.
- Regras de propriedade já publicadas e comparadas com o código local; conferência somente de leitura confirmou os índices dos quatro bares e três perfis de convite. Donos, autoridade e conteúdo reais preservados. Nenhuma transferência real usada nos testes.
- Banco/documentação atualizados; nomes, respostas e valores antes/depois disponíveis no histórico próprio, administrativo e na view SQLite. Identificação de solicitações usa bar + ID, inclusive na navegação e no histórico contextual.
- Teste físico de telas, gestos e fluxo entre celulares permanece pendente, com roteiro em `TESTES_APLICATIVO.md`. Nenhum commit/push executado; alterações da etapa administrativa anterior e `.gitignore` da raiz foram preservadas.


### 22/10/2026 — copropriedade, transferência e aceites de todos os envolvidos

- Acrescentada tela Propriedade e convites: UID compartilhável, confirmação do convidado, inclusão de coproprietário, escolha de quem será substituído, aceites em qualquer ordem, recusa/cancelamento e histórico próprio/contextual pesquisável. Não há bypass administrativo. Convite pendente não concede acesso.
- Regras impõem assinatura individual imutável, revisão/CAS, conferência da unanimidade e conclusão atômica com propriedade/promoção de comum para dono. Termos não podem mudar após o envio. Criação histórica do bar é preservada; dono removido perde a capacidade de alteração. Alteração de donos ou de acesso invalida solicitações anteriores; a invalidação por acesso é global e conservadora, documentada.
- SQLite versão 5 aditiva: solicitações, votos com FK composta, histórico durável, exclusão permanente do ranking e view legível. Consulta offline por conta, ações online. Gesto/botão voltar protege o formulário não enviado e retorna ao nível anterior.
- Decisão do usuário: avaliações anteriores continuam fora do ranking mesmo depois da saída da propriedade, com aviso visível e sem reescrever a opinião. Leitura do catálogo e gravação preservam o valor original para não gerar alterações fictícias na fila.
- Ferramenta administrativa local prepara índices/perfis mínimos para bares antigos sem transferir propriedade; promoção administrativa da ferramenta também passa a preservar auditoria/versionamento e invalidar aceites anteriores. Fluxo do app segue SDK Firebase direto.


### 22/10/2026 — painel administrativo, histórico legível e política de lixeira

- Implementados menu administrativo, busca de usuários/avaliações, alteração de papel, banimento/restauração e exclusão lógica administrativa. Moderação separada do conteúdo original, sempre com justificativa e histórico antes/depois. Sem credenciais administrativas no cliente.
- Regras RTDB validam autoridade atual, e-mail verificado, versões, auditoria atômica e proteção do próprio admin. Diretório privado separado do catálogo; projeção criada no login/cadastro e ferramenta de importação de contas antigas. Sessões recebem revogação/alteração de papel conectadas.
- SQLite versão 4 aditiva, moderação sincronizada, preservação de opiniões ocultas durante gravação do catálogo, índices e três views de histórico legível. Painel apresenta histórico geral e contextual com busca e valores anteriores/novos.
- Confirmado novo pilar: históricos fáceis de localizar/ler. Confirmada lixeira para todos os objetos excluíveis, restauração ou hard delete manual, expurgo após 30 dias e auditoria mínima sem conteúdo. Casos administrativos já recebem prazo/restauração; lixeira geral, cascatas e executor de expurgo ainda pendentes. Ver `LIXEIRA_E_RETENCAO.md`.
- Verificação final: 37 testes locais aprovados (16 dependentes do emulador pulados nessa execução); suíte direta com 21 testes aprovados no emulador; ferramentas Python com 11 aprovados e 2 específicos de emulador pulados. Exportações Android/iOS e scanner de segredos aprovados. Regras finais publicadas e relidas; três identidades importadas para o diretório; permissões e catálogo reais comparados com o backup e preservados. Teste físico do painel permanece pendente.
- Incluída a alteração pendente do `.gitignore` da raiz no conjunto deste trabalho, conforme solicitado; nenhum commit/push executado.

### 22/10/2026 — gestão de bares e dependências das próximas entregas

- Adicionada tela de gerenciamento para donos vinculados/admins, com edição de dados/foto/posição, exclusão lógica confirmada e proteção contra formulário desatualizado, troca de conta e perda de permissão.
- Exclusão conserva histórico e retira bar/filhos da exibição; mapa acompanha mudanças do catálogo. Regras locais validam campos obrigatórios e impedem mudar vínculos pelo catálogo.
- Ranking exclui donos atuais na apresentação. Servidor reconcilia inelegibilidade em bar/itens com versão e auditoria; rascunho offline não reabilita opinião invalidada. Usuário confirmou manutenção da inelegibilidade após fim do vínculo permanentemente.
- Registro da entrega original: os fluxos de propriedade e a migração para sincronização direta foram integrados posteriormente; consultar a atualização de 23/10 e os documentos atuais. Correios, configuração de fotos e testes físicos continuam pendentes.
- Validação: 33 testes JavaScript/SQLite e 15 testes do servidor aprovados (incluindo 3 com RTDB local), bundles Android/iOS gerados. Cinco testes de regras pulados no comando comum. Roteiro físico em `GESTAO_BARES.md`; nenhuma alteração implantada em produção.

### 22/10/2026 — proteção do conteúdo antes do commit

- Reforçado ignore na raiz para ambientes reais, contas de serviço, chaves privadas, bancos/sidecars SQLite e pastas locais, mantendo exemplos e esquemas versionáveis.
- Configuração local já rastreada do assistente removida somente do índice, sem apagar o arquivo. Acrescentado `check:secrets`, com modo de inspeção do staging e relatório sem valores sensíveis. Nenhum commit/push executado.
- Validados 19 casos de ignore e preservação de arquivos necessários; procedimento em `SEGURANCA_DO_VERSIONAMENTO.md`.

### 22/10/2026 — integração do trabalho do grupo

- Pull anterior abortava por alterações locais nos dois documentos de índice/plano. Preservado todo o trabalho local em stash de segurança, aplicado fast-forward de `0415c2f` para `97d92db` e reaplicadas as alterações locais.
- Resolvidos os dois conflitos de documentação mantendo tanto o novo fluxo de contas/perfil do colega quanto a sincronização direta e correções do inspetor. Nenhum código do colega foi descartado. Stash de segurança mantido; alterações locais continuam sem commit e sem push.
- Suite após integração: 31 testes aprovados e 10 específicos de emulador pulados. Compilação Android/iOS conferida separadamente. Banco e configuração Firebase não foram modificados nesta integração.

### 22/10/2026 — perfil autenticado organizado e controle de exibição da senha

- Campos de senha passam a oferecer Mostrar/Ocultar, inicialmente ocultos e com controle independente por campo; não muda armazenamento nem autenticação.
- Perfil logado torna-se menu de ações para dados, senha e acesso/segurança. Conta local tem escolha de cadastro/vínculo com e-mail em telas próprias; conta online pendente tem confirmação de e-mail separada.
- Preservadas biometria, saída, restrições de conta e proteção de rascunhos. Troca de senha inclui confirmação. Documentação e roteiro físico atualizados em `TESTES_APLICATIVO.md`.
- `npm test`: 26 aprovados, 5 testes de regras dependentes de emulador pulados; bundles Android/iOS gerados. Sensor, teclado e navegação física ainda precisam de validação Android/Expo Go.

### 22/10/2026 — início na lista e entrada por tipo de conta

- Lista de bares passa a ser a primeira tela de conteúdo, sem sessão ativa. Perfil do visitante oferece conta local e conta com e-mail em caminhos separados, com cadastros próprios.
- Recuperação fica na entrada por e-mail; biometria aparece apenas no tipo de conta correspondente. Bloqueio/saída retornam aos bares como visitante; não há autenticação automática ao abrir o app.
- Sessão de e-mail persistida pode ser reutilizada somente após ação explícita de entrada/biometria. Roteiro e limites em `TESTES_APLICATIVO.md`.
### 22/10/2026 — oscilação do visualizador SQLite

- Observadas 5.947 consultas SQL em 18 segundos, originadas pela interface web do inspetor 57.0.4. Confirmado callback instável reiniciando efeito de carga após atualização do estado do pai.
- Criado patch local reproduzível e idempotente pelo postinstall, com verificação de versão/trechos e backup do bundle. Banco e fluxo de sincronização preservados. Detalhes em `INSPETOR_SQLITE.md`.
- Usuário confirmou que a oscilação parou e consegue consultar a tabela após recarregar o visualizador. Validação visual concluída.

### 22/10/2026 — falha de inicialização e timeout do inspetor

- Pilha enviada pelo usuário simbolicada pelo Metro: erro em `firebaseConfig.js` ao chamar funções de configuração de retry inexistentes no SDK Storage. Corrigido para atribuição das propriedades da instância.
- Dois testes novos executam configuração com Storage SDK real e dados fictícios, sem chamadas remotas, com/sem bucket. Arquivos e dados locais/remotos preservados. Abertura física e resposta do inspetor dependem de recarregar o aparelho para confirmar.
- Após RELOAD, usuário confirmou abertura normal. Diagnóstico read-only no canal real do inspetor encontrou `botecorate.db` e suas 20 tabelas; comunicação restabelecida. Suite local: 31 aprovados e 10 cenários específicos de emulador pulados.

### 22/10/2026 — sincronização direta conforme referência do professor

- Após autorização, substituída comunicação de sincronização por `get`/`update` do SDK Firebase; removida dependência runtime de API Flask. SQLite, fila por conta, conflitos, histórico e exclusão lógica preservados.
- Regras testadas no emulador para permissão, versão, autoria, histórico, unicidade e três itens. Migração aditiva dos quatro bares para `v1/direct` e publicação realizadas após backup. Origem e administradores preservados.
- Preparado upload direto Storage, sem habilitar produto/plano. Bucket real ainda inexistente; fotos novas aguardam configuração. Nenhuma dependência instalada/atualizada.
- Detalhes e verificações em `SINCRONIZACAO_DIRETA.md`. Não foi criada tela de banco nem corrigido o inspetor nesta etapa.

### 22/10/2026 — configuração inicial no Firebase real

- UIDs fornecidos pelo usuário conferidos no Authentication: Rafael e Emanuel ativos e com e-mail verificado. Promovidos a administradores com auditoria.
- Importados 4 bares, 12 itens e 18 avaliações de demonstração inelegíveis para ranking, com migração idempotente. Confirmada leitura pública dos quatro bares por HTTP 200.
- Credencial utilizada fora do repositório; nenhuma regra alterada. API/Storage e testes integrados permanecem pendentes. Detalhes em `CONFIGURACAO_FIREBASE_REAL.md`.

### 22/10/2026 — ativação mais clara e retorno da biometria

- Perfil separa “Criar uma conta com e-mail” e “Já tenho uma conta”; remove termo Firebase dos textos visíveis e separa senhas de ativação/troca.
- Biometria inclui conta local e sessão de e-mail correspondente. “Bloquear app” preserva acesso rápido; “Sair da conta” encerra a sessão e exige senha. Lembra apenas ID, sem guardar senha, e valida o resultado do sistema dentro do serviço.
- Cancelamento, troca de conta e banimento online cobertos por testes. Sensor Android/Expo Go e navegação física ainda precisam de validação; roteiro em `TESTES_APLICATIVO.md`.

### 22/10/2026 — conta local compatível com Expo Go, ajuste autorizado

- Usuário confirmou cadastro/login/recuperação por e-mail e relatou espera prolongada nos fluxos locais em Android/Expo Go. Autorizou proteção proporcional ao protótipo de consulta.
- Custo PBKDF2 local passou a 10.000 iterações, mantendo salt aleatório; contas antigas só mudam após senha correta, com ID preservado. Migração SQLite v3 aditiva para pausa de 30 segundos após cinco erros.
- Teste sem JIT: 62,335 s com custo antigo; média 1,142 s no novo (três amostras). Não é medição no aparelho. Roteiro e limitação de segurança documentados em `TESTES_APLICATIVO.md`.

### 22/10/2026 — correções após teste de cadastro e abertura

- Restaurada configuração cliente local fornecida pelo usuário; consultas públicas Authentication/RTDB retornaram HTTP 200. Nenhum cadastro remoto automático ou escrita de negócio.
- Cadastro local passa a abrir sessão e navegar após salvar, com erros visíveis, proteção contra envio/saída durante criação e andamento explícito. Mantida derivação de senha com 600.000 iterações.
- Nova abertura com identidade do app e detalhes técnicos opcionais em caso de falha. Três novos testes de autenticação local aprovados; limitações e roteiro em [Testes no aplicativo](TESTES_APLICATIVO.md).

### 22/10/2026 — servidor e sincronização, implementação local

- Adicionados Flask/Admin SDK, comandos atômicos, autorização remota, idempotência, versões, tombstones, snapshot, eventos sequenciais e upload de fotos validado para bucket privado.
- SQLite v2 separa réplica confirmada e intenções por conta; migração conserva fila antiga em revisão. App envia/recebe lotes e oferece revisão de conflitos com escolha explícita do servidor.
- Adaptada a carga preparada dos quatro bares para o catálogo completo. Nenhuma carga, promoção ou implantação em produção foi executada.
- Configuração, protocolo, testes e limitações em [Servidor e sincronização](SERVIDOR_E_SINCRONIZACAO.md). Administração, propriedade/custódia, Correios e aparelhos físicos continuam pendentes.

### 22/10/2026 — túnel para testes externos

- Diagnosticado `ERR_NGROK_108` na conta compartilhada do Expo, mascarado pelo erro de `body`.
- Adicionado `npm run start:tunnel` com Cloudflare portátil, checksum verificado e QR HTTPS para Expo Go. Ferramenta local ignorada pelo Git.
- Verificados manifestos públicos Android/iOS e entrega do pacote Android pelo túnel. Falta validação do QR no aparelho físico. Procedimento em `TUNEL_TESTES.md`.
- Nenhuma alteração funcional no app ou Firebase nesta correção.

Data: 22/10/2026. Situação: primeira etapa implementada localmente; ver `IMPLEMENTACAO_ETAPA_1.md`. Sincronização completa e administração permanecem em implementação futura.

> Após o usuário confirmar os testes e autorizar o início, foram implementadas as bases SQLite/autenticação/navegação. Não houve implantação em Firebase. Ver [Etapa 1](IMPLEMENTACAO_ETAPA_1.md).

## Sequência proposta

Todas as etapas seguem a organização e as configurações compatíveis descritas em [Referências do professor](REFERENCIAS_PROFESSOR.md), com o app combinado de 2026 como base. As fronteiras de escrita remota/servidor precisam ser fechadas antes da implementação da sincronização.

1. Fechar validação de donos, ativação da conta local, sessão previamente autenticada offline, destino dos dados legados, Correios e demais pendências em `LEVANTAMENTO_V2.md`. Transferência por substituição com unanimidade já definida.
2. Conferir configuração do projeto Firebase: URL real do Realtime Database, Authentication por e-mail/senha, região, regras, armazenamento e ambiente de execução do servidor. O link do console informado não comprova que esses serviços já foram habilitados. Não foi acessada a conta do console nesta etapa.
3. Criar ambiente de desenvolvimento/emuladores, regras restritivas e contratos de comandos/respostas. Definir custos/configuração antes de implantar serviços.
4. Produzir DDL SQLite e migrações, repositórios e testes de integridade. Detalhar fronteiras transacionais remotas e protocolo de sincronização antes de codificar o worker.
5. Implementar conta local offline de consulta, com verificador de senha derivado e sem texto puro; integrar ativação via Authentication, perfil editável, isolamento por conta e bootstrap auditado dos admins Rafael e Emanuel. Não guardar credenciais Firebase no banco de negócio.
6. Implementar validação de dono e painel administrativo; permissões verificadas no servidor, com fluxo de banimento/exclusão e reconciliação com Authentication.
7. Migrar bares/cardápios/avaliações para serviços de domínio e SQLite; implementar coproprietários, convites, transferências, históricos e exclusão lógica.
8. Implementar sincronização bidirecional, fotos persistentes, idempotência, conflitos, retomada e status visível.
9. Integrar endereços pelo endpoint confirmado, cache permitido e fallback manual, com coordenadas independentes e verificadas.
10. Importar os bares existentes uma única vez no banco, validar a carga e retirar `mockBares.js` e todas as referências/fallbacks das telas. Não remover antes de a leitura pelo banco estar funcional.
11. Validar os fluxos integrados em dois dispositivos, offline/online e emuladores. Atualizar regras de negócio, dicionário de dados, configuração e guia de execução com o comportamento efetivamente entregue.

## Critérios de aceite principais

- Alteração de nome não perde autoria/propriedade; e-mail/senha tratados pelo Authentication.
- Usuário comum não publica bar; dono altera somente bares vinculados; admin altera qualquer bar.
- Nenhum dono ativo avalia seu próprio estabelecimento ou seus itens.
- Transferência substitui o dono selecionado e preserva os outros; só conclui após aceite de todos os donos atuais e do destinatário, com validação atômica. Mudança de propriedade invalida votos anteriores.
- Conta criada offline persiste no aparelho, mas só consulta bares e endereços; desbloqueio local não concede permissões Firebase. Ativação exige autenticação online comprovada, sem vincular contas por coincidência de nome/e-mail.
- Operação repetida não duplica dados/históricos; operação antiga não ressuscita excluídos.
- Papel local adulterado não concede permissão remota; banimento bloqueia novos comandos.
- Rascunhos offline sobrevivem ao reinício; troca de conta não vaza cache/documentos nem envia fila alheia.
- Histórico confirmado é imutável e não contém senhas ou comprovantes públicos.
- Aplicativo funciona com base vazia sem recriar demonstrações.

## Registro de mudanças

### 22/10/2026 — confirmação das regras e diagnóstico da conexão real

- Chave corrigida com valor exato fornecido em texto: configuração pública Authentication e catálogo retornaram HTTP 200. Próximo passo é testar cadastro/login/verificação no aplicativo; nenhuma conta foi criada automaticamente.
- Usuário confirmou publicação das regras e ativação de E-mail/senha.
- Leituras reais confirmaram catálogo público acessível e autoridade protegida sem login.
- Authentication recusou a chave cliente transcrita da imagem; solicitado valor exato em texto antes do teste de cadastro/login. Nenhuma conta criada ou escrita remota executada pelo diagnóstico.

### 22/10/2026 — início autorizado da implementação

- Adicionadas bibliotecas compatíveis para SQLite, conectividade, autenticação, credenciais locais, fotos e navegação nativa.
- Implementados esquema local, migração do AsyncStorage, históricos, exclusão lógica e fila transacional; senhas antigas convertidas em verificadores locais.
- Adaptados login/cadastro/perfil e rotas nativas. Câmera/biometria preservadas; mapa usa a nova origem de dados.
- Seed saiu do app e passou a artefato administrativo. Preparadas configuração Firebase, regras restritivas e ferramenta de bootstrap/carga, sem execução remota.
- Oito testes SQLite/negócio/hash aprovados; bundles Android/iOS e Expo Doctor 21/21. Não declarar pronta a sincronização bidirecional ou painel administrativo.
- Usuário pediu orientação para localizar a configuração Firebase; passos fornecidos e registrados.

### 22/10/2026 — baseline estável, backup e GSD

- Usuário confirmou funcionamento após atualizar dependências.
- Registrado suporte a gesto Voltar Android/iOS para a futura navegação; ainda não implementado.
- Criado backup local com código, configurações ocultas, documentação e Git; verificado por extração/checksums. Instruções em `BACKUP_E_RESTAURACAO.md`.
- GSD retirado para recuperação local, após bloqueio automático da remoção permanente; removidas referências automáticas dos hooks/configurações. Configurações não relacionadas preservadas.
- Nenhum código funcional alterado nesta etapa.

### 22/10/2026 — decisões finais e atualização de dependências

- Registradas respostas em `DECISOES_CONFIRMADAS.md`, incluindo e-mail verificado, Brasil, convites unânimes sem papel prévio, custódia administrativa, avaliação inelegível sinalizada, três itens permanentes e Android/iOS com Flask.
- Pesquisadas fontes públicas oficiais do cadastro iFood; documentados limites da evidência e proposta proporcional de análise empresarial/pessoal.
- Atualizados Expo, câmera, localização e splash screen dentro do SDK 57, com atualização transitiva compatível. Resultados e testes em `ATUALIZACAO_DEPENDENCIAS.md`.
- Compatibilidade Expo aprovada e doctor 21/21. Auditoria npm com 18 alertas remanescentes, sem crítico; não aplicada correção forçada incompatível.
- Nenhum código funcional alterado. Próxima implementação depende do retorno do usuário sobre testes Android/iOS.

### 22/10/2026 — levantamento e documentação

- Registradas respostas do usuário e requisitos novos; corrigida a proposta remota de Firestore para Realtime Database.
- Modelada relação muitos-para-muitos entre usuários e bares.
- Documentadas alternativas para validação empresarial e dúvidas de transferência, offline e Correios.
- Propostos banco lógico, auditoria, exclusão lógica, protocolo de sincronização e bootstrap dos dois admins.
- Criado índice de documentação e sinalizada a distinção entre implementação atual e arquitetura planejada.
- Conferidas fontes oficiais e links internos dos documentos. Não executados testes de aplicativo por não haver alteração de código funcional.
- Não instaladas dependências, não removidos mocks, não criadas contas, não alteradas permissões no Firebase e não importados dados.

### 22/10/2026 — esclarecimentos de transferência e conta offline

- Confirmados seleção do dono substituído, unanimidade dos donos atuais e aceite do destinatário; incluídos votos individuais e invalidação por mudança de propriedade.
- Confirmado cadastro local offline com usuário/senha, limitado à consulta de bares e endereços até autenticação Firebase.
- Propostas tabelas locais de identidade provisória e verificador de senha sem sincronização ou histórico de credenciais; ativação online ainda precisa de definição do fluxo.
- Registradas consultas oficiais de licenciamento vinculadas ao CNPJ e distinção entre autenticidade da licença e identificação do solicitante.
- Apenas documentação alterada. Nenhum cadastro, integração ou esquema executado nesta etapa.

### 22/10/2026 — análise das referências do professor

- Lidos código e configurações dos cinco repositórios públicos; registrados commits e padrões observados.
- Adotada como diretriz a estrutura `database.js` + repositórios + `firebaseConfig.js` + `syncService.js`, fila `sync_queue`, SDK modular e NetInfo.
- Explicitadas diferenças necessárias para autenticação, copropriedade, auditoria, concorrência e administração. Revisada a proposta de exigir API própria para toda escrita.
- Concentradas perguntas abertas em um único registro de alinhamento. Não instaladas bibliotecas nem alterados código funcional ou Firebase.
