# Gestão de bares e dependências — 22/10/2026

## Sequência acordada

Implementar e validar um ponto por vez. Esta entrega trata da gestão de bares; Correios, configuração de fotos e testes gerais em dois celulares não foram iniciados nesta rodada. A validação física desta entrega deve acontecer antes de avançar.

| Ponto | Depende de outra frente? | Condição para concluir |
| --- | --- | --- |
| Edição/exclusão de bares | Não depende das telas administrativas; utiliza papel e vínculo existentes | Conta real habilitada como dono vinculado ou admin para validar no aparelho; API para confirmar em outro aparelho |
| Ranking após mudança de dono | Parcialmente: depende dos fluxos autorizados de propriedade | Aprovação, convite, transferência e custódia devem invalidar opiniões na mesma transação/evento que altera o vínculo |
| Correios/CEP | Não depende de administração ou propriedade | Confirmar endpoint e acesso do fornecedor oficial; manter digitação manual, sem trocar de fornecedor silenciosamente |
| Fotos entre aparelhos | Depende da infraestrutura e das permissões remotas existentes | Nesta cópia, upload usa API Flask → bucket privado. Não foi encontrada implementação de upload direto do app ao Storage. Confirmar a arquitetura antes de configurar |
| Testes em dois celulares | Podem começar pelos fluxos entregues | Cobertura dos fluxos administrativos/de propriedade depende dessas entregas; fotos exigem API/bucket configurados |

## Implementado nesta entrega

- Detalhes do bar mostram **Gerenciar bar** apenas para conta ativa/verificada com papel admin, ou dono vinculado por ID. Visitante, local, comum e conta sem confirmação não recebem esse acesso.
- Tela própria altera nome, endereço, detalhes e foto. Valida os mesmos limites de texto do servidor (150/500/5000 caracteres) e coordenadas; campos obrigatórios não podem ser apagados.
- Alterar endereço limpa o pin anterior. É possível definir a posição atual explicitamente estando no bar, ou remover a posição; digitação manual continua disponível. Cardápio e avaliações permanecem sendo gerenciados nas telas existentes.
- O rascunho conserva a versão inicialmente aberta. Dados/versão alterados durante a edição impedem salvar ou excluir sobre a versão antiga; opiniões e itens novos não são sobrescritos por um formulário antigo. Vínculos e autoria não podem ser alterados pelo formulário.
- Operações revalidam a conta e a permissão dentro da gravação local; o servidor revalida a autoridade e a versão ao sincronizar. A confirmação local não equivale a publicação remota. Falhas e conflitos continuam disponíveis na revisão de envios.
- Exclusão exige confirmação e retira bar, cardápio e avaliações da visualização por exclusão lógica em um lote, preservando histórico/autoria. Conclusão volta à lista. O mapa acompanha notificações do catálogo. Não há botão para restaurar.
- Alterações não salvas pedem confirmação ao voltar; gravação impede remoção da tela. Nenhuma mudança de esquema, dependência, credencial ou implantação foi necessária.

## Ranking e contrato para os próximos fluxos

Decisão confirmada pelo usuário: **avaliações invalidadas por vínculo de dono continuam fora após o fim do vínculo, até revisão administrativa**. Não há reabilitação automática.

Na apresentação, `avaliacaoContaNoRanking` considera a elegibilidade confirmada, exclusão e os IDs dos donos atuais. A regra é usada na ordem/medalhas, médias do bar e dos itens e avisos das opiniões; não altera a avaliação de terceiros nem cria comandos de moderação pelo celular.

No servidor, `invalidate_owner_reviews(entities, now, records)` invalida opiniões de donos tanto do bar quanto dos itens, preservando autoria/conteúdo e registrando versão/anterior no mesmo conjunto de mudanças. A função é executada nos comandos existentes para reconciliar dados. Não muda vínculos nem concede permissão e nunca transforma 0 em 1.

**Integração obrigatória ainda pendente:** quem implementar aprovação de dono, copropriedade, transferência e custódia deve chamar essa função dentro da mesma transação que altera os vínculos e publicar os registros retornados no mesmo evento/recibo. Não basta alterar `bar_proprietarios` no aparelho ou editar o RTDB fora desse fluxo. Não existe uma rota nova para mudar propriedade nesta entrega, nem a revisão administrativa para reabilitar opiniões.

Uma edição offline antiga não pode sobrepor uma invalidação remota confirmada na projeção. A inelegibilidade permanece após a saída do dono porque o servidor conserva o valor 0. Os testes de transição usam fixtures; não comprovam convites/transferências ainda inexistentes.

## Verificações e roteiro físico

- `npm test`: 33 aprovados e 5 testes de regras dependentes de emulador pulados no comando comum.
- `npm run test:server` com emulador local: 15 aprovados, incluindo os 3 testes de integração real Admin SDK/RTDB. Sem emulador, os 12 testes de domínio/API passam e os 3 de integração são pulados.
- Bundles Android/iOS gerados em `dist/validacao-gestao-bares`.
- Integração executada no projeto fictício `demo-botecorate`, em `127.0.0.1:19110`, com o JAR já instalado. O comando via `npx firebase-tools` não iniciou por bloqueio de acesso ao npm; foi usado `java -jar .../firebase-database-emulator-v4.11.2.jar --host 127.0.0.1 --port 19110 --single_project_mode Error`, seguido de `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:19110` e `npm run test:server`. O emulador foi encerrado ao concluir. Nenhum dado de produção foi acessado.

No Android/Expo Go:

1. Entrar com conta de e-mail verificada que já tenha papel/vínculo legítimos. Abrir bar → Gerenciar bar; conferir ausência do botão para conta comum e dono de outro bar.
2. Editar nome/detalhes, salvar e conferir lista/detalhes. Abrir novamente para confirmar persistência. Trocar a foto e conferir localmente; distribuição remota da foto depende da infraestrutura.
3. Alterar endereço e conferir remoção do pin anterior. Definir localização atual somente estando no bar; negar permissão e conferir possibilidade de seguir sem pin.
4. Editar e usar Voltar: continuar editando ou descartar. Abrir câmera e retornar sem perder o rascunho. Cancelar a exclusão e conferir que nada mudou.
5. Em bar de teste descartável, confirmar exclusão: conferir retorno à lista e ausência do bar no mapa/ranking. Conferir lote pendente/rejeitado em Revisar envios e conflitos quando não houver API ou permissão remota.
6. Com API disponível, confirmar edição/exclusão no segundo aparelho, concorrência na edição e rejeição após perder permissão. Não trocar papéis somente no SQLite para simular autoridade de produção.

Teste físico e configuração de contas reais ainda não foram executados pelo agente. A documentação anterior de servidor descreve a arquitetura existente; não equivale a implantação disponível. O limite atual do protocolo permanece em 200 alterações explícitas por comando; grandes exclusões com mais registros exigem evolução do protocolo antes de serem suportadas.
