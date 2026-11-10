# Regras de negócio do BotecoRate

Versão documental 2026.11.10.1. Este documento reúne as regras atuais acordadas por Rafael Ferreira e Emanuel Franco para o aplicativo acadêmico de avaliação de bares. Substitui a descrição original baseada somente em AsyncStorage. Regras aprovadas ainda sem implementação são identificadas como pendentes.

## Objetivo e pilares

O aplicativo permite descobrir bares, consultar endereço/localização e avaliar estabelecimentos e itens do cardápio. A comunidade compõe o ranking. Donos gerenciam seus estabelecimentos, coproprietários atuam nos vínculos aceitos e administradores controlam acessos e moderação.

São requisitos estruturais: histórico fácil de localizar e ler; exclusão lógica com lixeira; paginação em históricos, lixeiras e listas administrativas; sincronização SQLite/Firebase com isolamento por conta; autorização validada no remoto; erros vermelhos, explícitos e próximos da ação; formulários utilizáveis com teclado aberto; preservação de rascunhos e suporte ao gesto Voltar.

## Contas e permissões

| Identidade ou papel | Pode consultar | Pode interagir | Pode cadastrar bar |
| --- | --- | --- | --- |
| Visitante | Catálogo público disponível e endereços | Não | Não |
| Conta local | Consulta disponível no aparelho | Não possui autorização remota | Não |
| Conta de e-mail sem confirmação | Consulta e regularização da conta | Deve confirmar o e-mail antes das ações protegidas | Não |
| Comum ativo e verificado | Conteúdo permitido | Avaliar, cuidar do perfil, solicitar habilitação e aceitar convite | Não |
| Dono ativo e verificado | Conteúdo permitido | Gerenciar os bares em que possui vínculo | Com aprovação inicial vigente e CNPJ aprovado livre |
| Admin ativo e verificado | Inclui áreas administrativas | Administrar todos os bares, acessos e moderação | Sim, diretamente |

`admin` é a permissão máxima atual. Nenhum nome especial ou e-mail hardcoded concede esse papel. Rafael e Emanuel têm acesso administrativo por suas identidades Firebase. O controle remoto prevalece sobre cache, botão visível ou dado enviado pelo celular.

Contas locais usam usuário e senha e podem ser criadas sem internet. Não são contas Firebase nem podem publicar avaliações, bares ou convites. O vínculo/ativação por e-mail exige conexão e autenticação; não recuperar senha em texto puro a partir do hash local. Biometria apenas destrava a sessão admitida pelo app, sem conceder papel novo. Sair encerra o acesso ativo, preservando pendências de cada conta sem enviá-las como outro usuário.

## Meus dados e credenciais

Minha conta → Meus dados concentra as opções de trocar nome e trocar senha, com formulários próprios, além do código de convite copiável. Dados privados de autenticação não entram em históricos de negócio.

### Nome de perfil

O nome precisa de pelo menos três letras, tem limite de 100 caracteres e não aceita emojis. Números, espaços e pontuação permitida não contam como letras. Uma letra, somente números, somente pontos e combinações sem três letras são inválidos. O validador admite as letras e os separadores previstos no código, incluindo ponto, hífen, sublinhado e apóstrofo.

O nome não pode repetir o próprio nome atual nem um nome existente após normalização de maiúsculas, acentos, espaços e pontuação. A conta online reserva o nome global por UID; a conta local verifica os nomes daquele aparelho. Trocar o nome local altera também o identificador usado no login local. A alteração online é atômica entre índice, perfil, diretório/cartão e histórico. Nomes legados não podem ser associados a outra identidade por mera semelhança.

### Senha

A política exige pelo menos oito caracteres, uma maiúscula e um caractere especial, com confirmação da nova senha no formulário aplicável. Na conta Firebase, a troca usa o fluxo de redefinição confirmado pelo e-mail. Solicitar o link não significa que a senha já foi alterada.

Exceção acordada: conta local sem e-mail troca a senha com senha atual, nova senha e confirmação, sem exigir e-mail. O hash local não é sincronizado. Não manter senhas anteriores, tokens ou conteúdo de links de redefinição no histórico. Falha parcial no envio de e-mail não deve incentivar cadastro duplicado.

## Habilitação de donos

O alcance previsto é todo o Brasil. Em Minha conta → Sou dono de bar, a conta ativa com e-mail verificado informa CNPJ, estabelecimento e descrição da comprovação do vínculo. O aplicativo valida formato e dígitos verificadores para CNPJ numérico e alfanumérico. Isso detecta erro de digitação; a aprovação continua administrativa.

Em Administração → Validação de donos, o admin consulta a fonte oficial, confere situação cadastral e comprovação de representação, e aprova ou recusa com justificativa. O alvará pode apoiar a conferência do estabelecimento; não comprova sozinho a identidade de quem usa a conta. O fluxo atual recebe descrição do documento e usa conferência por canal privado combinado. Upload de comprovantes e consulta automática oficial ainda não estão implementados.

A aprovação inicial de um comum promove seu papel a dono e habilita o CNPJ inicial. Um dono por convite mantém o vínculo aceito, mas precisa da aprovação inicial para criar novos bares. Promover manualmente para dono também não substitui essa aprovação. Revogar a habilitação bloqueia novos cadastros e preserva vínculos atuais, sujeitos ao restante das regras de acesso.

## CNPJ e criação de bares

Cada dono pode ter vários bares. Cada cadastro próprio precisa de um CNPJ aprovado e ainda livre para aquela conta. A restrição acordada é um bar por CNPJ por usuário cadastrante. A reserva permanece após exclusão lógica e transferência; não prometer reutilização automática.

1. No primeiro cadastro, + Bar apresenta o CNPJ aprovado na habilitação, preenchido e imutável.
2. Havendo mais CNPJs aprovados e disponíveis, o usuário escolhe um no dropdown.
3. Sem CNPJ livre, + Bar avisa e abre a solicitação de novos CNPJs. O botão + CNPJ acrescenta campos; um envio admite até 20 documentos.
4. Cada CNPJ tem decisão própria. O admin pode selecionar um, alguns ou todos os pedidos pendentes de um usuário para aprovar/recusar com justificativa.
5. O usuário recebe aviso da decisão ao chegar a atualização ou na próxima entrada. Ao reabrir + Bar, os aprovados livres ficam disponíveis.
6. A reserva é confirmada com o cadastro do bar. Dois envios concorrentes não podem consumir o mesmo CNPJ da conta; a proposta recusada fica disponível para revisão.

Pedidos e decisões exigem conexão. Um dono pode preparar cadastro offline com opções previamente confirmadas e disponíveis no cache da conta; a sincronização revalida a autorização atual. CNPJ aprovado/em análise/já usado não deve gerar pedido duplicado. Pedido recusado pode ser reapresentado conforme o fluxo.

Administradores mantêm cadastro direto. Bares legados sem CNPJ são preservados; não preencher retroativamente por adivinhação. O CNPJ de habilitação não concede propriedade automática de um bar já existente. Convite também não consome autorização de cadastro novo.

## Dados de bares e cardápio

O cadastro exige nome, foto, endereço, detalhes e pelo menos três itens ativos de cardápio. Os itens podem combinar comidas e bebidas. Cada item precisa de tipo, nome, descrição e preço positivo; foto de item é opcional. Preço é exibido em reais e persistido em centavos inteiros.

Donos ativos vinculados e admin podem editar o bar e seu cardápio. Ser somente criador antigo não substitui o vínculo atual. Um coproprietário gerencia apenas os estabelecimentos em que participa; não recebe acesso aos demais bares de outro dono. A antiga exceção que liberava bares sem autoria para qualquer usuário foi superada pelo controle atual.

Bar publicado deve preservar o mínimo de três itens ativos. Alterações têm histórico, versão e proteção contra formulário desatualizado, troca de conta e perda de permissão. O texto original do endereço legado é mantido até uma edição consciente.

### Endereço e mapa

Os campos são rua/logradouro, número, complemento, bairro, cidade e UF, além de CEP opcional. Rua, número ou S/N, cidade e UF são obrigatórios no conjunto estruturado; complemento e bairro são opcionais. O texto completo é composto para exibição. O campo redundante CEP registrado no estabelecimento foi retirado do pedido de habilitação.

A consulta implementada usa ViaCEP e permite aplicar a prévia ao formulário. Um CEP geral, como 27700-000, pode preencher somente cidade e UF. Esses valores precisam permanecer após aplicar, editar outros campos e salvar. Falha de consulta mantém a entrada manual. Nenhuma cidade deve desaparecer silenciosamente.

CEP não é coordenada de estabelecimento. O usuário confirma a posição por localização quando disponível; bar sem coordenadas permanece na lista e fica fora do mapa até ser posicionado. Permissão/GPS negados devem permitir consulta e correção posterior. Alterar o endereço requer rever a posição. A integração direta dos Correios continua pendente de definição de acesso/contrato.

### Fotos

Fotos novas usam JPEG reduzido em Base64 no RTDB. A implementação atual dispensa Storage e faturamento adicional para essa função. Arquivo local e intenção pendente são preservados quando o envio falha. Receber uma foto da câmera não deve indicar sucesso se a cópia falhou. Escolha de foto pela galeria segue como melhoria a avaliar.

## Avaliações e ranking

Cada usuário autorizado pode ter uma avaliação ativa por bar e uma por item. A nota vai de 1 a 5; comentário é opcional. O autor pode editar/excluir a própria avaliação com histórico. A autoria usa ID estável, preservando nomes de apresentação conforme os registros disponíveis.

Donos não avaliam seus próprios bares nem itens deles. Avaliações anteriores de quem se torna proprietário continuam visíveis com aviso de que não contam no ranking. A inelegibilidade permanece mesmo depois que a pessoa deixa de ser dona. Demonstrações importadas também ficam fora do ranking.

O ranking usa avaliações ativas, visíveis e elegíveis. Os três primeiros bares com avaliação elegível recebem destaque; bar sem avaliação válida não ganha medalha por falta de concorrência. Excluir, moderar ou mudar propriedade deve atualizar a apresentação sem reabilitar opiniões inelegíveis. O admin modera com justificativa; não reescreve a opinião de outra pessoa.

## Copropriedade e transferência

Um bar pode ter vários donos. O convite identifica o destinatário por nome normalizado ou código/UID, com cartão de confirmação antes de enviar. O código pessoal fica em Meus dados. A área Propriedade e convites é oferecida a donos com contexto pertinente e usuários convidados; comum sem convite não precisa ver esse menu.

Na inclusão, todos os donos atuais e o convidado precisam aceitar. Na substituição, a solicitação identifica exatamente qual dono sai; os demais permanecem. Todos os envolvidos, incluindo o destinatário, precisam concordar. O destinatário pode ser comum e se tornar dono na conclusão consensual, sem receber autorização geral para criar bares.

O remetente já registra seu aceite ao enviar. Se ele é o único dono, só falta a resposta do convidado. Havendo outros donos, a tela mostra quem falta aceitar e o aviso Esperando aprovação dos proprietários do bar quando aplicável. Botão desabilitado precisa de explicação. Recusa/cancelamento e mudança de propriedade/acesso invalidam o que o protocolo prevê; convite pendente não concede permissão.

Admin não possui bypass para concluir transferência sem os consentimentos. Solicitações legadas podem manter a regra antiga de votos; não alterar assinaturas antigas silenciosamente. Cancelar/reemitir é o caminho para usar o fluxo novo quando necessário. O histórico continua disponível no histórico geral/contextual e no banco; o bloco deslocado da tela de convites foi removido.

## Exclusão de bar compartilhado

Em Gerenciar bar → Excluir estabelecimento, um dono solicita exclusão com motivo. Seu envio vale como aceite. Os demais proprietários encontram a mesma seção no gerenciamento do bar para aceitar/recusar. Até a unanimidade e a confirmação final, o bar permanece ativo.

Depois dos aceites, um dono confirma o envio à lixeira. A autorização depende da versão da propriedade e do estado de acesso; mudanças podem invalidar a solicitação. O único dono mantém confirmação direta. Admin pode excluir diretamente com justificativa própria. Se também for coproprietário, pode responder à votação como dono e dispõe da ação administrativa separada.

A regra vale no Firebase inclusive para versões antigas do aplicativo; esconder botão sozinho não impede exclusão indevida. Itens e avaliações seguem suas permissões próprias e a regra do cardápio mínimo.

## Administração e custódia

O painel permite pesquisar usuários, alterar papéis, banir/desbanir, excluir logicamente/restaurar contas e moderar avaliações com justificativa. As listas e os históricos são paginados. A autoridade vem de `access_control`; conta excluída/banida não executa comandos protegidos. Remover acesso no aplicativo e apagar a identidade no Authentication são operações distintas.

Quando a alteração administrativa torna todos os donos de um bar inelegíveis, deve abrir custódia temporária administrativa, preservando os vínculos anteriores. Bares já sem dono elegível podem ser assumidos explicitamente. O registro identifica responsável, motivo e datas; não transfere a autoria nem finge uma transferência aprovada.

Encerrar a custódia exige admin, justificativa e presença de dono elegível. Desbanir alguém não encerra automaticamente a custódia. O admin já possui permissão de gestão de qualquer bar; a custódia registra a responsabilidade institucional enquanto a situação é resolvida.

## Lixeira e prazo

Tudo que o produto permite excluir deve passar pela lixeira. A visão pessoal considera o UID de quem executou a exclusão. Ser autor original do cadastro ou dono do bar não faz aparecer como sua uma exclusão executada por outra pessoa. Admin vê todas e pode filtrar por responsável.

Acesso: Minha conta → Lixeira ou Administração → Lixeira. A tela tem busca por nome, tipo ou ID, filtro de tipo, filtro administrativo por usuário e páginas de 20 registros. Mostrar data da exclusão, prazo/data limite e ações permitidas.

| Registro | Regra de restauração |
| --- | --- |
| Bar ou item excluído no catálogo | Autor da exclusão com permissão atual, ou admin |
| Avaliação excluída pelo autor | Autor da exclusão, ou admin, respeitando alvo e unicidade |
| Avaliação removida por moderação | Somente admin, com justificativa |
| Usuário excluído administrativamente | Somente admin, com justificativa |

A restauração exige internet, versão válida, prazo de 30 dias conforme tempo do servidor e integridade das dependências. O admin pode restaurar qualquer categoria permitida, mas não ultrapassa prazo ou invariantes de consistência. Recuperar pai não recupera filho excluído antes dele. Avaliações moderadas/substituídas permanecem excluídas; o bar precisa voltar com três itens ativos.

**Requisito aprovado ainda pendente:** apagar definitivamente de forma manual e automaticamente após 30 dias. O término do prazo já bloqueia restauração; o conteúdo não é apagado fisicamente por uma rotina automática nesta versão. A entrega futura precisa remover conteúdo de históricos/mídias/réplicas e preservar somente auditoria mínima de quem excluiu, o identificador/tipo do objeto e quando. Não guardar o conteúdo eliminado nesse registro mínimo.

## Histórico pesquisável e paginação

Minha conta → Painel administrativo → Histórico geral reúne eventos. Os acessos contextuais de usuário/avaliação e os históricos de itens/avaliações também continuam disponíveis. Exibir ação, alvo, responsável, data, motivo, versão e mudanças legíveis; fotos aparecem como resumo, sem Base64.

A pesquisa geral admite registro, responsável, ação, data e motivo. Os filtros combinam bar por nome/ID, dono atual/anterior por nome/UID, endereço e CEP exato de oito dígitos; também existe seleção para ausência de CEP. A busca textual ignora acentos e maiúsculas. Filtrar dono não é o mesmo que filtrar quem executou a ação.

O contexto seleciona eventos de bares que têm ou tiveram os dados registrados. Não afirma que o dono/endereço filtrado existia exatamente na data de cada evento. Não inventar dados anteriores ausentes. Mudanças de conta sem relação explícita com bar não entram nesses resultados.

Históricos/lixeiras usam 20 registros por página, total filtrado, intervalo, página atual e Anterior/Próxima. Filtrar e ordenar antes de paginar; trocar filtro retorna à primeira página; redução de dados ajusta a última página. Não acumular todos os cartões num scroll infinito. O download remoto ainda é integral; paginação visual não implica consulta remota por cursor. Uma central ampliada de histórico pessoal continua como evolução de usabilidade.

## Erros e interação

Falhas sempre usam vermelho e explicam o que não foi concluído e como corrigir ou tentar novamente. Formulários mantêm faixa perceptível fora da rolagem e destacam o campo incorreto com borda e orientação. Não depender de toast curto, mensagem escondida no topo ou somente Alert neutro. Anúncios acessíveis devem acompanhar o erro; a cor não é a única informação.

Preservar rascunhos, não mostrar sucesso antecipado e não expor tokens, senhas ou Base64 nas mensagens. Editar um campo pode limpar o erro obsoleto, sem significar gravação concluída. Sucesso, modo offline esperado e confirmação pendente são informações separadas de falha.

O teclado deve manter o campo focado visível, inclusive quando o Android sobrepõe o conteúdo sem redimensioná-lo. Formulários precisam rolar e oferecer espaço inferior temporário. A correção recente ainda precisa da confirmação física do cenário Nome do bar em Gerenciar bar.

Gesto/botão Voltar respeita o fluxo, câmera e aviso continuar/descartar rascunho. A lista permite puxar para baixo para atualizar e mantém indicador durante a operação. A mensagem rotineira Catálogo sincronizado deixou de ocupar a tela inicial; pendências, conflitos e erros continuam acessíveis, inclusive pela revisão de sincronização no perfil.

## Pendências de produto

Faltam hard delete manual/automático e limpeza distribuída; integração direta dos Correios; execução real dos fluxos Maestro; regressão física das alterações recentes e iOS. Anexos privados e consulta automática para validação de CNPJ, galeria e paginação remota são evoluções a avaliar. Os critérios de teste e a evidência existente estão no [Guia de desenvolvimento e testes](DESENVOLVIMENTO_E_TESTES.md).
