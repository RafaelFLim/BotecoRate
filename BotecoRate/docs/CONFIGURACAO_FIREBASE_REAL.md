# Configuração inicial do Firebase real — 22/10/2026

Atualização posterior: migração aditiva para `v1/direct` e regras publicadas para sincronização pelo SDK. Flask não é mais necessário ao aplicativo. Storage ainda não habilitado. Ver `SINCRONIZACAO_DIRETA.md`; pendências de API abaixo pertencem à etapa anterior.

Executada com autorização do usuário para o projeto `botecorate`, usando a ferramenta existente `python -m server.manage`. Este registro atualiza o estado operacional descrito nos documentos anteriores, que registravam carga e promoção ainda pendentes.

## Procedimento concluído

- Preparado ambiente Python 3.14 em `server/.venv`, ignorado pelo Git, com dependências de `server/requirements.txt`.
- Credencial administrativa utilizada diretamente de arquivo externo ao repositório, por variável de ambiente exclusiva dos processos administrativos. Conteúdo não exibido, copiado para o app, incluído em `.env.local` ou versionado.
- Confirmado projeto da credencial; consultadas as duas contas pelos UIDs fornecidos pelo usuário. Ambas ativas, com nomes correspondentes e e-mail verificado.
- Confirmado `v1` inicialmente vazio; simulação da importação executada em memória antes da gravação.
- Rafael e Emanuel promovidos a `role=admin`, `status=ativo`, em `v1/access_control`. Criados dois registros de auditoria em `v1/admin_events`.
- Importados quatro bares, doze itens, nove avaliações de bares e nove de itens. Todas as avaliações de demonstração possuem `elegivel_ranking=0` e não recebem identidade Firebase inventada.
- Registrada a migração `v1/migrations/demo_sync_v1`, que impede repetição da carga. Catálogo completo em `v1/sync/entities`; projeção pública em `v1/catalog`.

A ferramenta atribuiu os bares de demonstração ao UID de Rafael, responsável pela carga. Emanuel pode administrá-los pelo papel admin. Isso não representa custódia institucional nem implementação de transferências.

## Verificações após a gravação

Leitura administrativa confirmou os dois papéis, dois eventos de auditoria, quantidades importadas e avaliações inelegíveis para ranking. Leitura pública sem credencial de `v1/catalog` retornou HTTP 200 com quatro bares.

No console: Realtime Database → Dados → expandir `v1`. Em `access_control`, localizar o UID copiado de Authentication → Usuários. Os registros só ficaram visíveis após esta carga.

## O que permanece pendente

A API Flask ainda precisa ser configurada/disponibilizada por HTTPS e vinculada ao aplicativo; Storage também precisa de configuração para fotos novas. A importação administrativa não hospeda a API. Sem ela, consulta pública pode receber nomes e endereços, mas não há sincronização completa de cardápios, avaliações e alterações entre aparelhos. Para atualizar a autoridade da conta no app, entrar novamente com internet.

Painel administrativo, habilitação de donos, copropriedade/transferências, custódia, Correios e testes físicos integrados continuam pendentes. Regras não foram abertas nem modificadas nesta operação. Nenhuma senha de usuário foi alterada.
