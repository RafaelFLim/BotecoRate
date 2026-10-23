# Históricos: requisito central

Decisão confirmada em 22/10/2026: históricos devem ser fáceis de localizar e ler. Guardar um JSON sem acesso compreensível não atende sozinho ao requisito.

## Acesso no app

**Minha conta → Painel administrativo → Histórico geral**. É possível buscar tabela/registro, nome ou UID do responsável, ação, data `AAAA-MM-DD` e motivo. No detalhe de um usuário/avaliação também se encontra o histórico daquele registro. Eventos de catálogo mostram as alterações de campos; eventos de administração mostram permissão/estado anterior e novo e justificativa. Registros legados sem responsável aparecem como legado/sistema.

O histórico de edições já existente nas telas de avaliações e itens continua acessível. A tela geral desta etapa é administrativa; uma central equivalente de histórico próprio para usuários/donos, com filtros separados de período e campos, faz parte da evolução de usabilidade, não está sendo descrita como pronta.

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
