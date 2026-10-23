# Lixeira e retenção — levantamento aprovado

Decisões do usuário em 22/10/2026. Este documento distingue o comportamento já preparado no painel da implementação geral ainda pendente.

## Regras aprovadas

Tudo que o produto permite excluir deve passar pela lixeira. Quem cadastrou ou é dono do estabelecimento correspondente poderá consultar os registros excluídos sob sua responsabilidade, restaurar ou apagar definitivamente. O prazo de restauração é de 30 dias; a interface deve mostrar a data limite e avisar sobre a remoção definitiva. Após o prazo, realizar hard delete mesmo sem o app aberto.

Usuários excluídos e avaliações removidas pela moderação têm lixeira/restauração restritas aos administradores. O autor não pode desfazer uma ação de moderação. Preservar auditoria mínima após a exclusão definitiva, sem conteúdo original.

## Matriz prevista

| Objeto | Quem acessa/restaura a lixeira | Dependências |
| --- | --- | --- |
| Bar | Donos atuais com permissão ativa e admin | Cardápio, avaliações, proprietários e mídia |
| Item de cardápio | Responsável autorizado pelo bar e admin | Avaliações e mídia; manter mínimo de três itens ao excluir |
| Avaliação excluída pelo autor | Próprio autor e admin | Índice de unicidade, ranking e histórico |
| Avaliação excluída por moderação | Somente admin | Não permitir que o autor recrie/restaure para burlar a decisão |
| Conta/usuário excluído por admin | Somente admin | Authentication, diretório, acessos, autoria e custódia dos bares |

Cadastros locais nunca enviados exigem limpeza local; uma alteração já sincronizada precisa de confirmação remota. Perder permissão ou ser banido não concede acesso de restauração. Deixar de ser proprietário também não mantém acesso ao bar apenas por ter criado registros no passado.

## Modelo proposto para a etapa geral

Normalizar `deleted_at`, `deleted_by`, `delete_reason`, `purge_after` (timestamp UTC em milissegundos), `deletion_origin` (autor/admin/cascata), `deletion_group_id` e versão. Um grupo associa a exclusão do pai aos filhos afetados; restaurar o pai não deve restaurar algo que já estava na lixeira antes dele. Mostrar itens com referência ao nome do pai, autor da exclusão, data, dias restantes e ações claras.

Uma restauração exige autorização atual, prazo ainda válido pelo relógio do servidor, pais ativos, invariantes do domínio e confirmação por versão. Restaurar um bar deve recuperar um conjunto coerente com ao menos três itens ativos. Restaurar avaliação não pode violar unicidade autor/alvo. Avisar se houver conflito; não sobrescrever dados novos.

Hard delete manual usa solicitação confirmada e autorizada. O processo confiável remove filhos, índices, conteúdo dos históricos, projeções antigas (`v1/sync`/`catalog` quando aplicáveis), mídia exclusiva e identidade/PII quando se tratar de conta. Autoria histórica preservada por identificador estável ou representação anonimizada. Não apagar um bar em razão exclusiva da exclusão de um dono: aplicar a custódia institucional combinada.

## Expurgo automático e sincronização

Regras do Realtime Database validam operações, mas não executam uma tarefa aos 30 dias. Será necessário um executor confiável agendado (Cloud Functions com Scheduler ou ambiente externo do projeto com Admin SDK). Avaliar custos/infraestrutura antes de ativar: o projeto está no plano Spark; não alterar plano por conta própria.

O processo deve revalidar versão/prazo no momento de apagar, impedir corrida com restauração, ser idempotente, trabalhar em lotes e registrar resultado/falha sem credenciais. Uma execução diária remove na primeira execução após vencimento; se for necessário um limite mais preciso, definir frequência apropriada e monitoramento.

Guardar marcador mínimo de expurgo, sem conteúdo, para negar recriação com o mesmo ID e invalidar filas offline antigas. Snapshot de ausência sozinho não basta: a projeção atual usa soft delete e pode manter conteúdo em réplicas. Na próxima sincronização, SQLite deve remover conteúdo, históricos completos e intenções antigas do registro em uma transação, respeitando as FKs; manter somente auditoria mínima legível. Não há como apagar um aparelho que nunca mais se conecta: a limpeza local também deve verificar o prazo ao abrir o app. Backups técnicos precisam de política de retenção coerente e acesso restrito.

## O que está pronto / pendente

**Pronto nesta etapa:** exclusões administrativas de contas e avaliações possuem motivo, responsável, versão, `deleted_at`, `purge_after` de 30 dias e aviso da data limite. Admin restaura dentro do prazo; o servidor recusa após o prazo. Históricos são legíveis e pesquisáveis. Ocultação de avaliação é uma ação diferente de exclusão.

**Pendente:** tela geral de lixeira por dono/autor, unificação dos campos nas exclusões antigas de bares/itens/avaliações, restauração em cascata, botão de hard delete manual, executor automático, remoção de mídia, anonimização/expurgo de históricos e protocolo de limpeza das réplicas. Não há job agendado e não foi realizado hard delete real nesta etapa. O término dos 30 dias atualmente bloqueia a restauração administrativa, mas não dispara ainda a remoção física.

## Critérios de aceite futuros

Testar propriedade/autoria/admin e revogação, dia 29/limite/dia 31 pelo servidor, restauração concorrente ao expurgo, exclusão de pai com filhos já excluídos, invariantes de três itens/avaliação única, dois aparelhos com filas antigas, mídias compartilhadas, falhas/repetição do job e busca da auditoria mínima após apagar o conteúdo. Somente anunciar limpeza automática quando o executor estiver implantado e observado funcionando.
