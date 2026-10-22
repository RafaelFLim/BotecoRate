# Levantamento V2 — requisitos e decisões

Data: 22/10/2026. Situação: planejamento, com decisões pendentes. Responsáveis pelo projeto: Rafael Ferreira e Emanuel Franco.

> As [Decisões confirmadas](DECISOES_CONFIRMADAS.md) mais recentes prevalecem sobre propostas e perguntas antigas deste documento: abrangência nacional, e-mail verificado, convites unânimes sem papel prévio de dono, custódia administrativa, mínimo permanente de três itens, Flask e entrega Android/iOS.

## 1. Requisitos confirmados pelo usuário

| ID | Requisito |
| --- | --- |
| R01 | SQLite no aparelho, sincronizado com Firebase Realtime Database. Projeto informado: `botecorate`. |
| R02 | Login por e-mail e senha; permitir editar nome de perfil e senha. |
| R03 | Papéis: usuário comum, dono de bar e admin. |
| R04 | Opção “sou dono de bar” no cadastro e no painel do usuário; método de validação ainda será definido. |
| R05 | Donos e admins podem cadastrar bares; donos alteram seus bares e admins administram qualquer bar. |
| R06 | Cada dono pode ter vários bares e cada bar pode ter vários donos. |
| R07 | Transferência identifica qual dono será substituído e exige aceite de todos os donos atuais, além do destinatário. Admin pode iniciar transferência; dispensa de consentimentos não foi autorizada. |
| R08 | Donos não podem avaliar seus próprios bares nem seus itens. Admin pode moderar avaliações. |
| R09 | Painel administrativo para permissões, banimento e exclusão de usuários. |
| R10 | Criar conta local offline com usuário e senha. Sem autenticação Firebase, somente consultar bares e endereços. Endereço manual permitido quando a consulta falhar. |
| R11 | Remover mocks do aplicativo e cadastrar os bares no banco. Não executar a remoção antes da importação e substituição dos fluxos de leitura. |
| R12 | Rafael Ferreira e Emanuel Franco devem ser admins, vinculados aos IDs reais de suas contas. |
| R13 | Exclusão lógica e tabelas de histórico de alterações. |
| R14 | Documentar decisões e implementações na pasta `docs`, inclusive o banco de dados. |
| R15 | Código e configuração seguem o esquema dos cinco exemplos do professor; principal referência: `LPAH-2026-SQLITE-FIREBASE`. Ver [análise das referências](REFERENCIAS_PROFESSOR.md). |

## 2. Arquitetura proposta

- SQLite: leitura local, rascunhos e operações pendentes.
- Firebase Authentication: identidade, e-mail, senha e recuperação de acesso.
- Realtime Database: estado compartilhado aceito, vínculos, auditoria e eventos de sincronização.
- Cloud Storage: fotos e comprovantes, com políticas distintas de acesso.
- Sincronização no app, organizada como no exemplo do professor: repositórios SQLite, `sync_queue`, NetInfo e SDK Firebase modular. Escrita direta protegida versus comandos de servidor precisa de definição por operação; não está fechado que toda alteração passará por API própria.
- Serviço confiável para administração de contas via Admin SDK e operações que não possam ser autorizadas/validadas com segurança no cliente + regras RTDB. Tecnologia, hospedagem e custos serão definidos antes da implantação; não adicionar MySQL por padrão.
- Aplicativo: telas → serviços de negócio → repositórios SQLite → sincronização. Retirar regras de negócio da tela de listagem gradualmente.

Realtime Database não é um banco relacional. SQLite usa chaves estrangeiras e tabelas; o remoto usa caminhos JSON e índices de acesso mantidos pelo servidor. Não repetir o desenho atual de salvar todos os bares em um único array.

## 3. Validação de dono

### Evidência disponível

O serviço oficial de consulta CNPJ permite verificar empresa, situação cadastral e quadro de sócios/administradores. Isso ajuda a analisar o vínculo, mas digitar um CNPJ ou um nome público não autentica quem está usando o app. A pesquisa não identificou um registro profissional de dono de bar equivalente ao CRM; o planejamento usa vínculo empresarial e comprovação de representação.

Alvará não deve ser exigido como prova universal: há regras locais e dispensas, inclusive para MEI. Documentação empresarial e licenciamento também não equivalem, isoladamente, à autenticação do solicitante.

### Complemento: vínculo de alvará e CNPJ

Existem consultas oficiais de licenciamento por CNPJ e conferência de autenticidade do documento. REDESIM/portais estaduais e municipais integram essas informações; no RJ, o REGIN integra Receita Federal, Fazenda e prefeitura. As consultas e formas de acesso variam por localidade. Não foi confirmada uma API nacional pública única que resolva a comprovação pessoal de propriedade.

Uma consulta válida pode comprovar o vínculo entre estabelecimento, CNPJ e licença. Ela não demonstra sozinha que quem enviou esses dados é o sócio ou representante autorizado, especialmente se os dados/documentos forem públicos. Proposta: conferir CNPJ + licença ou dispensa no órgão emissor e, separadamente, verificar o vínculo do solicitante com a empresa (sócio ou representante autorizado). Método de identificação/representação e abrangência geográfica continuam pendentes; nenhuma alternativa foi aprovada automaticamente.

### Alternativas ainda não aprovadas

1. Solicitação no cadastro/perfil, com CNPJ e evidência de vínculo; análise administrativa e liberação do papel após aprovação. Disponibilizar também a análise do vínculo com cada estabelecimento. É a recomendação para uma validação efetiva.
2. Autodeclaração com CNPJ e liberação simplificada. Deve ser rotulada como vínculo não verificado; não prometer comprovação de propriedade.

Um provedor de consulta empresarial, sua disponibilidade e seu contrato de uso ainda não foram selecionados. Não implementar consulta automatizada da Receita por raspagem de páginas. CNPJ é identificador textual; a validação deverá acompanhar o formato oficial vigente e não presumir que sempre contém somente números.

A solicitação de habilitação global como dono não concede acesso a bares já existentes. Cada estabelecimento tem seus próprios vínculos de propriedade. Um vínculo aceito no aplicativo representa autorização de gestão no app, não transferência jurídica da empresa.

Comprovantes ficam em armazenamento privado, acessível somente ao solicitante e a administradores autorizados. Definir dados estritamente necessários, acesso e prazo de retenção antes de coletar documentos de identidade. Não espalhar comprovantes para os caches públicos de todos os aparelhos.

## 4. Administração e primeiros admins

Recomendação: Rafael e Emanuel cadastram suas contas normalmente, verificam seus e-mails e informam os respectivos UIDs por um canal de configuração do projeto. Um procedimento administrativo executado em ambiente confiável promove esses UIDs e registra o evento de concessão. Nunca promover por comparação de nome de perfil ou por e-mail fixo no aplicativo.

Proposta de autoridade: caminho privado `access_control/{uid}` no Realtime Database, com `role` e `status`, gravável somente pelo serviço administrativo. O SQLite armazena apenas uma cópia. Todas as operações no servidor consultam a autoridade atual. Claims de autenticação são opcionais; se usadas, não substituem a checagem de banimento vigente e devem ter fluxo explícito de atualização.

Editar `user_role` manualmente pode ser o bootstrap, desde que em caminho protegido, realizado por administrador do projeto e com auditoria. Um procedimento idempotente via Admin SDK é preferível por deixar as etapas reproduzíveis. Não há promoção automática nesta fase.

Propostas adicionais: bloquear a remoção do último admin ativo; exigir motivo para banimento, exclusão, moderação e mudanças de papel. Banimento e exclusão são operações diferentes. O painel deve orquestrar também o Firebase Authentication: alterar somente um campo no banco não desabilita a identidade de autenticação.

Não é possível revogar dados que já foram lidos e estão em um aparelho desconectado. O servidor rejeitará operações de usuários banidos ao reconectar; o app limpará/segregará o cache privado ao tomar conhecimento do bloqueio. Definir destino dos bares de um usuário excluído antes de permitir a exclusão.

## 5. Coproprietários e avaliações

Confirmado: múltiplos donos; todos os donos atuais devem aceitar a transferência, inclusive o dono selecionado para substituição. O destinatário também precisa aceitar. Selecionar explicitamente o dono que sai, sem remover os demais. Proposto: todos os donos ativos têm acesso à edição do bar e cardápio. Adição independente de coproprietário e remoção sem substituição ainda precisam de regra própria.

Uma transferência registra bar, solicitante, dono substituído, destinatário, snapshot dos donos atuais, versão de propriedade, aprovações individuais e estado (`pendente`, `concluida`, `recusada`, `cancelada`, `expirada`, `invalidada`). A conclusão requer unanimidade dos donos e aceite do destinatário. O servidor revalida contas, vínculos e versão, e só então substitui um vínculo pelo outro em uma transação. Iniciar a solicitação não conta automaticamente como voto: o consentimento deve ficar explícito e auditado. Repetir o aceite não duplica vínculos. Alteração do conjunto de donos invalida a solicitação; criar outra com novo conjunto de consentimentos, sem reaproveitar votos antigos. Admin pode iniciar o processo, mas não há exceção autorizada à unanimidade.

Qualquer dono ativo do estabelecimento está impedido de avaliar o bar e seus itens. Isso vale também para um admin que seja coproprietário. Admin modera por ocultação/exclusão com justificativa; proposta: não reescrever a opinião de outro usuário.

Pendente: avaliações feitas antes de alguém se tornar dono. Recomendação: preservar histórico e torná-las inelegíveis para ranking enquanto houver vínculo, com regra de retorno a definir. O servidor deve aplicar a regra em concessões e transferências, não apenas esconder o formulário.

## 6. Offline e endereços

Conta local pode ser criada offline com usuário e senha, possuindo ID local e credencial derivada por algoritmo próprio para senhas, com salt aleatório; nunca senha em texto puro. Essa conta existe no aparelho, mas não é uma identidade Firebase e não recebe permissão de escrita. Desbloquear a conta local ou usar biometria não a promove a autenticada. Sem autenticação Firebase, somente visualização de bares e endereços; bloquear avaliações, cadastro/edição de bares e itens, solicitações de dono, transferências e administração, inclusive gravações pendentes de negócio.

Leitura offline limitada ao catálogo já sincronizado. Se o dispositivo nunca baixou bares, mostrar que não há catálogo disponível offline; não recriar mocks. Dados de consulta pública podem ser lidos sem autenticação conforme regras restritas aos caminhos públicos. Dados privados não são expostos para permitir essa navegação.

Proposta para ativar a conta local: ao conectar, informar e-mail e digitar novamente a senha para criar ou acessar uma conta Firebase. Se o e-mail já existir, exigir login/recuperação dessa conta, nunca vincular pelo nome/e-mail digitado. Vincular o ID local ao UID somente após autenticação bem-sucedida. O verificador local não é enviado ao Firebase como senha e não entra na fila de sincronização. Nome local não reserva nome global. A senha Firebase pode ser diferente da local; após ativação, remover a credencial local provisória e usar o fluxo Firebase/biometria definido para contas ativadas. Essas escolhas de ativação são propostas, não decisões confirmadas.

Criar identidade Firebase, trocar senha remota, validar e-mail, conceder papel, aceitar transferência e administrar usuários exigem conexão. Contas previamente autenticadas podem usar dados e preparar alterações offline conforme permissões locais conhecidas, com publicação sujeita à revalidação no servidor. Ainda confirmar se contas previamente autenticadas deverão ser somente leitura ao perder conexão; não confundir sessão Firebase persistida com uma conta que nunca se autenticou.

Integração Correios: usuário informou que a API é pública. O manual oficial fornecido exige Bearer Token e contrato para o serviço Busca CEP. A página SwaggerHub não pôde ser lida pelas ferramentas nesta etapa. Acesso público à documentação não confirma acesso anônimo ao endpoint. Confirmar URL base e exemplo de requisição da API disponibilizada para a turma antes de escolher autenticação. Não substituir por outro provedor sem decisão explícita.

Consulta preenche CEP/logradouro/bairro/cidade/UF; número e complemento são informados pelo usuário. Permitir preenchimento manual e registrar `origem_endereco`. CEP não fornece necessariamente a posição exata. Ao alterar o endereço, coordenadas anteriores precisam de revalidação; não usar silenciosamente a posição atual como localização definitiva do bar.

## 7. Migração dos mocks

Os quatro bares atuais serão carga inicial executada uma vez no banco, e não fallback embutido no aplicativo. O material de importação pode existir como artefato de migração fora do pacote de execução; o app não deve recriar os dados ao iniciar.

Há donos fictícios, avaliações sem autor e perfis de demonstração inexistentes no Authentication. Não criar contas reais fictícias nem atribuir esses dados a pessoas com o mesmo nome. Proposta: importar bares como demonstração administrada, com propriedade explicitamente atribuída pelos admins; avaliações legadas ficam identificadas como demonstração e fora do ranking até definição. Essa política ainda precisa de decisão.

Base vazia deve mostrar estado vazio; falha de rede/banco não deve ser tratada como autorização para repovoar os mocks. A importação deve possuir IDs estáveis e controle de execução para não duplicar registros.

## 8. Decisões pendentes

- Método de validação de dono e tratamento de estabelecimentos sem CNPJ.
- Regras para adicionar coproprietário ou remover dono sem transferência. Transferência por substituição e unanimidade já confirmadas.
- Elegibilidade do destinatário: exigir papel de dono validado antes do aceite? Recomendação: sim.
- Ativação online da conta local e alcance da sessão previamente autenticada durante período offline. Cadastro local e restrição a bares/endereços já confirmados.
- Endpoint realmente público dos Correios e suas condições de acesso.
- Política de avaliações anteriores ao vínculo de dono e dos mocks importados.
- Destino dos bares de contas banidas/excluídas e poderes de recuperação do admin.
- Mínimo de três itens: só no cadastro ou também nas exclusões posteriores? Permanece regra atual até decisão.
- Se nomes exibidos em avaliações acompanham o perfil atual ou permanecem como na publicação. Recomendação: nome atual com histórico de perfil privado.
- Tecnologia de execução do servidor, armazenamento de fotos, plano Firebase e abrangência Android/iOS/web.

## 9. Fontes verificadas em 22/10/2026

- [Consulta CNPJ e QSA — Governo Federal](https://www.gov.br/pt-br/servicos/consultar-cadastro-nacional-de-pessoas-juridicas)
- [Dispensa de alvarás e licenças do MEI — Governo Federal](https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/perguntas-frequentes/dispensa-de-alvaras-e-licencas-de-funcionamento/o-que-e-a-dispensa-1)
- [Manual Busca CEP — Correios](https://www.correios.com.br/atendimento/developers/manuais/manual-api-busca-cep)
- [SwaggerHub informado, conteúdo não confirmado](https://app.swaggerhub.com/apis/emanuel-3af/correios-cep-v3/3.15.6)
- [Regras do Realtime Database](https://firebase.google.com/docs/database/security)
- [Leitura, escrita, atualizações e transações](https://firebase.google.com/docs/database/web/read-and-write)
- [Administração de usuários](https://firebase.google.com/docs/auth/admin/manage-users)
- [Sessões e revogação](https://firebase.google.com/docs/auth/admin/manage-sessions)
- [Claims administrativas](https://firebase.google.com/docs/auth/admin/custom-claims)
- [REGIN — integração de registros e órgãos públicos](https://www.jucerja.rj.gov.br/portalregin/)
- [Consulta de licenciamento por CNPJ — RS](https://www.servicos.rs.gov.br/servico/4199/consultar-licenciamento-de-empresa)
- [Armazenamento de senhas — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Contas por e-mail/senha — Firebase](https://firebase.google.com/docs/auth/web/password-auth)
