# SQLite e Firebase diretamente — 22/10/2026

Referência atual do app, após autorização do usuário para seguir `FUSVE/LPAH-2026-SQLITE-FIREBASE`. Substitui a dependência da API Flask. Não houve instalação ou atualização de bibliotecas.

## Fluxo

1. `database.js` abre `botecorate.db` no aparelho. As telas usam SQLite; alterações gravam dados, histórico e fila local na mesma transação.
2. `syncService.js` verifica conectividade e processa a fila da conta atual em ordem. `syncTransport.js` usa diretamente `get`/`update` do SDK Firebase.
3. Uma atualização atômica envia registros, histórico e projeção pública. As regras remotas validam permissão e versão; o papel local não concede acesso.
4. Só a confirmação remove o lote. Reenvio após perda da resposta é reconhecido pelo histórico e hash do comando. ID reutilizado com conteúdo diferente gera conflito. Falhas temporárias conservam fila/backoff; rejeição permanente interrompe os envios seguintes.
5. Um download completo atualiza a réplica SQLite, preservando propostas pendentes da conta. Trocar de conta não apresenta nem envia intenções alheias. A tela de revisão continua disponível.

Assim como no professor, sincronizamos **registros**, não o arquivo `.db` inteiro. Seu exemplo usa `set` por tarefa; usamos `update` de múltiplos caminhos para confirmar bar, cardápio e auditoria juntos. Não é necessário configurar `EXPO_PUBLIC_API_URL` nem executar Flask. Uma variável antiga ainda presente em `.env.local` é ignorada por este fluxo.

## Caminhos no Realtime Database

| Caminho | Conteúdo |
| --- | --- |
| `v1/direct/entities` | Bares, itens e avaliações completos. |
| `v1/direct/owners` | Vínculos de propriedade confirmados. |
| `v1/direct/history` | Registro anterior e confirmado por versão, autor, operação e hash. |
| `v1/direct/public_bars` | Projeção pública: nome, endereço, foto, coordenadas e exclusão lógica. |
| `v1/direct/review_index` | Unicidade de avaliação ativa por autor/alvo. |
| `v1/access_control` | Papéis/status; preservados. |

O catálogo completo só pode ser lido por conta ativa com e-mail verificado. Visitantes e contas locais consultam a projeção pública e o cache disponível. `v1/sync` e `v1/catalog` foram preservados como origem histórica e não recebem os novos envios. Não executar a API legada esperando espelhamento entre esses caminhos.

## Proteções

- Comum não cadastra bar; dono administra seus vínculos; admin administra qualquer bar. Cliente não altera permissões nem transfere propriedade existente. Novo bar vincula somente o criador autenticado.
- Opinião tem autoria imutável, nota inteira 1–5 e índice único; dono não se autoavalia. Admin não reescreve opinião alheia. Moderação específica ainda pendente.
- Preços em centavos inteiros, campos limitados e coordenadas válidas em pares. Alvo de item/opinião não pode ser trocado.
- `item_a`, `item_b`, `item_c` no bar referenciam três itens distintos e ativos; as regras validam o estado final. Troca/exclusão de item precisa manter esse mínimo. A fila também versiona o bar quando muda o conjunto de itens, para preservar causalidade de edições seguintes.
- Exclusão física e ressurreição por edição antiga bloqueadas. Histórico obrigatório é conferido contra o estado anterior e o novo e não pode ser removido/sobrescrito pelo cliente.

As regras explícitas são geradas por `node scripts/build-direct-rules.cjs`. Após editar o gerador, gerar o JSON e testar antes de publicar. Não abrir regras na raiz para contornar acesso negado.

## Migração e publicação reais

`server/direct.py` / `python -m server.manage prepare-direct` preparam a estrutura uma vez; não são servidor necessário ao aplicativo. Migração aditiva e idempotente, com admin ativo/verificado e destino confirmado.

Executada em `botecorate`: 4 bares, 12 itens, 9 avaliações de bares e 9 de itens. Rafael/Emanuel e sua autoridade foram preservados. Avaliações de demonstração continuam fora do ranking. Marcador: `v1/migrations/direct_v1`. O diário original permanece em `v1/sync/events`; a nova auditoria inicia com uma referência à base importada.

Dados e regras anteriores foram salvos em `.tools/firebase-before-direct-*.json`, ignorado pelo Git e sem a chave privada. As regras reais foram comparadas à base esperada antes da substituição; publicadas as regras RTDB testadas. Consulta pública retornou HTTP 200; entidades e autoridade sem autenticação retornaram HTTP 401. Nenhuma conta ou opinião de teste foi criada no projeto real.

## Fotos: pendência de Storage

O app agora usa diretamente Firebase Storage para fotos novas, sem Flask. Grava na pasta do UID com nome derivado do conteúdo, até 5 MB, com limite de tentativas. A foto da câmera é enviada como JPEG; só uma URL HTTPS é colocada no registro remoto. Se falhar, a intenção e o arquivo local permanecem no aparelho.

Consulta administrativa confirmou que o bucket `botecorate.firebasestorage.app` **ainda não existe**. Não habilitamos Storage nem alteramos plano/cobrança. É necessário habilitar o produto no console, conferir o plano exigido, configurar `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` e publicar `firebase/storage.rules`. Até lá, envios com fotos novas ficam pendentes; as fotos HTTPS importadas continuam funcionando.

Regras Storage preparadas, mas não publicadas nem testadas no serviço real: conta verificada cria JPEG de até 5 MB na própria pasta, sem sobrescrever arquivos. Autorização para publicar o bar/item é verificada separadamente no RTDB. Storage Rules não consultam os papéis/status do RTDB: banimento ainda precisa reconciliar Authentication e sessões. Cotas, limpeza de órfãos e sanitização de imagem/metadados não estão implementadas no fluxo direto. Não confundir com as proteções da API anterior.

## Verificações e teste no celular

- `npm test`: 31 aprovados e 10 cenários dependentes de emulador pulados (incluindo a correção de inicialização abaixo).
- `npm run test:direct`: 12 aprovados usando SDK e emulador RTDB, incluindo publicação atômica, acessos indevidos, concorrência, perda da resposta, histórico, três itens e duas réplicas SQLite reais. Requer Java 17+ no PATH. Não usa projeto real.
- `npm run test:server`: 11 aprovados e 2 testes legados de emulador pulados; inclui preservação/idempotência da migração. Não implica uso de Flask pelo app atual.
- Pacotes Android/iOS exportados; leituras reais de configuração Authentication e projeção pública aprovadas. Não equivale a teste físico.

Reinicie com `npx expo start --clear`, entre com conta de e-mail confirmado e sincronize. Cardápios e avaliações devem chegar diretamente do Firebase. Em dois aparelhos, criar avaliação, editar offline/reconectar, conferir chegada ao outro, provocar conflito e trocar de conta com fila pendente. Fotos novas exigem a configuração acima.

O download é integral, adequado à escala acadêmica, sem cursor global. Histórico cresce sem compactação. Painel administrativo, validação de dono, convites/transferências/custódia, ranking após mudança de propriedade e Correios continuam pendentes. Não criamos tela técnica de banco nem corrigimos o timeout do inspetor nesta etapa.

## Correção após teste Android/Expo Go

O usuário apresentou `[runtime not ready]: TypeError: undefined is not a function` e timeout do inspetor. A pilha foi simbolicada pelo Metro e apontou exatamente para `firebaseConfig.js`, na tentativa de chamar `setMaxUploadRetryTime` como export do SDK. Na versão instalada, os limites são propriedades de `FirebaseStorage`: `maxUploadRetryTime` e `maxOperationRetryTime`. Corrigidas as duas atribuições.

Adicionados dois testes que executam o módulo de configuração com o **Storage SDK real**, dados fictícios e sem acesso remoto, com/sem bucket. Ambos passam. Exportar bundles só verificou compilação e não detectou a chamada inexistente; esses testes verificam a execução dessa inicialização.

Antes da correção, o Metro respondia e seu WebSocket DevTools aceitava conexão, mas o aplicativo não respondia a `listDatabases`, pois falhava antes de abrir o banco. O nome `botecorate.db` e os dados não foram alterados/apagados. É necessário recarregar o app, confirmar que abriu e então testar novamente o inspetor; outros problemas do canal não podem ser descartados apenas pela correção da inicialização.

Confirmação após RELOAD: usuário informou que o app abriu normalmente. Consulta real pelo WebSocket do inspetor recebeu `botecorate.db`; `listTables` retornou as 20 tabelas do aparelho, incluindo `bares`, `itens_cardapio`, usuários, avaliações, históricos e fila. Nenhum registro foi alterado nesse diagnóstico. O timeout inicial foi resolvido para essa sessão; atualizar/reabrir a aba do inspetor para abandonar a solicitação antiga expirada.


## Administração e moderação — 22/10/2026

O fluxo direto continua usando o SDK cliente e regras RTDB. Painel descrito em `PAINEL_ADMINISTRATIVO.md`; moderação em caminhos próprios chega no snapshot e é materializada em SQLite versão 4. O diretório privado de usuários não faz parte de `v1/direct`. Administração requer internet e não entra na fila offline do catálogo. Exclusões administrativas recebem prazo de 30 dias, mas expurgo automático/lixeira geral permanecem pendentes conforme `LIXEIRA_E_RETENCAO.md`.


## Copropriedade e transferência — 22/10/2026

Convites/aceites usam SDK Firebase diretamente e exigem conexão. O snapshot replica suas solicitações e eventos no SQLite 5; o catálogo recebe os donos canônicos atuais. A troca de propriedade não reescreve autoria do bar nem opiniões. Metadados e regras estão em `COPROPRIEDADE_E_TRANSFERENCIA.md`; diretório privado de e-mails não foi aberto aos donos. Aplicativos antigos precisam ser recarregados/atualizados para publicar bares e alterar permissões com os novos metadados obrigatórios.
