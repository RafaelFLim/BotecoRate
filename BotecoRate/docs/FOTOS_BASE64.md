# Fotos entre aparelhos com Base64 — 27/10/2026

## Decisão e estado atual

O usuário confirmou que o projeto deve continuar sem conta de faturamento e orientou usar Base64 para as imagens. Firebase Storage exige Blaze, então esta entrega usa **JPEG reduzido em Base64 no próprio Realtime Database**, mantendo SQLite e a fila por conta. Não há provedor adicional, credencial no app ou ativação de cobrança.

Código e regras foram implementados e testados localmente. **Usuário confirmou a publicação das regras no Firebase real em 27/10/2026. Fotos de bar/item, persistência e sincronização offline confirmadas pelo usuário nos dois Android; ressalvas em `TESTES_INTEGRADOS_2_CELULARES.md`.** O arquivo `firebase.json` do projeto é configuração, não uma chave administrativa. Não é necessário gerar conta de serviço para publicar pelo console.

## Fluxo

- A câmera e a cópia persistente local continuam funcionando como antes. A imagem original não é apagada.
- Antes do envio, `expo-image-manipulator` 58.0.15 gera uma versão JPEG com maior dimensão de até 960 px e qualidade 0,7. Se necessário, tenta 720 px/0,55 e 480 px/0,4, sem ampliar fotos pequenas.
- O campo `foto` recebe `data:image/jpeg;base64,...`, limitado a **160 KiB de texto incluindo prefixo** (aproximadamente 120 KiB de JPEG). A interface já usa `Image` com URI e pode exibir esse conteúdo.
- A fila congela o resultado em `wire_payload` e o reutiliza, preservando a identidade do comando nas tentativas repetidas. O mesmo arquivo referenciado por mais de um registro no lote só é convertido uma vez. URLs HTTPS antigas continuam aceitas.
- O conteúdo atravessa confirmação, snapshot, SQLite, histórico e projeção pública do bar. A imagem do bar permanece pública como já era a foto por URL; fotos de itens acompanham as permissões do catálogo.
- Trocar de conta durante a preparação descarta o resultado. Arquivos temporários da compressão são removidos, preservando o original. Erros de imagem ausente/corrompida/grande demais permanecem disponíveis na revisão de envios; não se perde a foto original.
- Envios completos maiores que 8 MiB são recusados antes da escrita do SDK. Isso não divide lotes automaticamente: é necessário revisar as alterações, sem quebrar sua atomicidade.

## Regras e limites

Apenas as validações de `foto` em `v1/direct/entities/bares/$id` e `v1/direct/entities/itens_cardapio/$id` mudaram. Aceitam HTTPS com até 2048 caracteres ou JPEG Base64 com prefixo, caracteres/padding e tamanho limitados. A regra valida o formato do texto, não decodifica nem inspeciona visualmente o JPEG no servidor. Permissões, versões, auditoria, administração e propriedade permanecem iguais.

Não há nova migração SQLite. A configuração opcional de Storage e suas regras antigas foram preservadas para não mexer em outras frentes, mas o fluxo atual de fotos não usa Storage.

Base64 acrescenta cerca de 33% ao tamanho binário. O histórico e a projeção podem guardar cópias do texto; o download atual ainda lê todo o catálogo/histórico. A abordagem é proporcional ao projeto acadêmico pequeno, não a uma galeria de grande escala. Monitorar as cotas Spark; permanecer sem faturamento não significa armazenamento/download ilimitados. Usar a versão nova do app nos dois celulares: clientes antigos ainda tentam tratar fotos novas como arquivos para Storage.

## Publicação pelo console

1. Abrir o projeto **botecorate** no Firebase Console, ir a **Realtime Database → Regras**.
2. Copiar as regras atuais para um backup antes de editar. Não trocar por uma versão antiga de todo o arquivo.
3. Localizar `rules → v1 → direct → entities → bares → $id → foto` e o equivalente em `itens_cardapio`.
4. No arquivo `FOTO_BASE64_REGRA.json`, nesta pasta, copiar somente a linha `".validate": ...`. Substituir a linha `.validate` dentro de cada um desses dois blocos `foto`, mantendo as chaves/vírgulas do editor. Não colar o objeto externo inteiro nem adicionar regras de escrita pública.
5. Publicar e confirmar que não houve alteração nas outras regras. Sem essa publicação, o app conserva os dados locais, mas o envio Base64 será recusado pela regra HTTPS antiga.

## Validação executada

- Dependências compatíveis segundo `expo install --check`.
- Suíte completa com emulador RTDB em `127.0.0.1:19110`: **88 aprovados, nenhum pulado**. Inclui administração/copropriedade existentes, conversão simulada, limites, sessão, fila/reenvio e as duas novas verificações de regras.
- SDK Firebase com regras reais do emulador: JPEG Base64 em bar/item, leitura pública do bar, histórico e materialização em duas bases SQLite independentes; sem alterações falsas na fila ao salvar o catálogo recebido. Testes negativos cobrem formatos/tamanho inválidos, visitante, usuário comum, banido e sem confirmação de e-mail.
- Exportações Android/iOS aprovadas em `dist/validacao-fotos-base64`. Os testes do manipulador usam simulação dos módulos nativos. Posteriormente o usuário confirmou captura/preparação, recebimento e renderização de fotos no Android; isso não valida iOS nem todos os modelos de aparelho.
- Nenhuma identidade, bar, foto ou plano do Firebase real foi alterado pelos testes. Posteriormente o usuário confirmou publicação pelo console; ver retorno do teste real abaixo.

## Teste físico desta entrega

1. Atualizar ambos os celulares e reiniciar Metro com cache limpo. Confirmar publicação das regras acima.
2. Com conta autorizada, trocar a foto de um bar de teste já existente. Salvar e sincronizar; conferir resultado sem envios rejeitados.
3. No outro celular, entrar com conta verificada, sincronizar e abrir a foto. Reabrir o app e conferir persistência. Testar também a foto de um item.
4. No primeiro aparelho, trocar foto offline. A foto e a fila devem persistir após reabrir. Reconectar/sincronizar e conferir a chegada ao segundo.
5. Trocar de conta com envio pendente e confirmar que foto/alterações da conta anterior não são publicadas pela nova conta. Reentrar na conta original para enviar.
6. Conferir URLs antigas e a consulta pública do bar; verificar qualidade, rotação e proporção das fotos novas no Android/iOS.

Registrar o retorno antes de partir para o roteiro geral de conflitos, permissões e gestos em dois celulares. Testes automatizados com duas réplicas não equivalem a testes em dois celulares físicos.

Fontes: [Storage e faturamento](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [plano Spark e cotas](https://firebase.google.com/pricing), [limites RTDB](https://firebase.google.com/docs/database/usage/limits) e [ImageManipulator SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/).

## Retorno do teste real — 27/10/2026

Usuário informou editar a foto offline, salvar e reconectar, com sincronização pelo aplicativo. Consulta somente de leitura à projeção pública confirmou Boteco do Zé (ID 1) na versão 2, com foto JPEG Base64 (6483 caracteres); demais três bares permaneciam na versão 1 com HTTPS. Nenhum dado foi alterado por essa consulta. Usuário confirmou que olhava v1/sync; no registro atual em entities o updated_at mudou corretamente e a mensagem foi “Catálogo sincronizado com o Firebase”. Confirmado o envio real após edição offline/reconexão; v1/sync e v1/catalog permanecem estruturas anteriores e public_bars não publica updated_at. Usuário confirmou que a nova foto do bar apareceu corretamente no segundo celular. Confirmado o fluxo físico de edição offline, reconexão, envio e recebimento/renderização do bar; fotos de itens, troca de conta e demais cenários continuam pendentes.

### Atualização manual: melhoria de usabilidade identificada

Inicialmente o usuário não encontrou como atualizar manualmente no segundo celular e aguardou a atualização automática. Após orientação, confirmou que tocar no status também funciona corretamente. Código atual chama sincronização a cada 30 segundos, ao recuperar rede e ao voltar ao primeiro plano. Na lista, o texto de status é clicável e dispara atualização, mas não deixa clara a ação; não há puxar para atualizar. Proposta registrada para etapa posterior: gesto de puxar a lista para baixo e botão explícito Atualizar, com indicador de andamento. Nenhuma mudança funcional de atualização manual implementada neste registro.

Escolha de imagem da galeria, além da câmera, foi sugerida pelo usuário e adiada explicitamente. Próxima etapa: roteiro geral em `TESTES_INTEGRADOS_2_CELULARES.md`, com dois Android e duas contas admin/donas.

Confirmação posterior em 27/10/2026: após o bloco de foto de item e reabertura do segundo Android, usuário confirmou que a imagem permaneceu. T04/T05 registrados como aprovados em `TESTES_INTEGRADOS_2_CELULARES.md`; demais cenários continuam pendentes.

Consolidação em 27/10/2026: usuário confirmou offline/segundo plano e envio posterior, isolamento entre conta Firebase e conta local, conta local somente para consulta e retorno da câmera preservando rascunho. Matriz final e limites da validação em `TESTES_INTEGRADOS_2_CELULARES.md`. Nenhuma falha nova relatada nesses cenários.
