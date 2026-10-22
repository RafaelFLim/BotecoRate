# Servidor e sincronização — protocolo 1

**Referência histórica:** o aplicativo passou a sincronizar diretamente pelo SDK Firebase e não exige esta API. Ver `SINCRONIZACAO_DIRETA.md` para o fluxo atual. As instruções abaixo descrevem a implementação anterior.

Atualização operacional: em 22/10/2026 foram promovidas as duas contas administrativas e importados os quatro bares no Firebase real. A API não foi hospedada. Ver `CONFIGURACAO_FIREBASE_REAL.md`; afirmações de não execução abaixo descrevem a entrega anterior.

Implementado localmente em 22/10/2026. Não implantado no Firebase ou em hospedagem. Esta é a referência atual da segunda etapa; `IMPLEMENTACAO_ETAPA_1.md` descreve a etapa anterior.

## Entregue

- API Flask em `server/app.py`, Firebase Admin SDK no servidor e validação de ID token com revogação, e-mail verificado e status ativo. Papéis enviados pelo celular não são autoridade.
- Publicação atômica de bar e pelo menos três itens; edição/exclusão lógica de bares, itens e avaliações; autoria das avaliações atribuída pela sessão; proibição de autoavaliação; unicidade por autor/alvo; vínculo de donos mantido exclusivamente no servidor.
- Comparação de versões, recibos por UID/operation_id e fingerprint do conteúdo. Reenvio após perda da resposta não duplica entidade, histórico ou evento. Mesmo ID com conteúdo diferente é recusado. Exclusão não é revertida por edição antiga.
- Snapshot completo com fronteira consistente, eventos paginados em sequência e histórico das alterações confirmadas. Não depende de relógio do aparelho. Campos nulos e mapas numéricos recebem tratamento específico porque o RTDB pode omitir nulls e devolver arrays.
- SQLite v2: `sync_entities` guarda a réplica confirmada; `sync_batches` agrupa cada transação local; `sync_queue` conserva as intenções individuais; `sync_conflicts` conserva propostas e respostas rejeitadas. Todas as tabelas anteriores são preservadas.
- Troca de conta reconstrói a projeção com a réplica confirmada e apenas a fila da conta atual. Intenções/fotos não enviadas de outra conta ficam ocultas. O catálogo confirmado é compartilhado no aparelho; não inclui e-mails ou documentos privados. A fila só usa o token do mesmo UID e uma mudança de sessão interrompe os próximos envios.
- Sincronização na abertura, login/troca de conta, reconexão, retorno ao primeiro plano, ação manual e verificação a cada 30 segundos enquanto o app está ativo. Backoff entre 1 segundo e 5 minutos. A primeira falha bloqueia os comandos seguintes da conta para preservar dependências.
- Tela “Revisar envios e conflitos”: propostas locais, resposta remota, tentativas e erro. Conflitos/rejeições permanentes não são reenviados automaticamente. É possível copiar a proposta, escolher explicitamente o servidor e reaplicar a edição nos formulários. A escolha descarta **toda a fila da conta**, com confirmação, e preserva o registro de revisão no SQLite; não há fusão automática por campo.
- Upload autenticado de fotos para bucket privado: até 5 MB, JPEG/PNG/WebP válidos, até 20 milhões de pixels, conversão para JPEG até 2048 px e remoção de metadados. O servidor valida permissão antes e depois do upload. A URL só entrega fotos associadas a bares/itens publicados. Upload repetido usa caminho derivado de usuário/bar/conteúdo. O comando é congelado em SQLite antes do primeiro envio, incluindo URLs das fotos.
- `server.manage import-demo` agora prepara os quatro bares no mesmo catálogo completo da API, com itens, avaliações inelegíveis e autoria de demonstração sem UID. A carga é idempotente, recusa catálogo desconhecido e nunca é disparada pelo app.

## Preparar e executar

Da raiz do repositório, usando Python 3.12+ disponível na máquina:

```powershell
python -m venv server/.venv
./server/.venv/Scripts/python.exe -m pip install -r server/requirements.txt
```

As variáveis de `server/.env.example` são **exclusivas do processo do servidor**; o arquivo não é carregado automaticamente. Configure `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL` e Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` apontando para arquivo fora do repositório). Para fotos, configure também `FIREBASE_STORAGE_BUCKET` e `PUBLIC_API_URL` com a URL HTTPS estável da API. O bucket permanece privado; não executar `make_public` nem abrir regras de Storage. Defina hospedagem, bucket, custos e credenciais antes de qualquer implantação.

```powershell
./server/.venv/Scripts/waitress-serve.exe --listen=127.0.0.1:5000 --call server.app:create_app
```

Exponha esse serviço por HTTPS na hospedagem ou por túnel próprio para testes. O túnel Metro documentado em `TUNEL_TESTES.md` atende outro serviço/porta. Não executar Flask com debug exposto. No `.env.local` do aplicativo, defina `EXPO_PUBLIC_API_URL` com a URL HTTPS correspondente e reinicie o Metro. Nunca coloque conta de serviço em `EXPO_PUBLIC_*`. Sem API configurada, o app conserva as alterações localmente e informa a pendência.

Promoção e carga continuam manuais, com UIDs reais verificados e destino confirmado:

```powershell
./server/.venv/Scripts/python.exe -m server.manage promote-admin --uid UID_RAFAEL --bootstrap --confirm-project botecorate
./server/.venv/Scripts/python.exe -m server.manage promote-admin --uid UID_EMANUEL --actor-uid UID_RAFAEL --confirm-project botecorate
./server/.venv/Scripts/python.exe -m server.manage import-demo --actor-uid UID_RAFAEL --confirm-project botecorate
```

Nenhum desses comandos foi executado contra o projeto real nesta entrega. As regras de Database continuam fechadas para escrita direta de negócio e para leitura direta de `v1/sync`/`v1/media`; a API usa Admin SDK e devolve apenas o catálogo autorizado. `/health` é público. `/v1/sync/snapshot`, `/v1/sync/events?after=N`, `/v1/sync/commands` e upload `/v1/media` exigem autenticação. Download `/v1/media/ID` libera somente fotos já publicadas.

## Migração e conflitos

As versões da etapa 1 eram revisões locais. A migração recupera a base anterior pelos históricos quando disponível e mantém as intenções por conta. Comandos antigos sem lote são colocados em revisão, com mensagem específica; não são enviados com versões remotas inventadas. Use a tela de revisão para copiar/reaplicar essas intenções após obter o catálogo remoto. Dados de demonstração legados não viram contas ou avaliações verificadas por coincidência de nome.

Uma confirmação só remove os IDs da fila que pertencem àquele lote. Edições feitas depois do envio continuam como sobreposição local. Cursor só avança ao gravar a página de eventos, nunca ao receber um recibo isolado; assim, uma confirmação não faz o app pular eventos de outro aparelho. Conflitos preservam intenção, versão-base e resposta remota; a base anterior também permanece nos históricos locais.

## Verificações reproduzíveis

```powershell
npm test
npm run test:server
npm run test:rules
npm run test:sync:emulator
npx expo export --platform android --platform ios --output-dir dist/validacao-sync
```

`test:server` e `test:sync:emulator` usam o ambiente Python em `server/.venv` no Windows. O teste do emulador exige Java e conecta **somente** a localhost com projeto fictício `demo-botecorate`. Sem emulador, os testes específicos são pulados; isso não comprova integração real. Testes HTTP usam tokens simulados por injeção explícita; produção sempre usa Admin SDK. Não há teste de credenciais reais nos testes automatizados.

Resultados nesta entrega: 15 testes JavaScript/SQLite aprovados; 10 testes Python de domínio/API/fotos aprovados; 2 testes de integração Admin SDK/RTDB aprovados no emulador (concorrência real, reenvio e importação com IDs numéricos); 5 testes de regras aprovados no emulador; bundles Android e iOS gerados. Na validação das regras, a porta padrão 19000 estava ocupada após a execução anterior; foi usada configuração temporária ignorada em `.tools/firebase-rules.json`, com porta 19100, sem encerrar processos alheios.

Validar manualmente com duas contas verificadas em dois aparelhos: publicar bar/fotos; atualizar no segundo; criar avaliação; editar em modo offline; reconectar; enviar o mesmo comando após perda de resposta; editar a mesma entidade nos dois; escolher a versão remota; trocar de conta com fila pendente; banir antes do envio; excluir sem ressuscitar em outro aparelho. Testar reinício, foto sem arquivo local e falha de upload. Android/iOS físicos e entrega real dos e-mails continuam pendentes.

## Limites e próximos passos

- A transação abrange `v1` para validar autoridade, versões, pais e gravar tudo atomicamente. Snapshot/eventos também leem esse escopo e só então filtram a resposta. É uma implementação proporcional ao catálogo acadêmico; logs e recibos ainda não têm retenção/compactação. Crescimento exige particionamento sem perder a fronteira de consistência. O fallback de cursor existe, mas não há expiração programada dos eventos.
- Fotos órfãs de uploads não publicados ficam privadas no bucket; coleta de órfãos e quotas por conta precisam de rotina operacional. Não há fila de upload de documentos de comprovação.
- Há suporte remoto às operações que os serviços locais geram; telas de edição/exclusão completa de bar, moderação, painel administrativo, validação de donos, convites, transferência e custódia continuam pendentes. Papel de dono precisa ser concedido por procedimento administrativo futuro; o app não se autopromove.
- Nenhuma regra foi escolhida para devolução de custódia, comprovação sem CNPJ ou retorno de avaliação ao ranking após fim de propriedade. Mudanças de propriedade e reprocessamento remoto do ranking serão implementados junto desses fluxos.
- Correios continua sem endpoint/acesso confirmado e com endereço manual. Nenhuma substituição de fornecedor foi feita.

Referências consultadas antes da implementação: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [SQLite SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [transações Admin SDK](https://firebase.google.com/docs/database/admin/save-data), [verificação de ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens) e [uploads no Flask](https://flask.palletsprojects.com/en/stable/patterns/fileuploads/).
