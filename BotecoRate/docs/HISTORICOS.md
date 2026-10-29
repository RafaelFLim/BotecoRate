# Históricos: requisito central

Decisão confirmada em 22/10/2026: históricos devem ser fáceis de localizar e ler. Guardar um JSON sem acesso compreensível não atende sozinho ao requisito.

## Acesso no app

**Minha conta → Painel administrativo → Histórico geral**. É possível buscar tabela/registro, nome ou UID do responsável, ação, data `AAAA-MM-DD` e motivo. No detalhe de um usuário/avaliação também se encontra o histórico daquele registro. Eventos de catálogo mostram as alterações de campos; eventos de administração mostram permissão/estado anterior e novo e justificativa. Registros legados sem responsável aparecem como legado/sistema.

Atualização de identidade em 29/10/2026: alterações de nome online também aparecem como **Nome de usuário**, com antes/depois e versão, no histórico geral/contextual, com as mesmas páginas e busca. `profile_history` permanece imutável; o painel replica o anterior em `usuarios_historico` com ID estável. Valor posterior ausente no legado é indicado como indisponível, sem inventá-lo. A leitura global desses eventos exige admin ativo/verificado. Ver `MEUS_DADOS_E_IDENTIDADE.md`.

O histórico de edições já existente nas telas de avaliações e itens continua acessível. A tela geral desta etapa é administrativa; uma central equivalente de histórico próprio para usuários/donos, com filtros separados de período e campos, faz parte da evolução de usabilidade, não está sendo descrita como pronta.

### Paginação e filtros — 29/10/2026

Paginação é requisito central para históricos e lixeiras. A interface usa `ListaPaginada`, com 20 registros por página, total filtrado, intervalo exibido, página atual e Anterior/Próxima no início e no fim. Trocar de página substitui os cartões, sem acumulá-los, e retorna ao topo do formulário quando disponível. Consultas/filtros novos retornam à primeira página; após uma lista diminuir, a página é limitada ao último número válido. Listas vazias continuam com indicação clara.

O padrão está aplicado ao histórico geral, históricos administrativos contextuais, históricos de propriedade, históricos legados de avaliações/itens e listas de usuários/avaliações do painel (inclusive os registros administrativos excluídos nelas). A lixeira geral e seu expurgo continuam pendentes; deverão reutilizar esse padrão desde sua implementação.

No **Histórico geral → Filtros por bar, dono e endereço**, filtros são combinados com a busca geral:

- Bar: parte do nome atual/anterior ou ID exato.
- Dono atual ou anterior: parte do nome disponível no diretório ou UID exato. É vínculo de propriedade registrado, não autoria da ação; a busca geral continua permitindo procurar o responsável. Convites pendentes não conferem propriedade.
- Endereço: parte da rua, bairro ou cidade atual/anterior. Busca textual ignora acentos e maiúsculas.
- CEP: correspondência exata de oito dígitos, com ou sem hífen. Não deduz CEP a partir da rua; há opção para bares sem CEP registrado.

O contexto associa eventos de bares, itens, avaliações e propriedade ao estabelecimento, inclusive quando excluído ou renomeado, utilizando entidades e histórico disponíveis. Os filtros selecionam o **histórico do bar que tem/teve os dados informados**, não afirmam que o endereço ou dono filtrado existia exatamente na data de cada evento. Alterações de contas sem relação explícita com bar não entram nesses resultados. CEPs antigos ausentes não são inventados; registrar no cadastro/gerenciamento permite consultar dali em diante.

Limite atual: a paginação é de apresentação sobre o snapshot autorizado já carregado, não pagina o download do Realtime Database. Todos os resultados são filtrados/ordenados antes do recorte, com desempate estável. Não afirmar redução do tráfego ou consulta remota por página. Para volumes maiores, evoluir para índice remoto/consulta por cursor com autorização e ordenação equivalentes; as regras de acesso continuam indispensáveis.

Roteiro físico: com mais de 20 eventos, conferir contagem/páginas e navegação sem cartões repetidos; avançar e alterar um filtro (deve voltar à página 1), combinar bar+dono+endereço+CEP, testar resultado vazio, limpar filtros e consultar histórico contextual. Conferir bar renomeado/excluído e CEP não informado. A validação em aparelho físico está pendente.

### Fotos — atualização de 29/10/2026

Mudanças no campo `foto` aparecem como **Foto adicionada**, **Foto substituída** ou **Foto removida**, tanto no histórico geral quanto nos acessos contextuais que usam o mesmo componente. A busca por `foto` ou pelo texto da ação encontra esses eventos, mantendo a busca por registro, responsável, data e motivo. Fotos inalteradas não aparecem como mudança.

A apresentação não imprime Base64, URLs nem caminhos locais, e não carrega imagens ou miniaturas. Responsável, data, versão e demais alterações do evento continuam visíveis. Os snapshots originais permanecem completos: não houve migração, exclusão ou reescrita de auditoria no SQLite/Firebase. As views SQL continuam disponíveis para consulta legível; abrir o JSON bruto ainda permite inspecionar o conteúdo técnico original. Essa preservação não substitui a sanitização futura exigida no expurgo definitivo da lixeira.

Roteiro físico: no painel, abrir Histórico geral após cadastrar/substituir a foto de um bar e de um item. Buscar `foto` e conferir o resumo, a identificação do registro e as outras alterações do mesmo evento. Eventos legados com URL/arquivo local também devem aparecer resumidos; remoções já registradas devem mostrar Foto removida. Não remover uma foto obrigatória do bar apenas para testar. Validação visual em Android/iOS permanece pendente.

## Consultar no SQLite

No inspetor do Expo, selecione `botecorate.db` e use a consulta SQL. Views são consultas prontas; se o visualizador listar só tabelas, elas continuam disponíveis pelo editor SQL.

```sql
SELECT * FROM vw_historico_acessos ORDER BY data DESC;
SELECT * FROM vw_historico_moderacao ORDER BY data DESC;
SELECT * FROM vw_historico_catalogo ORDER BY data DESC;
```

```sql
SELECT data, responsavel, justificativa,
       permissao_anterior, permissao_nova, estado_anterior, estado_novo
FROM vw_historico_acessos
WHERE usuario_id = 'UID_DO_USUARIO'
ORDER BY data DESC;

SELECT data, tabela, registro_id, responsavel,
       estado_anterior, estado_novo, justificativa
FROM vw_historico_moderacao
WHERE data >= '2026-10-01' AND data < '2026-11-01'
ORDER BY data DESC;
```

`vw_historico_catalogo` reúne históricos de bares, itens, avaliações e usuários, com nome/nota/comentário/preço anteriores extraídos em colunas. Atenção: as tabelas legadas guardam o snapshot anterior; essa view não inventa o valor seguinte. O painel usa os pares `before/record` canônicos do Firebase para mostrar a transição completa. `usuarios_historico` inclui o histórico local de nome; não é a fonte das permissões remotas.

Tabelas de origem: `bares_historico`, `itens_cardapio_historico`, `avaliacoes_bares_historico`, `avaliacoes_itens_historico`, `usuarios_historico`, `review_moderation_historico`, `admin_access_historico`. Índices por registro/data/responsável aceleram as consultas. `snapshot_json` continua existindo para conservar evidências; as views evitam sua leitura manual nas consultas usuais.

## Convenção para novas funções

Registrar entidade e ID estáveis, ação, responsável, data, versão, antes/depois e justificativa quando administrativa; salvar junto com o estado na mesma operação; não sobrescrever eventos existentes. Acrescentar acesso contextual ao histórico e uma consulta legível, com exemplos na documentação. Não registrar senhas, hashes/salts de senha, tokens ou chaves.

Após um hard delete, preservar apenas auditoria mínima aprovada: identificação do evento/registro, tipo, ação, responsável, data e motivo sanitizado; remover snapshots e campos que reproduzam o conteúdo excluído. Essa sanitização será implementada na etapa de expurgo da lixeira, em ambiente confiável, e manterá o evento de expurgo localizável.


## Histórico de propriedade — SQLite 5

Em **Minha conta → Propriedade e convites**, há histórico geral da conta e histórico de cada solicitação, com busca e nomes legíveis. A mesma trilha aparece no histórico administrativo. Envio, aceite, recusa, cancelamento, invalidação e conclusão são eventos versionados; ninguém pode apagar ou reescrever uma assinatura pelo app.

```sql
SELECT data, bar, solicitacao_id, responsavel, resposta,
       estado_anterior, estado_novo, convidado_id, substituido_id, motivo
FROM vw_historico_propriedade
ORDER BY data DESC;
```

Origem: `ownership_historico`, com índices por bar/solicitação/data/responsável. `ownership_votes` permite consultar diretamente as assinaturas atuais por usuário. Os snapshots de cada evento guardam os termos e estados escalares antes/depois; o evento registra a resposta individual, sem depender de interpretar o JSON de uma lista de assinaturas. Na promoção consensual, `access_history` conserva papel/estado/versão anteriores sem expor ao dono motivos administrativos privados (`before.redacted`).
