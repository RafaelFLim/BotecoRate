# Banco de dados — SQLite e Firebase Realtime Database

Data: 22/10/2026. Modelo lógico proposto, não implantado. Ver [requisitos e decisões pendentes](LEVANTAMENTO_V2.md).

> Estado atual: SQLite v2 e protocolo remoto implementados localmente conforme [Servidor e sincronização](SERVIDOR_E_SINCRONIZACAO.md). As tabelas de validação de donos, transferência e custódia abaixo permanecem propostas. No protocolo entregue, cada gravação local é um lote atômico e `/v1` é a fronteira transacional remota; `sync_entities.version` é a versão confirmada, separada da revisão da projeção local.

> Atualização de requisitos: [Decisões confirmadas](DECISOES_CONFIRMADAS.md) prevalece sobre propostas antigas. E-mail verificado é obrigatório; convidados podem se tornar donos ao concluir vínculo consensual. Adicionar tabela `bar_custodias` (`id`, `bar_id`, `custodiante_id`, `motivo`, `iniciada_at`, `encerrada_at`, `iniciada_por`, `encerrada_por`, `version`) e `bar_custodias_historico` para gestão temporária quando não há donos elegíveis. Custódia não apaga propriedade anterior. Convite de adição usa a mesma estrutura de unanimidade/aceite da transferência, mas sem proprietário substituído. Detalhar no DDL após os testes das dependências.

> Após análise dos exemplos, a organização de implementação deve seguir [Referências do professor](REFERENCIAS_PROFESSOR.md). A fila chama-se `sync_queue`. O protocolo abaixo é requisito de integridade proposto; a fronteira entre escrita SDK direta com regras/transações e comandos de servidor ainda precisa de desenho. Não tratar a passagem obrigatória de todo comando por API como decisão aprovada.

## 1. Convenções

- SQLite relacional local; Realtime Database com nós JSON identificados por IDs, nunca arrays globais.
- Usuário remoto identificado pelo UID do Firebase Authentication; contas locais provisórias têm UUID próprio, separado do UID. Demais entidades usam identificador global gerado offline. Não usar nome/e-mail como chave.
- Datas canônicas em milissegundos UTC desde epoch, atribuídas pelo servidor. `client_occurred_at` registra a informação do aparelho sem decidir conflitos.
- Tabelas mutáveis de negócio têm `id`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `version`. Campos de ator são FKs para usuários, com exceções documentadas para bootstrap/importação por ator de sistema.
- `version` representa a versão canônica aceita. Alterações locais ficam em estado pendente e registram `base_version`; não simular uma versão aceita pelo servidor.
- Tabelas associativas podem ter chave composta. Históricos e infraestrutura não recebem automaticamente o mesmo conjunto de campos das entidades de negócio.
- Senhas, tokens de sessão, chaves administrativas e credenciais dos Correios não pertencem ao banco de negócio nem à auditoria.
- Habilitar `PRAGMA foreign_keys = ON`; avaliar WAL e usar consultas parametrizadas e transações. Toda migração tem versão e execução controlada.

## 2. Tabelas de negócio

As listas abaixo descrevem campos específicos além dos campos comuns. O DDL executável será produzido após as decisões abertas.

| Tabela | Campos e relações principais |
| --- | --- |
| `usuarios` | `id` = UID, `nome_perfil`. Perfil público mínimo. E-mail de login é autoridade do Authentication. |
| `usuarios_privados` | `usuario_id` único, `email_cache`, preferências privadas. E-mail cache nunca redefine login. Acesso restrito. |
| `controle_acesso` | `usuario_id` único, `user_role` (`comum`, `dono`, `admin`), `status` (`ativo`, `banido`, `excluido`), `motivo`, `alterado_por`. Réplica local da autoridade protegida do servidor. |
| `solicitacoes_dono` | `usuario_id`, `cnpj` textual opcional conforme política, `nome_empresa`, `status`, `analisado_por`, `analisado_at`, `motivo_decisao`. |
| `solicitacoes_dono_documentos` | `solicitacao_id`, `midia_id`. Documentos privados, jamais em cache público. |
| `verificacoes_estabelecimento` | `bar_id` ou `solicitacao_id`, `cnpj`, `tipo_documento`, `numero_licenca`, `orgao_emissor`, `municipio`, `uf`, `metodo_consulta`, `consultado_at`, `status`, `verificado_por`, `evidencia_privada_id`. Proposta: licença/dispensa e vínculo pessoal são verificações distintas. Não buscar URLs arbitrárias de documentos no servidor sem validação de destino. |
| `bares` | `nome`, `detalhes`, `foto_id`, `cnpj` opcional; `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `origem_endereco`, `endereco_consultado_at`; `latitude`, `longitude`, `origem_coordenadas`, `coordenadas_confirmadas_at`; `status_publicacao`. |
| `bar_proprietarios` | Chave composta (`bar_id`, `usuario_id`), `vinculado_at`, `vinculado_por`, `origem_vinculo`. Vários donos para vários bares; exclusão lógica revoga o vínculo. |
| `solicitacoes_propriedade` | `bar_id`, `solicitante_id`, `proprietario_substituido_id`, `destinatario_id`, `status`, `base_propriedade_version`, `expires_at`, `concluido_at`, `motivo`. Unanimidade dos donos atuais e aceite do destinatário obrigatórios. |
| `solicitacao_propriedade_vinculos` | `solicitacao_id`, `usuario_id`, `acao_proposta`. Identifica exatamente os vínculos adicionados/removidos; necessário se a transferência afetar múltiplos donos. |
| `solicitacao_propriedade_aprovacoes` | Chave (`solicitacao_id`, `usuario_id`, `tipo_participacao`), `decisao`, `respondido_at`, `operation_id`. Snapshot dos donos obrigados a consentir e aceite do destinatário. Tipos: `dono_atual` e `destinatario`. Sem votos implícitos. |
| `itens_cardapio` | `bar_id`, `tipo` (`comida`, `bebida`), `nome`, `descricao`, `valor_centavos`, `foto_id`. |
| `avaliacoes_bares` | `bar_id`, `autor_id`, `nota`, `comentario`, `status_moderacao`, `motivo_moderacao`, `elegivel_ranking`. |
| `avaliacoes_itens` | `item_id`, `autor_id`, `nota`, `comentario`, `status_moderacao`, `motivo_moderacao`, `elegivel_ranking`. |
| `midias` | `storage_path`, `mime_type`, `tamanho_bytes`, `checksum`, `escopo_acesso` (`publico`, `privado`). Caminho remoto estável; sem caminho local compartilhado. |

Não duplicar proprietário em `bares.dono_id`. `created_by` identifica quem cadastrou, não quem é proprietário hoje. A tabela de vínculos é a fonte de propriedade.

O modelo de solicitações é provisório: aprovação manual ainda não foi escolhida. Caso seja autodeclaração, registrar o método e não rotular como validação documental.

## 3. Integridade, índices e ranking

- FKs entre usuários, bares, vínculos, itens, avaliações, solicitações e mídias. Não apagar em cascata o histórico.
- `CHECK`: notas de 1 a 5; preços inteiros positivos; tipos e estados válidos; latitude entre -90 e 90, longitude entre -180 e 180; ambas nulas ou ambas preenchidas.
- Índice único parcial em (`bar_id`, `autor_id`) com `deleted_at IS NULL`; equivalente para (`item_id`, `autor_id`). Reativação/novo envio precisam respeitar a mesma restrição.
- Índices em FKs, `deleted_at`, pares de paginação e consultas por autor/bar/status. Não indexar todos os campos sem necessidade.
- Unicidade de avaliação remota mantida pelo servidor por chave de usuário/alvo, inclusive com aparelhos concorrentes. SQLite sozinho não impõe unicidade entre aparelhos.
- Vínculos ativos exigem contas válidas; bar publicado deve ter pelo menos um proprietário elegível, salvo fluxo administrativo de quarentena/importação explicitamente marcado.
- Não definir `UNIQUE(cnpj)` antes de decidir se bares representam empresas, filiais ou unidades de atendimento.
- Ranking usa apenas avaliações ativas, não ocultadas e elegíveis. Médias/contagens são projeções derivadas recalculáveis, nunca valor arbitrário enviado pelo cliente.
- Vínculo de propriedade impede avaliar o bar e seus itens. Servidor verifica na mesma fronteira de consistência de mudanças de propriedade/avaliação.
- Exigência mínima de três itens é validada no serviço de publicação, não por um `CHECK` isolado. Política de exclusão posterior ainda pendente.

## 4. Histórico e eventos administrativos

Tabelas de versões: `usuarios_historico`, `controle_acesso_historico`, `bares_historico`, `bar_proprietarios_historico`, `itens_cardapio_historico`, `avaliacoes_bares_historico`, `avaliacoes_itens_historico`, `solicitacoes_dono_historico`, `solicitacoes_propriedade_historico`, `solicitacao_propriedade_aprovacoes_historico`, `verificacoes_estabelecimento_historico` e `midias_historico`.

Cada entrada contém `id`, referência à entidade (ou chave composta), `entity_version`, `operation_id`, `acao` (`create`, `update`, `soft_delete`, `restore`), `actor_id`, `actor_type`, `client_occurred_at`, `server_committed_at`, `motivo`, `schema_version` e `snapshot_json` da versão resultante. A sequência inclui a criação, permitindo reconstrução das versões. Snapshot JSON é uma escolha para auditoria, não para substituir as relações das tabelas atuais.

`eventos_administrativos` registra concessão/revogação de papéis, bloqueio/desbloqueio, moderação e coordenação com Authentication. Mudança de senha registra apenas o evento sem credenciais; evento só confirmado quando a operação efetivamente concluir. Comandos envolvendo Authentication e RTDB precisam de etapas idempotentes/reconciliação: não há transação única entre os dois serviços.

Históricos aceitos são append-only, gravados pelo serviço confiável junto com a alteração canônica. Clientes não podem reescrevê-los. Históricos privados não são públicos. A edição de dados de perfil nunca deve expor e-mails/documentos anteriores na área comunitária.

Versões locais pendentes ficam na fila e não se passam por auditoria remota confirmada. Operações recusadas têm registro de falha separado.

## 5. Exclusão lógica

`deleted_at` nulo significa registro ativo. Exclusão e restauração produzem novas versões e eventos. Tombstones são sincronizados; não expurgar imediatamente, pois aparelhos antigos precisam receber exclusões.

Excluir bar oculta seu conteúdo; consultas e servidor verificam também o estado do pai. Se houver exclusão lógica dos filhos, registrar operação de cascata para não restaurar filhos excluídos antes do bar. Retenção, restauração e limpeza física ficam pendentes de política explícita.

Banir mantém a conta com `status=banido`, bloqueia comandos e coordena desabilitação/revogação no Authentication. Excluir perfil exige resolver copropriedades e política de anonimização/retenção. Histórico não é autorização para guardar dados pessoais indefinidamente.

## 6. Infraestrutura local

| Tabela | Campos/finalidade |
| --- | --- |
| `sync_queue` | `operation_id`, `account_uid`, `device_id`, `entity_type`, `entity_id`, `command_type`, `base_version`, `payload_json`, `depends_on`, `status`, `attempts`, `next_attempt_at`, `last_error`, `created_at`. Mantém o papel da fila do exemplo com controles extras. |
| `sync_cursors` | Escopo/conta, última sequência aplicada e versão do protocolo. |
| `sync_conflitos` | Operação, base, estado local, estado remoto, motivo, decisão e data de resolução. |
| `midias_locais` | Mídia, conta, caminho persistente no aparelho e estado de upload/download. |
| `cep_cache` | CEP, resposta permitida pelo contrato, provedor e data/validade. |
| `schema_migrations` | Versão, checksum e data de aplicação. |
| `contas_locais` | `local_id`, `usuario`, `usuario_normalizado`, `estado` (`local_nao_autenticada`, `vinculada`), `firebase_uid` opcional, datas e exclusão lógica. Nome único apenas no aparelho. Sem privilégio remoto. |
| `credenciais_locais` | `local_id` único, `password_hash`, `salt`, `algorithm`, parâmetros de custo e data. Somente credencial da conta provisória; algoritmo próprio para senhas em biblioteca validada, sem hash rápido simples. Não sincronizar, registrar em histórico ou guardar senhas anteriores. |

Algoritmo e biblioteca de derivação devem ser avaliados para Expo antes da implementação, seguindo OWASP. Preferir Argon2id quando suportado; alternativa e custo precisam de decisão técnica e teste no dispositivo. Na ativação online, pedir a senha novamente e autenticar/criar a conta Firebase com e-mail; não tentar recuperar texto puro do hash. Vincular local_id/UID somente após sucesso. Conta local não entra em `usuarios` remotos e não pode possuir vínculos, avaliações ou comandos pendentes de negócio. Exclusão da conta provisória elimina seu verificador conforme política de credenciais; não manter hash antigo por causa da regra de histórico.

Isolar fila, cursor e cache privado por UID. Logout não envia comandos de um usuário com a sessão de outro. Definir limpeza segura sem descartar alterações pendentes silenciosamente.

## 7. Mapeamento proposto no Realtime Database

```text
/v1/public_profiles/{uid}
/v1/private_profiles/{uid}
/v1/access_control/{uid}
/v1/bars/{barId}
/v1/bar_owners/{barId}/{uid}
/v1/user_bars/{uid}/{barId}                  # índice derivado
/v1/menu_items/{itemId}
/v1/bar_menu/{barId}/{itemId}                # índice derivado
/v1/bar_reviews/{barId}/{uid}               # ponteiro para reviewId corrente
/v1/item_reviews/{itemId}/{uid}             # ponteiro para reviewId corrente
/v1/reviews_bars/{reviewId}
/v1/reviews_items/{reviewId}
/v1/owner_requests/{requestId}              # privado
/v1/ownership_requests/{requestId}          # restrito às partes/admin
/v1/ownership_approvals/{requestId}/{uid}/{participationType}
/v1/business_verifications/{verificationId} # privado
/v1/media/{mediaId}                         # metadados conforme escopo
/v1/history/{entityType}/{entityId}/{version}
/v1/admin_events/{eventId}                  # privado
/v1/sync_events/{scope}/{sequence}          # visibilidade por escopo
/v1/operation_receipts/{uid}/{operationId}  # idempotência
```

Estrutura ilustrativa, sujeita ao desenho transacional final. `user_bars`, ponteiros de avaliação e índices são projeções mantidas pelo servidor, não fontes concorrentes de propriedade/autoria. Definir `.indexOn` para consultas efetivamente utilizadas.

Autoridade administrativa não é gravável pelo cliente. Para entidades de negócio, definir escrita direta pelo SDK com regras/transações ou serviço confiável, preservando atomicidade, versão e auditoria imutável. Esse detalhamento ainda não foi concluído. Leituras públicas/privadas são separadas; não liberar leitura da raiz para simplificar sincronização. Regras e eventual serviço têm testes no Emulator Suite.

Navegação não autenticada consulta apenas projeções públicas de bares e endereços; menus, avaliações, perfis e dados privados não devem ficar embutidos nesses nós. `auth == null` não autoriza qualquer escrita. Aprovação de transferência valida unanimidade sobre o snapshot de donos, aceite do destinatário e versão de propriedade; só na conclusão remove o dono selecionado e acrescenta o destinatário. Mudança dos donos invalida a solicitação pendente. Não há bypass administrativo de consentimento aprovado.

## 8. Protocolo de sincronização

1. Transação SQLite registra intenção, alteração visível como pendente e comando na `sync_queue`. Arquivos são copiados para pasta persistente antes de guardar referência.
2. `syncService.js`, serializado por conta e acionado por inicialização, reconexão ou ação explícita, envia operação com ID único e versão-base. NetInfo é indicação de conectividade, não garantia de acesso ao Firebase. Upload de mídia respeita dependências e acesso privado/público.
3. Servidor autentica, verifica status/papel/vínculos atuais e valida payload, pais ativos, unicidade e versão.
4. Servidor grava estado canônico, histórico, índices, recibo e evento de sincronização atomicamente. Atualização multipath resolve atomicidade de escrita; sozinha não faz comparação de versão. A fronteira de transação/serialização para verificar e gravar precisa ser implementada e testada antes de permitir comandos concorrentes.
5. Reenvio do mesmo comando retorna o recibo, sem aplicar novamente. Mesmo ID com payload diferente deve ser rejeitado.
6. Cliente aplica confirmação/eventos numa transação SQLite e avança cursor apenas depois do commit. Alterações locais posteriores não são sobrescritas por confirmações antigas.
7. Conflito de versão preserva base/local/remoto e exige resolução explícita. Sem desempate por relógio do aparelho. Exclusão não é revertida por edição antiga.

Uma sequência monotônica atribuída no servidor, por escopo de leitura, permite paginação sem perder eventos com o mesmo timestamp. Bootstrap faz snapshot com fronteira/cursor consistente e depois reproduz eventos posteriores. Não usar só `updated_at > ultimo_timestamp`. Retenção do log exige detectar cursor expirado e executar novo bootstrap. Logs privados obedecem ao mesmo controle de acesso das entidades.

Operações sobre várias entidades (publicação de bar + itens + donos, mudança de propriedade + elegibilidade das avaliações) exigem comando de domínio atômico ou protocolo de publicação que nunca exponha estado parcial. Exclusões e mudanças de permissão sempre são revalidadas online. Backoff e status visível para erros transitórios; rejeições permanentes não entram em repetição infinita.

## 9. Migrações e validações antes da implementação final

- Definir versões do esquema e protocolo, decisões abertas e limites da transação remota.
- Migração do AsyncStorage faz backup e valida dados antes do commit; credenciais legadas não são sincronizadas. Recriar identidade via Authentication, sem inferir UID pelo nome.
- Importação única dos bares de demonstração, com mapa de IDs e política de autoria explícita. Não executar contra a produção sem conferir o destino.
- Testar dois aparelhos, operações repetidas, queda após commit remoto, concorrência, tombstones, múltiplos donos, transferência expirada, proibição de autoavaliação, banimento durante período offline e isolamento de contas.
- Validar integridade SQLite, atualizações de esquema e consistência entre estado remoto, recibo, histórico e log.
- Testar regras contra autoatribuição de admin, leituras de dados privados, restauração indevida e adulteração de auditoria.

## 10. Referências

- [SQLite no Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Realtime Database: leitura e escrita](https://firebase.google.com/docs/database/web/read-and-write)
- [Realtime Database: segurança](https://firebase.google.com/docs/database/security)
- [Firebase Authentication: gestão administrativa](https://firebase.google.com/docs/auth/admin/manage-users)
