# Copropriedade e transferência

Implementação iniciada em 22/10/2026 e conferida em 23/10/2026. **Minha conta → Propriedade e convites**. Conta Firebase ativa e e-mail verificado são obrigatórios. Ações exigem internet; a última consulta e o histórico podem ser vistos offline pela mesma conta no aparelho.

## Uso

1. A pessoa convidada abre esse menu e compartilha seu código de convite (UID, texto selecionável). Não compartilhar senha nem credenciais. A escolha por UID evita expor o diretório privado de e-mails.
2. Um dono atual escolhe seu bar e **Adicionar coproprietário** ou **Substituir um proprietário**. Na substituição escolhe explicitamente quem sai; os demais permanecem. Informa UID de quem entra e motivo.
3. O app confere o nome da conta convidada e pede confirmação dos termos. Enviar não representa aceite automático: todos os donos atuais, inclusive quem envia e quem sai, e a pessoa convidada devem aceitar explicitamente.
4. Cada envolvido encontra a solicitação no próprio menu, confere os envolvidos/termos e aceita ou recusa. Os aceites podem chegar em qualquer ordem. Uma recusa encerra a solicitação; quem a criou pode cancelar enquanto pendente.
5. Após os aceites, o app confere as assinaturas e conclui a mudança em uma escrita atômica. Só então muda os donos. Se uma conexão cair após registrar um aceite, atualizar a tela permite conferir o resultado e continuar; assinaturas e conclusão não são duplicadas por reenvio.

O botão **Concluir aceites registrados** permite retomar conferências interrompidas. Em solicitações muito grandes, o app confere até 32 assinaturas por chamada e permite continuar. Não existe alteração parcial dos donos enquanto isso. Usar **Atualizar** para receber respostas de outro aparelho; não há envio de e-mail, push ou monitoramento em segundo plano nesta etapa.

Convite pendente não concede acesso ao bar. O convidado pode começar como usuário comum; na conclusão recebe `dono`, mantendo `ativo`, com evento de acesso auditado vinculado à solicitação. Quem já é admin/dono mantém seu papel. Nunca se concede admin por convite. A saída do último bar não rebaixa automaticamente a permissão global; permissões continuam administráveis no painel.

O admin pode administrar o conteúdo de qualquer bar, mas **não tem bypass** para aprovar ou iniciar uma transferência comum se não for dono do bar. As regras exigem os mesmos aceites. Banimento/custódia institucional é fluxo separado.

## Invalidação e segurança

- Cada bar possui revisão e índice canônico de donos. Uma mudança concluída invalida propostas baseadas no conjunto anterior, inclusive solicitações concorrentes. Não são reaproveitados os aceites: criar nova solicitação.
- Mudanças administrativas de papel/estado incrementam um marcador global de acesso (`ownership_epoch`). Por segurança, **todas** as solicitações pendentes anteriores precisam ser refeitas, inclusive as de outros bares. É uma invalidação conservadora e explícita; evita concluir com assinatura de alguém banido ou rebaixado durante o processo. Promoção automática de comum para dono pela própria conclusão não incrementa esse marcador, pois apenas amplia a capacidade e a revisão do bar já invalida os demais convites dele.
- Bar excluído não pode ser transferido. Donos/convidados inativos ou não verificados precisam regularizar o acesso; não omitir um dono indisponível. O criador pode cancelar; solicitações com revisão/marcador antigo podem registrar invalidação.
- Identidades são os UIDs estáveis; nomes mostrados vêm do perfil atual. Alterar o nome não substitui o destinatário. Termos, destinatário, substituído e conjunto exigido são imutáveis.
- Cada conta escreve apenas o próprio aceite/recusa, uma vez. Estado/versionamento e histórico são validados no servidor. Nem um admin pode editar uma assinatura existente pelo SDK do app.
- Alterações feitas diretamente por ferramentas administrativas/console precisam respeitar o protocolo. Modificar somente Authentication fora do app não equivale a atualizar o controle de acesso do BotecoRate; usar o painel para banir/rebaixar e a ferramenta de preparação para revisar os índices quando necessário.

## Como as regras comprovam unanimidade

Realtime Database Rules não oferece iteração arbitrária nem `numChildren()`. Não se usa contagem enviada pelo cliente como prova de unanimidade. O índice canônico registra uma ordem delimitada de UIDs; a solicitação copia essa ordem e acrescenta o convidado. As assinaturas ficam em folhas imutáveis separadas. A conferência avança exatamente um UID por versão e somente se a assinatura correspondente já existe; não é a ordem em que as pessoas precisam responder.

O índice inicial exige exclusivamente o criador do bar. Em cada conclusão, sua próxima forma é derivada exatamente da anterior: acrescentar destinatário ou substituir o UID escolhido. As folhas de `owners` permitem apenas essa inclusão e essa remoção. Assim não é possível omitir donos, inventar aceites, remover coproprietários extras ou concluir uma solicitação com revisão vencida. O relógio/data e contador exibidos não são usados como prova de identidade ou unanimidade.

Os dados do bar e seu `criado_por` não são reescritos na transferência. A exigência antiga de que o criador permanecesse para sempre na lista de donos foi retirada somente para bares existentes; a criação continua exigindo autoria e propriedade válidas.

## Firebase

| Caminho | Conteúdo |
| --- | --- |
| `v1/direct/owners/{bar}/{uid}` | Vínculos atuais, booleanos |
| `v1/direct/ownership_state/{bar}` | Revisão, ordem canônica, última solicitação e responsável/data |
| `v1/direct/ownership_requests/{bar}/{id}` | Termos, destinatário, substituído, revisão-base, estado e assinaturas |
| `v1/direct/ownership_history/{bar}/{id}/{version}` | Evento imutável, responsável, resposta e estados escalares antes/depois |
| `v1/direct/ownership_epoch` | Marcador global de invalidação por alteração administrativa de acesso |
| `v1/ownership_accounts/{uid}` | Nome, verificação e projeção de papel/estado/versão; sem e-mail ou motivo administrativo |

Somente contas ativas/verificadas consultam as solicitações junto do catálogo autenticado. O app filtra as que envolvem a conta; o caminho `direct` é compartilhado com os demais dados de negócio e **não oferece sigilo entre usuários verificados**. Não registrar documentos pessoais nem e-mails nesses caminhos. O perfil para convites pode ser consultado individualmente por UID; não há listagem pública de contas/e-mails. O diretório privado continua em `user_directory`.

A projeção de acesso é validada contra a autoridade real. Na promoção consensual, o histórico guarda papel, estado e versão anteriores, com `redacted: true` quando já havia autoridade, sem copiar motivos privados que os donos não podem ler. A promoção e o novo vínculo só são aceitos junto da conclusão validada. Alterações administrativas comuns continuam com o histórico completo antes/depois.

## SQLite versão 5

Migração aditiva a partir da versão 4; não apaga fila, contas, bares ou históricos anteriores.

- `ownership_requests`: projeção das solicitações; chave composta bar/ID para impedir colisões entre bares.
- `ownership_votes`: respostas normalizadas por bar/solicitação/usuário, com FK composta.
- `ownership_historico`: eventos duráveis por bar/solicitação/versão, resposta, responsável e antes/depois.
- `ownership_review_exclusions`: exclusão permanente do ranking por bar/usuário que foi proprietário, derivada de conclusões válidas.
- `vw_historico_propriedade`: consulta legível, com bar, solicitação, responsável, resposta, estado antigo/novo, quem entra/sai, motivo e quantidade de aceites.

O snapshot do Firebase replica solicitações e eventos na mesma transação da sincronização. A tela também guarda a última consulta por UID, permitindo leitura offline sem misturar contas. Ações de propriedade não entram na fila offline do catálogo.

```sql
SELECT data, bar, responsavel, resposta, estado_anterior, estado_novo,
       convidado_id, substituido_id, motivo
FROM vw_historico_propriedade
ORDER BY data DESC;

SELECT * FROM vw_historico_propriedade
WHERE bar_id = 'ID_DO_BAR'
  AND data >= '2026-10-01' AND data < '2026-11-01'
ORDER BY data DESC;
```

No app, usar o histórico geral da tela, o histórico de cada convite ou o histórico administrativo. Busca por bar, responsável, UID, motivo, data e ação. Apresentação mostra nomes, quem entra/sai e respostas; JSON permanece como evidência, não como único meio de leitura.

## Avaliações e ranking

Decisão confirmada nesta etapa: avaliações anteriores de alguém que vira dono permanecem visíveis e **continuam fora do ranking mesmo após sua saída da propriedade**. A interface avisa o motivo. A autoria e a opinião originais são mantidas, sem reescrever a avaliação ou enfileirar uma edição fictícia só para mudar a média. As conclusões de propriedade e a exclusão local durável permitem reconstruir essa regra em outro aparelho. Avaliações ocultas/excluídas pela moderação seguem fora da exibição/ranking conforme o fluxo administrativo.

Na futura política de expurgo, preservar a evidência mínima da inelegibilidade ou uma projeção equivalente; apagar apenas uma solicitação não pode fazer a avaliação voltar a contar. Lixeira geral e custódia continuam sendo etapas próprias, descritas nas documentações correspondentes.

## Preparação e validação

A ferramenta administrativa `python -m server.manage prepare-ownership --actor-uid UID_ADMIN_VERIFICADO --confirm-project botecorate`, com as variáveis administrativas locais já existentes, prepara índices para bares antigos e perfis mínimos a partir do Authentication. É aditiva/idempotente e recusa índice divergente. Não transfere bares, cria convites nem concede papéis. Credenciais administrativas nunca vão para o app.

Validado com SQLite real, serviço de aplicação e Firebase Emulator: aceita fora de ordem, adição/substituição, todos os donos incluindo o substituído, assinatura forjada, alteração de termos, histórico imutável, promoção consensual, proteção de motivos privados, perda de permissão, invalidação, recusa/cancelamento, fila offline, concorrência e confirmação perdida após o commit. Exportações Android/iOS e teste físico têm registros no plano e no roteiro; compilar não substitui testar gestos e telas no aparelho.


Resultado final: 41 testes locais aprovados, com 23 de emulador pulados nessa execução; 30 aprovados na execução específica do Firebase Emulator; 14 Python aprovados e 2 pulados. Exportações Android/iOS e scanner de segredos aprovados. Regras publicadas e relidas; quatro índices de bares e três perfis mínimos conferidos no Firebase, sem transferir bares reais. Teste físico Android/iOS permanece pendente.
