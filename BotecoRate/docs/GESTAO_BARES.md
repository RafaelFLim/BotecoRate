# Gestão de bares e dependências — atualizado em 27/10/2026

Atualização em 26/10/2026: usuário autorizou ViaCEP em substituição a Correios. Consulta implementada conforme [Consulta de CEP](INTEGRACAO_CEP.md); usuário confirmou CEP normal/geral e modo manual sem rede em 27/10/2026. O fluxo atual usa sincronização direta, conforme `SINCRONIZACAO_DIRETA.md`.

## Sequência acordada

Implementar e validar um ponto por vez. A entrega original tratou da gestão de bares; a consulta de CEP com ViaCEP foi acrescentada em 26/10/2026. Fotos foram adaptadas em 27/10/2026 para Base64 no RTDB conforme `FOTOS_BASE64.md`; validações publicadas pelo usuário e fluxo confirmado nos dois Android. Cobertura concluída e ressalvas registradas em `TESTES_INTEGRADOS_2_CELULARES.md`.

| Ponto | Depende de outra frente? | Condição para concluir |
| --- | --- | --- |
| Edição/exclusão de bares | Não depende das telas administrativas; utiliza papel e vínculo existentes | Conta real habilitada como dono vinculado ou admin para validar no aparelho; Firebase para confirmar em outro aparelho |
| Ranking após mudança de dono | Parcialmente: depende dos fluxos autorizados de propriedade | Aprovação, convite, transferência e custódia devem invalidar opiniões na mesma transação/evento que altera o vínculo |
| CEP/ViaCEP | Não depende de administração ou propriedade | Implementado após autorização de 26/10/2026; validar no aparelho conforme `INTEGRACAO_CEP.md` |
| Fotos entre aparelhos | Depende da infraestrutura e das permissões remotas existentes | JPEG Base64 no RTDB implementado e publicado; fotos de bar/item confirmadas entre os dois Android, conforme `TESTES_INTEGRADOS_2_CELULARES.md` |
| Testes em dois celulares | Cenários disponíveis concluídos nos dois Android | Matriz aprovada por relato em `TESTES_INTEGRADOS_2_CELULARES.md`; conta comum/dono sem vínculo e iOS continuam pendentes |

## Implementado nesta entrega

- Detalhes do bar mostram **Gerenciar bar** apenas para conta ativa/verificada com papel admin, ou dono vinculado por ID. Visitante, local, comum e conta sem confirmação não recebem esse acesso.
- Tela própria altera nome, endereço, detalhes e foto. Valida os mesmos limites de texto do servidor (150/500/5000 caracteres) e coordenadas; campos obrigatórios não podem ser apagados.
- Alterar endereço limpa o pin anterior. É possível definir a posição atual explicitamente estando no bar, ou remover a posição; digitação manual continua disponível. Cardápio e avaliações permanecem sendo gerenciados nas telas existentes.
- O rascunho conserva a versão inicialmente aberta. Dados/versão alterados durante a edição impedem salvar ou excluir sobre a versão antiga; opiniões e itens novos não são sobrescritos por um formulário antigo. Vínculos e autoria não podem ser alterados pelo formulário.
- Operações revalidam a conta e a permissão dentro da gravação local; as regras do Firebase revalidam a autoridade e a versão ao sincronizar. A confirmação local não equivale a publicação remota. Falhas e conflitos continuam disponíveis na revisão de envios.
- Exclusão exige confirmação e retira bar, cardápio e avaliações da visualização por exclusão lógica em um lote, preservando histórico/autoria. Conclusão volta à lista. O mapa acompanha notificações do catálogo. Não há botão para restaurar.
- Alterações não salvas pedem confirmação ao voltar; gravação impede remoção da tela. Nenhuma mudança de esquema, dependência, credencial ou implantação foi necessária.

## Ranking e contrato para os próximos fluxos

Decisão confirmada pelo usuário: **avaliações invalidadas por vínculo de dono continuam permanentemente fora após o fim do vínculo**. Não há reabilitação automática.

Na apresentação, `avaliacaoContaNoRanking` considera a elegibilidade confirmada, exclusão e os IDs dos donos atuais. A regra é usada na ordem/medalhas, médias do bar e dos itens e avisos das opiniões; não altera a avaliação de terceiros nem cria comandos de moderação pelo celular.

A sincronização atual ocorre diretamente entre SQLite e Firebase, sem depender da API Flask. Convites e transferências registram provas de aceite e exclusões permanentes de ranking; a projeção SQLite preserva a elegibilidade original e aplica essas exclusões. O histórico de propriedade mostra participantes, respostas e alterações. Ver `COPROPRIEDADE_E_TRANSFERENCIA.md`.

O código legado Python mantém `invalidate_owner_reviews` para seus comandos e testes; essa função não é uma dependência do fluxo direto. Validação documental de donos e custódia administrativa continuam pendentes e deverão respeitar a mesma decisão de ranking.

Uma edição offline antiga não pode sobrepor uma invalidação remota confirmada. Não há fluxo para reabilitar avaliações de ex-donos.

## Integração de 23/10/2026

A entrega foi integrada ao painel administrativo e à copropriedade. Exportações Android/iOS e os 30 testes da suíte direta Firebase passaram. Incluído teste de regressão conjunta: editar o bar mantém a opinião oculta intacta, conserva a exclusão permanente do ranking após saída do dono e enfileira apenas a alteração do bar. Nenhum esquema/dependência/regra remota adicional foi necessário para a integração. Teste físico segue pendente.

## Verificações da entrega original e roteiro físico

- `npm test`: 33 aprovados e 5 testes de regras dependentes de emulador pulados no comando comum.
- `npm run test:server` com emulador local: 15 aprovados, incluindo os 3 testes de integração real Admin SDK/RTDB. Sem emulador, os 12 testes de domínio/API passam e os 3 de integração são pulados.
- Bundles Android/iOS gerados em `dist/validacao-gestao-bares`.
- Integração executada no projeto fictício `demo-botecorate`, em `127.0.0.1:19110`, com o JAR já instalado. O comando via `npx firebase-tools` não iniciou por bloqueio de acesso ao npm; foi usado `java -jar .../firebase-database-emulator-v4.11.2.jar --host 127.0.0.1 --port 19110 --single_project_mode Error`, seguido de `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:19110` e `npm run test:server`. O emulador foi encerrado ao concluir. Nenhum dado de produção foi acessado.

No Android/Expo Go:

1. Entrar com conta de e-mail verificada que já tenha papel/vínculo legítimos. Abrir bar → Gerenciar bar; conferir ausência do botão para conta comum e dono de outro bar.
2. Editar nome/detalhes, salvar e conferir lista/detalhes. Abrir novamente para confirmar persistência. Trocar a foto e conferir localmente; distribuição remota da foto depende da infraestrutura.
3. Alterar endereço e conferir remoção do pin anterior. Definir localização atual somente estando no bar; negar permissão e conferir possibilidade de seguir sem pin.
4. Editar e usar Voltar: continuar editando ou descartar. Abrir câmera e retornar sem perder o rascunho. Cancelar a exclusão e conferir que nada mudou.
5. Em bar de teste descartável, confirmar exclusão: conferir retorno à lista e ausência do bar no mapa/ranking. Conferir lote pendente/rejeitado em Revisar envios e conflitos quando não houver conexão com Firebase ou permissão remota.
6. Com Firebase disponível, confirmar edição/exclusão no segundo aparelho, concorrência na edição e rejeição após perder permissão. Não trocar papéis somente no SQLite para simular autoridade de produção.

Teste físico e configuração de contas reais ainda não foram executados pelo agente. A documentação de servidor preserva o histórico da arquitetura anterior; o app atual utiliza sincronização direta com Firebase. O limite atual do protocolo permanece em 200 alterações explícitas por comando; grandes exclusões com mais registros exigem evolução do protocolo antes de serem suportadas.
