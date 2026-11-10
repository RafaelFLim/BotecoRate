# Banco e arquitetura do BotecoRate

Versão documental 2026.11.10.1. Este guia descreve o banco e a arquitetura implementados. O DDL em `src/database/schema.js`, as migrações em `src/database/database.js` e os geradores de regras são as referências executáveis. Propostas antigas foram reunidas no [Histórico e decisões](HISTORICO_E_DECISOES.md).

## Organização da aplicação

O aplicativo usa React Native e Expo em Android e iOS. O SQLite mantém a persistência no aparelho; o SDK modular do Firebase sincroniza registros com o Realtime Database. Firebase Authentication administra as contas de e-mail e senha. A API Flask preservada em `server/` pertence à implementação anterior e às ferramentas administrativas. O aplicativo atual funciona sem manter essa API em execução.

| Área | Referência no projeto | Responsabilidade |
| --- | --- | --- |
| Inicialização e navegação | `App.js` e `src/screens/` | Sessão, telas e integração dos fluxos |
| SQLite | `src/database/database.js`, `schema.js` e stores | Conexão, migrações, consultas e transações |
| Catálogo local | `catalogStore.js`, `syncStore.js` | Projeção, alterações pendentes e réplica confirmada |
| Firebase | `firebaseConfig.js`, `syncTransport.js` | Configuração cliente e acesso pelo SDK |
| Sincronização | `syncService.js`, `directProtocol.js` | Fila, lotes, versões e conflitos |
| Permissões e fluxos | Serviços de administração, propriedade, custódia, CNPJ e lixeira | Comandos de domínio e validação |
| Segurança remota | `scripts/build-direct-rules.cjs` e geradores auxiliares | Produção de `firebase/database.rules.json` |
| Apresentação compartilhada | `Formulario`, `ListaPaginada` e componentes de histórico | Erros, teclado, paginação e leitura |

## Arquivo SQLite e migrações

O arquivo `botecorate.db` é criado no armazenamento privado do aplicativo no celular. O projeto versiona o código que abre o arquivo, cria as tabelas e executa migrações. A sincronização transmite registros JSON; não envia o arquivo SQLite inteiro ao Firebase. Os aparelhos mantêm réplicas distintas.

O esquema atual é a versão 10. A inicialização verifica `PRAGMA user_version`, rejeita um banco de versão superior à suportada, aplica migrações aditivas e registra a execução. Preserva filas e dados existentes. A conexão habilita chaves estrangeiras; alterações de negócio, histórico e fila são gravadas em transação. Não copiar um banco pessoal para o Git como forma de distribuir dados.

| Versão de referência | Evolução |
| --- | --- |
| 1 | Base relacional, contas locais, catálogo, históricos e fila |
| 2 e 3 | Separação entre réplica confirmada, intenções, lotes e compatibilidade da sincronização |
| 4 | Moderação, histórico administrativo e views legíveis |
| 5 | Solicitações e votos de propriedade, histórico e exclusões permanentes do ranking |
| 6 | Histórico de custódia administrativa |
| 7 | Histórico de validação inicial de donos |
| 8 | Histórico de solicitações de exclusão de bar |
| 9 | CNPJ no bar, opções por conta e histórico de CNPJs adicionais |
| 10 | Logradouro, número, complemento, bairro, cidade e UF separados |

## Tabelas de negócio

| Tabela | Conteúdo e relações |
| --- | --- |
| `usuarios` | Identidade local ou Firebase, nome, e-mail em cache, papel, estado e verificação |
| `contas_locais` | Nome normalizado único no aparelho, hash PBKDF2, salt, custo e vínculo opcional com UID |
| `local_login_attempts` | Falhas de autenticação local e bloqueio temporário |
| `ativacoes_conta` | Associação entre identidade local e identidade Firebase após ativação |
| `bares` | Nome, detalhes, foto, endereço completo e partes, CEP, CNPJ, GPS, autoria, datas e versão |
| `bar_proprietarios` | Relação entre bar e usuário, chave composta e exclusão lógica do vínculo |
| `itens_cardapio` | Bar, tipo comida/bebida, nome, descrição, preço em centavos, foto, datas e versão |
| `avaliacoes_bares` | Bar, autor por ID, nome de apresentação, nota, comentário e elegibilidade no ranking |
| `avaliacoes_itens` | Item, autor por ID, nome de apresentação, nota, comentário e elegibilidade |
| `review_moderation` | Estado administrativo da avaliação, motivo, responsável, versão e prazo de restauração |
| `ownership_requests` | Solicitação de inclusão/substituição, destinatário, dono substituído, participantes e versões |
| `ownership_votes` | Decisão por participante e solicitação, com chave composta e FK |
| `ownership_review_exclusions` | Pares bar/usuário que ficam permanentemente fora do ranking |

`created_at`, `updated_at`, `deleted_at` e `version` aparecem nas entidades que precisam deles, conforme o DDL. A autoria de exclusão do catálogo é obtida do evento correspondente; não presumir que todas as tabelas tenham `deleted_by`. Metadados administrativos adicionais podem estar somente no Firebase ou no cache de configurações.

O UID identifica a conta remota. UUIDs identificam entidades geradas no aparelho. Nome de usuário e e-mail não são chaves de propriedade. `criado_por` permanece autoria do cadastro; os vínculos ativos determinam os donos atuais.

## Histórico e infraestrutura local

| Tabela | Finalidade |
| --- | --- |
| `usuarios_historico` | Alterações locais de perfil e projeção das alterações de nome online |
| `bares_historico` | Versões anteriores e ações sobre bares |
| `itens_cardapio_historico` | Versões e alterações do cardápio |
| `avaliacoes_bares_historico` | Alterações de avaliações de bares |
| `avaliacoes_itens_historico` | Alterações de avaliações de itens |
| `admin_access_historico` | Permissão/estado anterior e novo, responsável e justificativa |
| `review_moderation_historico` | Mudanças administrativas de visibilidade/exclusão |
| `ownership_historico` | Antes/depois e decisões de propriedade |
| `custodia_historico` | Abertura e encerramento de custódia |
| `validacao_dono_historico` | Transições de aprovação inicial, sem copiar a documentação privada |
| `bar_exclusao_historico` | Solicitações e aceites para excluir bar compartilhado |
| `cnpj_historico` | Decisões sobre CNPJs adicionais |
| `sync_queue` | Intenções individuais, conta, versão-base, estado, tentativas e falha |
| `sync_entities` | Réplica confirmada e versão canônica por entidade |
| `sync_batches` | Lotes por operação, payload persistido, repetição e próximo envio |
| `sync_conflicts` | Proposta local e resposta remota preservadas para revisão |
| `app_settings` | Configurações e caches auxiliares, com escopo por conta quando necessário |
| `schema_migrations` | Versões aplicadas e data |

### Views para leitura

Use `vw_historico_catalogo`, `vw_historico_acessos`, `vw_historico_moderacao`, `vw_historico_propriedade`, `vw_historico_custodia`, `vw_historico_validacao_dono`, `vw_historico_exclusao_bar` e `vw_historico_cnpj`. Elas transformam campos JSON em colunas legíveis. A disponibilidade dos registros depende do que foi sincronizado ou carregado pelo painel nessa réplica.

```sql
PRAGMA user_version;
PRAGMA foreign_key_check;
SELECT name, type FROM sqlite_master
WHERE type IN ('table', 'view') ORDER BY type, name;

SELECT * FROM vw_historico_catalogo
ORDER BY data DESC, id DESC LIMIT 20 OFFSET 0;

SELECT data, responsavel, justificativa,
       permissao_anterior, permissao_nova
FROM vw_historico_acessos
WHERE usuario_id = 'UID_DO_USUARIO'
ORDER BY data DESC LIMIT 20 OFFSET 0;

SELECT id, nome, endereco, cep FROM bares
WHERE deleted_at IS NULL AND cep = '27700000'
ORDER BY nome, id LIMIT 20 OFFSET 0;
```

Tabelas legadas podem guardar apenas o snapshot anterior. A view não inventa o valor seguinte. O histórico canônico remoto mantém pares de estado anterior e confirmado; a interface usa os pares disponíveis para mostrar as mudanças.

## Integridade e ranking

Preços são inteiros positivos em centavos. Notas são inteiros de 1 a 5. Coordenadas são preenchidas em par e respeitam os limites geográficos. Índices únicos parciais impedem duas avaliações ativas do mesmo autor para o mesmo alvo. FKs relacionam bares, itens, usuários, avaliações e votos; índices atendem consultas por pai, estado e histórico.

O remoto também valida autoria, versão, permissão e unicidade entre aparelhos. Três referências distintas do bar apontam para itens ativos; publicar ou alterar o cardápio precisa preservar o mínimo. Propriedade e ranking são atualizados de forma coerente. Uma réplica offline antiga não pode reabilitar avaliação inelegível.

O endereço tem `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf` e o texto de exibição `endereco`. Ao informar o conjunto estruturado, rua, número ou S/N, cidade e UF são necessários. Bairro e complemento são opcionais. A migração preserva o texto legado sem tentar separar palavras por inferência. CEP conhecido tem oito dígitos; ausente fica nulo. CNPJ do catálogo autenticado não é exposto na projeção pública.

## Estrutura do Realtime Database

Os caminhos abaixo ficam sob `v1/`. O Realtime Database apresenta nós JSON na aba Dados. As contas de login são consultadas separadamente em Authentication → Users.

| Caminho relativo | Finalidade |
| --- | --- |
| `access_control/{uid}` | Papel e estado autorizativos |
| `access_history` | Auditoria das mudanças de acesso |
| `user_directory/{uid}` | Diretório administrativo privado |
| `public_profiles`, `private_profiles` | Projeções de perfil com acessos distintos |
| `username_index/{chave}` | Reserva global de nome normalizado por UID |
| `profile_history` | Alterações imutáveis de nome |
| `ownership_accounts/{uid}` | Cartão mínimo para identificação de convidados |
| `owner_approvals/{uid}` | Solicitação inicial vigente de habilitação |
| `owner_approval_history/{uid}/{versao}` | Histórico privado da aprovação inicial |
| `owner_cnpjs/{uid}/{cnpj}` | Pedidos e decisões de CNPJs adicionais |
| `owner_cnpj_history/{uid}/{cnpj}/{versao}` | Histórico desses pedidos |
| `custody`, `custody_history` | Gestão administrativa temporária e histórico |
| `direct/entities` | Registros canônicos de bares, itens e avaliações |
| `direct/owners` | Donos confirmados por bar |
| `direct/history` | Auditoria por entidade/versão e operação |
| `direct/public_bars` | Consulta pública limitada do catálogo |
| `direct/review_index` | Unicidade de avaliações por autor/alvo |
| `direct/moderation`, `direct/moderation_history` | Estado e histórico de moderação |
| `direct/ownership_state`, `direct/ownership_requests` | Propriedade e solicitações de alteração |
| `direct/ownership_history`, `direct/ownership_epoch` | Auditoria e invalidação de propostas antigas |
| `direct/bar_deletions`, `direct/bar_deletion_history` | Consenso e histórico para exclusão de bar |
| `direct/cnpj_usage/{uid}/{cnpj}` | Reserva de CNPJ no cadastro do bar |
| `direct/deletion_times/{tabela}/{id}/{versao}` | Data de exclusão confirmada pelo servidor |
| `migrations` | Marcadores de preparação/importação |

`v1/sync` e `v1/catalog` preservam o modelo anterior. Não recebem os novos envios e não devem ser tratados como catálogo atual. A estrutura completa de cada comando e os nomes dos históricos privados estão nos respectivos serviços e geradores; a tabela resume os pontos de consulta.

## Protocolo de sincronização

1. O usuário altera o catálogo no SQLite. A transação mantém conteúdo, histórico local e intenção na fila da conta.
2. O serviço serializa os envios, consulta conectividade e prepara lote estável com ID de operação, conteúdo e versões-base. NetInfo não garante que o Firebase esteja acessível.
3. `syncTransport.js` usa `get` e `update` do SDK modular. A escrita de múltiplos caminhos inclui entidades, índices, projeção e auditoria. As regras verificam a transição e as versões no servidor.
4. O cliente remove o lote somente após confirmação. Reenvio com o mesmo ID e conteúdo é reconhecido; reutilização do ID com outro conteúdo é recusada. Falhas transitórias mantêm fila e repetição com intervalo. Conflitos/rejeições exigem revisão.
5. O download integral atualiza a réplica confirmada em transação e recompõe a projeção com as intenções da conta atual. Pendências de outra conta não são exibidas nem enviadas pela sessão errada.

Permissões administrativas, convites, decisões e restaurações exigem conexão e confirmação remota. Papéis em cache não concedem autoridade. É necessário revalidar acesso atual, versão dos donos e marcadores de invalidação. Não usar o horário do aparelho para decidir precedência entre edições.

Conflitos preservam as propostas. A ação Usar servidor pode descartar o conjunto de pendências da conta; a interface deve explicar seu alcance antes da confirmação. Edição antiga não reverte tombstone de exclusão.

### Limites atuais

O download é integral. A paginação das telas recorta o snapshot autorizado já carregado; não reduz o tráfego por página. Não há cursor incremental geral implantado nem compactação de auditoria. A filtragem pessoal da lixeira na interface não equivale a uma nova política de isolamento do snapshot remoto. Uma evolução de escala deve definir índices, cursores, retenção e regras de leitura em conjunto.

## Fotos e endereço

Fotos novas são reduzidas e convertidas para JPEG Base64, com `data:image/jpeg;base64,...`, no RTDB. A conversão ocorre na preparação do envio e o resultado persistido é reutilizado nas tentativas. O limite atual é 163.840 caracteres por data URI e 8.388.608 bytes por escrita de sincronização, em `src/constants/photoLimits.cjs`. URLs HTTPS legadas continuam admitidas conforme as regras. Caminhos locais do aparelho não viram caminhos compartilhados.

O fluxo atual dispensa Firebase Storage e alteração do plano Spark. O código e as regras antigos de Storage permanecem como preparação histórica. Não anunciar Storage habilitado. Históricos exibem Foto adicionada/substituída/removida, sem imprimir Base64 ou carregar miniaturas; os snapshots brutos ainda conservam o conteúdo até o futuro expurgo.

O provedor de CEP implementado é ViaCEP, com prévia e ação Usar este endereço. O CEP geral pode retornar cidade e UF sem rua ou bairro. O preenchimento manual continua disponível sem rede e as partes ficam no estado do formulário. Número e complemento não invalidam a consulta aplicada; mudança geográfica exige revisão do CEP e da posição. CEP não determina o ponto GPS do bar. A integração contratada dos Correios continua pendente.

## Exclusão e restauração

`deleted_at` indica exclusão lógica; pais excluídos retiram seus conteúdos das consultas. Restauração online valida autor da exclusão ou admin, autorização atual, prazo de 30 dias e integridade dos pais. A referência de prazo vem do servidor em `deletion_times`. Exclusões antigas só recebem referência quando o histórico da mesma versão comprova a operação.

A cascata usa a identificação da operação de exclusão. Restaurar o pai recupera somente filhos elegíveis daquele grupo. Não restaura automaticamente filho previamente excluído, avaliação moderada ou substituída por outra do mesmo autor. O bar deve retornar com pelo menos três itens ativos. A restauração gera versão e histórico próprios.

O hard delete manual e o executor após 30 dias ainda precisam de implementação. O futuro expurgo deve remover conteúdo, índices, mídia exclusiva e snapshots completos, preservar auditoria mínima, impedir reenvio de fila antiga e limpar réplicas conectadas. Regras RTDB não executam tarefas agendadas. A infraestrutura confiável precisa ser definida sem presumir mudança de plano.

## Segurança e operação administrativa

Regras remotas validam usuário ativo, e-mail verificado, papel e vínculo. Administração não depende de esconder botões. Alterações de perfil não podem promover o usuário. Históricos aceitos são imutáveis. Operações devem registrar motivo e responsável sem credenciais.

A conta de serviço fica fora do código cliente e ignorada pelo Git. Os identificadores `EXPO_PUBLIC_*` são configuração pública incorporada ao app; não substituem autorização. Senhas, tokens, salts e hashes locais não entram na auditoria de negócio nem na sincronização remota.

Banimento/exclusão no painel controla o estado do aplicativo em `access_control`. Desabilitar ou apagar uma identidade no Authentication por Admin SDK é uma operação administrativa distinta e requer ambiente confiável; não presumir uma transação conjunta entre Auth e RTDB. O histórico preservado em `server/` não transforma essa reconciliação em requisito de execução da API para o app.

As rotinas `python -m server.manage` promovem administradores no bootstrap, importam demonstrações e preparam índices/diretórios. Exigem projeto confirmado e ator administrativo ativo/verificado quando aplicável. Consultar os procedimentos no [Guia de desenvolvimento e testes](DESENVOLVIMENTO_E_TESTES.md).
