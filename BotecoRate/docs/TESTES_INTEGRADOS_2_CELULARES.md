# Testes integrados em dois celulares — 27/10/2026

## Situação consolidada

Implementações da frente de Emanuel e cenários disponíveis nos dois Android concluídos em 27/10/2026, por confirmação do usuário. Fotos Base64, offline, troca de conta, conflito, gestão, CEP e navegação funcionaram nos casos orientados. T10 (conta comum/dono sem vínculo) e iOS não foram validados fisicamente. Galeria e puxar para atualizar são melhorias futuras. A matriz abaixo preserva a evidência e os limites de cada resultado.

## Escopo e preparação

Último ponto previsto da responsabilidade de Emanuel: validar gestão/CEP/fotos e funcionamento entre aparelhos. Corrigir problemas encontrados nesses fluxos sem desenvolver validação de donos, custódia ou outras frentes do colaborador.

Usuário confirmou **dois Android**, com **duas contas admin/donas**, em Expo Go. Ainda não foi informada uma conta comum disponível. Não alterar papéis de contas reais para simular testes. Cada celular deve usar a versão atual do projeto e uma conta de e-mail verificada; identificar apenas como A e B, sem registrar senhas/tokens.

Usar um estabelecimento de teste com autorização e sem trabalho pendente de terceiros. A deve poder administrá-lo. Para o cenário de conflito, ambas as contas precisam legitimamente poder editar o mesmo bar. Antes de começar, conferir **Revisar envios e conflitos**; não descartar propostas preexistentes para limpar um teste.

No Expo Go, recarregar/abrir o projeto pode precisar do Metro pela rede, independentemente de o SQLite funcionar offline. Não interpretar falha ao baixar o bundle sem rede como perda do banco. Fazer as edições offline com o app já aberto. A inicialização totalmente offline de um aplicativo instalado exige validação separada em build apropriada.

## Registro dos cenários

| ID | Cenário | Estado e evidência |
| --- | --- | --- |
| T01 | Foto de bar editada offline, salva e enviada após reconectar | **Aprovado pelo usuário**: updated_at em entities mudou e status confirmou sincronização |
| T02 | Nova foto de bar recebida/renderizada no outro aparelho | **Aprovado pelo usuário** |
| T03 | Atualização manual pelo status na lista | **Aprovado pelo usuário**, depois de esclarecer que o texto é clicável |
| T04 | Foto de item recebida no outro aparelho | **Aprovado pelo usuário** após executar o bloco 1 |
| T05 | Persistência após fechar/reabrir e download de foto recebido | **Aprovado pelo usuário**: foto permaneceu ao reabrir o segundo Android |
| T06 | Alterações offline preservadas ao sair/voltar ao primeiro plano | **Aprovado pelo usuário**: edição salva offline permaneceu após alternar aplicativo e chegou a B ao reconectar |
| T07 | Troca de conta com fila pendente, sem expor/enviar proposta da conta anterior | **Aprovado pelo usuário no fluxo conta Firebase → local → original**: alteração só chegou a B após retornar à conta original |
| T08 | Duas edições concorrentes geram conflito sem sobrescrever versão confirmada | **Aprovado pelo usuário**: B detectou conflito e preservou sua proposta; A manteve “Teste A”; após usar servidor, B passou a mostrar “Teste A”. Ausência de pendências após resolução ainda não informada explicitamente |
| T09 | Visitante e conta local não administram bares | **Aprovado pelo usuário**: visitante e conta local sem + Bar/administração, com restrição Somente consulta |
| T10 | Conta comum/dono de outro bar respeita permissão | Requer conta com o papel/vínculo adequado; duas contas administrativas não cobrem a negativa |
| T11 | Edição/exclusão lógica e chegada ao segundo aparelho | **Propagação aprovada pelo usuário**: edição já recebida; bar descartável excluído desapareceu em A/B e continuou ausente após reabrir B. Histórico da exclusão não inspecionado fisicamente |
| T12 | ViaCEP, CEP geral e digitação manual sem rede | **Aprovado pelo usuário**: CEP 01001-000, CEP geral 27700-000, complemento manual e falha recuperável sem rede; roteiro sem salvar alterações |
| T13 | Botão/gesto Voltar do Android, retorno da câmera e rascunhos | **Aprovado pelo usuário**: gesto e botão Voltar, aviso continuar/descartar e retorno da câmera preservando texto/foto; descarte mantém dados salvos |

Os 88 testes automatizados anteriores passaram, incluindo duas réplicas SQLite e regras no emulador. Isso não aprova automaticamente nenhum cenário físico acima. Registrar cada retorno, mensagem exata e aparelho envolvido.

## Bloco 1 — foto de item e persistência

1. Deixar A e B online, cada um em sua conta. Atualizar o catálogo tocando no texto do status na lista. Confirmar que não há erros/pendências anteriores que bloqueiem os envios.
2. Em A, abrir o cardápio de um bar de teste autorizado, editar um item, tirar uma nova foto e salvar. Voltar à lista e atualizar até aparecer **Catálogo sincronizado com o Firebase**.
3. Em B, atualizar, abrir o mesmo item e conferir a imagem, sua proporção e orientação. É preciso observar uma foto nova, não apenas a imagem antiga em cache.
4. Fechar completamente o Expo Go de B e reabrir com rede disponível. Conferir novamente a foto recebida. Relatar o resultado de T04 e T05 antes do próximo bloco.

## Bloco 2 — offline e troca para conta local

Usar uma conta local de teste no celular A, pois ela permite entrar sem Internet e não exige alterar os papéis de usuários Firebase. Pode-se criá-la antes de começar, mantendo-a sem vínculo online.

1. A e B devem estar online e sem pendências anteriores. Anotar o nome atual de um bar autorizado, que permanecerá identificável pelo ID.
2. Em A, com a conta de e-mail autorizada e o app já aberto, desligar a Internet. Acrescentar “Teste de conta A” ao nome do bar e salvar. Ir ao segundo plano e voltar; a edição local deve permanecer.
3. Ainda offline, sair da conta de e-mail e entrar na conta local. A lista deve mostrar o nome confirmado anterior, não a proposta pendente da conta de e-mail. Não deve existir + Bar nem acesso à edição. Não descartar a fila.
4. Reconectar A ainda na conta local e atualizar. Em B, atualizar: a proposta “Teste de conta A” não deve chegar enquanto a conta original não retomar seu envio.
5. Em A, sair da conta local e entrar novamente na conta de e-mail original, online. Sincronizar; B deve receber o nome novo. Restaurar o nome original pelo fluxo normal depois de conferir, se esse for o combinado para o estabelecimento de teste.

Esse cenário cobre preservação da edição após segundo plano, isolamento de propostas por conta e restrições da conta local. Não equivale à troca offline entre duas contas Firebase, que pode exigir autenticação online. Se a conta local não estiver disponível, prepará-la antes de começar; não reconectar a conta original no meio do teste sem registrar que ela pode enviar automaticamente sua fila.

## Bloco 3 — conflito entre contas autorizadas

1. A e B devem estar online com o mesmo bar/versão, sem outros envios pendentes. Ambas as contas precisam ter permissão legítima de edição.
2. Desconectar a Internet de ambos com o app aberto. Alterar **Detalhes do bar** para textos distintos em A e B, e salvar nos dois ainda offline.
3. Reconectar apenas A e aguardar confirmação. Depois reconectar B. A proposta antiga de B deve virar conflito, preservando sua proposta para revisão e mantendo a versão de A no servidor.
4. Conferir **Revisar envios e conflitos** em B. Não descartar sem ler: o botão **Usar servidor** descarta todas as pendências dessa conta. Usá-lo apenas se as únicas pendências forem as deste teste e houver confirmação do responsável.
5. Atualizar ambos e conferir convergência. Registrar mensagens e valores vistos; não editar versões diretamente no Firebase para forçar um resultado.

## Bloco 4 — permissões, gestão, CEP e gestos

- Sem login e com conta local, conferir ausência de ações administrativas/edição. Uma conta comum adicional será necessária para validar sua restrição em aparelho; não promover/rebaixar as duas contas atuais para esse fim.
- No bar de teste, editar nome/detalhes e conferir sincronização. Excluir somente um bar descartável previamente combinado; ele e seus filhos devem sair da visualização, com histórico preservado. Não excluir o bar usado nos outros blocos antes de concluir.
- Consultar CEP com rua e CEP geral (ex.: 27700-000), conferir a prévia e completar o endereço. Sem Internet, manter digitação manual; consulta por CEP deve falhar de forma recuperável. Não inferir coordenadas a partir do CEP.
- Usar botão e gesto Voltar do Android, navegar de bar para item/câmera, voltar sem salvar e conferir o aviso de rascunho. A câmera deve retornar ao formulário correto. Os dois Android não validam o gesto lateral do iOS.

## Melhorias futuras, sem implementação nesta rodada

- Escolher foto da galeria além de tirar pela câmera, solicitado para depois.
- Puxar para atualizar e botão explícito Atualizar. O controle manual atual pelo status foi testado pelo usuário.

Nenhum teste de banimento, promoção, transferência ou custódia será executado em contas/bares reais nesta rodada sem alinhar com o responsável pela respectiva frente.

## Retorno do bloco 1 — 27/10/2026

Após o roteiro de foto de item e reabertura no segundo aparelho, usuário respondeu “Permaneceu.”. Registrados recebimento e persistência da foto no segundo Android. Isso não valida automaticamente troca de conta, conflitos, permissões ou gestos.

## Retorno do conflito — 27/10/2026

Após orientação do bloco de edições concorrentes, usuário informou que B exibiu “1 conflito(s) para revisar”. Detecção física de conflito confirmada. Preservação da versão de A/proposta de B e convergência após revisão ainda precisam de confirmação. Usuário esclareceu também que a dificuldade anterior com a busca administrativa ocorreu com o telefone sem Internet; nenhuma alteração no painel foi feita nesta frente.

Conclusão do cenário de conflito: usuário confirmou a preservação da proposta local em B, a manutenção de “Teste A” em A e, após orientar usar a versão do servidor, a exibição de “Teste A” também em B. Preservação e convergência confirmadas por relato. Não foi afirmada limpeza da fila sem confirmação explícita. Próximo bloco orientado: gesto Voltar Android e aviso de rascunho, sem salvar alterações de teste.

## Retorno do gesto Voltar — 27/10/2026

Usuário confirmou: “O aviso apareceu e continuar/descartar funcionaram corretamente.”. Aprovado o cenário orientado de gesto Voltar Android no gerenciamento com rascunho: continuar conserva o texto, descartar não salva. Não inferir dessa confirmação testes de iOS, botão Voltar separado ou retorno da câmera. Próximo cenário orientado: restrição de edição como visitante, sem alterar papéis das contas.

## Retorno de visitante — 27/10/2026

Usuário confirmou todo o comportamento orientado como visitante: consulta da lista, ausência de + Bar, aviso Somente consulta ao tocar em bar e opções de entrada no perfil sem administração. Conta local e troca com fila pendente ainda não confirmadas; próximo cenário usa conta local para permitir a troca sem reconectar antecipadamente o usuário Firebase.

## Retorno de isolamento da fila — 27/10/2026

Usuário confirmou: “A alteração chegou a B depois de retornar à conta original.”. Aprovado o resultado orientado de edição offline e troca para conta local antes de reconectar, com envio retomado somente pela conta original. Não registrar como confirmado o teste separado de segundo plano (T06), ausente do roteiro curto enviado ao usuário, nem detalhes de controles visuais da conta local sem retorno específico. Próximo teste orientado: CEP normal/geral e digitação manual sem rede, sem salvar alterações.

## Retorno de CEP — 27/10/2026

Usuário respondeu “Funcionaram.” ao roteiro de consulta 01001-000, CEP geral 27700-000 com preenchimento manual e consulta sem Internet mantendo o endereço editável. Teste orientado sem salvar alterações, descartando o rascunho ao sair. T12 aprovado por relato; próximo cenário é exclusão lógica de bar descartável e propagação ao outro celular.

## Retorno de exclusão — 27/10/2026

Usuário confirmou: “Desapareceu nos dois aparelhos e continuou ausente após reabrir B.”. Aprovado o resultado físico de exclusão e propagação do bar descartável, inclusive persistência da ausência em B. Isso não afirma inspeção manual do histórico, restauração ou hard delete. Próximo cenário: salvar edição offline, ir ao segundo plano e voltar antes de reconectar.

## Retorno de segundo plano offline — 27/10/2026

Usuário confirmou: “A alteração permaneceu ao retornar ao app e depois chegou a B.”. T06 aprovado por relato, após salvar offline, alternar para outro aplicativo e voltar antes de reconectar. Não equivale a inicialização a frio sem Metro. Próximas checagens: restrições visuais da conta local e retorno da câmera/botão Voltar com rascunho; negativa física para conta comum/dono sem vínculo depende de conta adequada e iOS não está disponível.

## Consolidação da rodada — 27/10/2026

Usuário respondeu “Ambos funcionaram.” às verificações finais de conta local somente para consulta e câmera preservando o rascunho com descarte pelo botão Voltar. Cenários disponíveis nos dois Android concluídos sem nova falha relatada: fotos de bar/item, recebimento e persistência, offline/retorno ao app, troca Firebase/local com fila, conflito e convergência, consulta de visitante/local, gestão/exclusão, CEP e navegação. Confirmações são relatos do usuário, não observação direta do agente.

Permanece T10: teste físico negativo de conta comum/dono sem vínculo, pois as duas contas online informadas eram admin/donas. As regras correspondentes passaram no emulador, mas isso não substitui o caso físico. iOS, inicialização a frio offline em build instalada e inspeção manual do histórico da exclusão não foram confirmados. A limpeza final de pendências após resolver conflito não foi informada separadamente. Galeria e puxar para atualizar permanecem melhorias futuras, não requisitos implementados nesta rodada.
