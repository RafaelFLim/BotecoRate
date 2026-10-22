# Decisões confirmadas em 22/10/2026

Requisitos aprovados pelo usuário, com implementação parcial nas etapas 1 e 2. Este documento atualiza as perguntas históricas de `REFERENCIAS_PROFESSOR.md` e prevalece sobre propostas anteriores em `LEVANTAMENTO_V2.md` e `BANCO_DE_DADOS.md` quando houver divergência. Consulte `IMPLEMENTACAO_ETAPA_1.md` e `SERVIDOR_E_SINCRONIZACAO.md` para o estado efetivamente entregue. Restrições de aguardar testes abaixo são o registro da decisão original, já liberada pelo usuário conforme o plano.

## 1. Validação de donos: Brasil e referência iFood

Abrangência nacional. O usuário solicitou pesquisar o cadastro de parceiros do iFood e adaptar à escala acadêmica do BotecoRate.

As páginas oficiais nos resultados pesquisados descrevem CNPJ, atividade alimentícia, endereço, representante legal e documentos do titular. Também mencionam vínculo bancário com o estabelecimento. O acesso direto a três páginas retornou 403: a evidência acessível foi conteúdo indexado, não inspeção do cadastro autenticado. Não foi confirmada API pública de identificação pessoal do iFood nem seu processo antifraude interno.

Proposta proporcional: conta com e-mail verificado solicita habilitação; informa empresa/estabelecimento; conferem-se CNPJ, atividade e dados empresariais; verifica-se separadamente se o solicitante é sócio ou representante autorizado; admin registra aprovação/rejeição. Licença ou dispensa pode complementar a prova conforme município. Um documento público ou CNPJ válido isolado não autentica o solicitante.

Não coletar dados bancários: não temos repasses. Dados pessoais, comprovação de representação, fornecedor de consultas, fluxo sem CNPJ e prazo de retenção ainda precisam de detalhamento. A proposta de análise administrativa não equivale a aprovação automática de qualquer documentação enviada.

Fontes oficiais pesquisadas:

- [Cadastro](https://blog-parceiros.ifood.com.br/ifood-cadastro/)
- [Passos para vender no iFood](https://institucional.ifood.com.br/restaurantes/como-vender-no-ifood-2/)
- [Ajuda para restaurantes](https://parceiros.ifood.com.br/restaurante/ajuda)
- [Portal do Parceiro](https://blog-parceiros.ifood.com.br/portal-do-parceiro/)

## 2. Identidade e offline

- Cadastro local offline com usuário/senha, somente consulta de bares e endereços disponíveis no aparelho.
- Ativação online por e-mail e senha digitada novamente foi aprovada. E-mail existente exige login/recuperação comprovados; não vincular por nome.
- Ações de negócio exigem autenticação Firebase, **e-mail verificado**, conta ativa e permissão.
- Conta já autenticada/verificada pode preparar alterações offline; revalidar permissão, verificação e estado no servidor ao enviar.
- Conta local, visitante ou e-mail não verificado não escreve dados de negócio. Biometria não substitui verificação de e-mail.
- Senha provisória local somente como verificador derivado seguro, sem texto puro, fila ou histórico de credenciais.
- Atualização autorizada pelo usuário após testes Android/Expo Go: proteção proporcional para a conta acadêmica de consulta. Implementado custo local reduzido de PBKDF2 (10.000 iterações), salt individual e pausa por tentativas; contas antigas migram apenas após senha correta. Não equivale à recomendação de produção nem concede autoridade remota. Detalhes, medição e limitações em `TESTES_APLICATIVO.md`.

## 3. Convites e transferências

- Adicionar coproprietário: unanimidade dos donos atuais e aceite do convidado.
- Substituir proprietário: selecionar quem sai; unanimidade dos donos atuais e aceite de quem entra; preservar demais donos.
- Destinatário não precisa ter papel de dono antes. Deve ter conta ativa/verificada para aceitar. Proposta: conceder capacidade de dono na conclusão do vínculo consensual, auditando a origem por convite. Convite pendente não concede acesso.
- Alteração do conjunto de donos invalida a solicitação; exigir nova rodada. Não foi autorizado bypass administrativo para transferências comuns.

## 4. Administração e custódia

- Admin pode cadastrar bares e administrar qualquer bar. Rafael e Emanuel serão promovidos pelos UIDs reais, em procedimento controlado.
- Se todos os donos forem banidos, uma conta administrativa assume temporariamente. Proposta: aplicar também à exclusão/perda do último dono elegível.
- Registrar custódia separada da propriedade comum: preservar vínculos e histórico, motivo, início, fim e responsável. Não representar como transferência definitiva consentida.
- Recomenda-se identidade institucional controlada no servidor, sem senha administrativa compartilhada no app; admins humanos atuam com suas próprias identidades para manter autoria.
- Política de devolução/encerramento da custódia ainda precisa de definição. Desbanir um dono não deve causar devolução automática por efeito de sincronização.

## 5. Avaliações, cardápio e importação

- Avaliação anterior ao vínculo de dono permanece visível, com aviso de que não conta para o ranking; fica inelegível enquanto houver vínculo. Retorno ao ranking após deixar de ser dono ainda a definir.
- Admin pode ocultar/excluir avaliações com justificativa, sem reescrever comentários de terceiros.
- Bar publicado deve manter pelo menos três itens ativos. Proposta inicial: impedir exclusão abaixo do mínimo.
- Importar quatro bares e cardápios sob gestão administrativa; avaliações de demonstração identificadas e fora do ranking. Não inventar contas de autores ou donos reais por coincidência de nome.

## 6. Integrações e ordem de execução

- Testes após atualização de dependências: usuário informou que o aplicativo funciona normalmente. Etapa de teste manual liberada pelo usuário; não afirmar validação independente em ambos os sistemas.
- Novo requisito: navegação compatível com o gesto/botão Voltar do Android e gesto lateral de retorno no iOS. Implementar retorno de uma tela por vez, fechamento de overlays antes de sair, proteção de formulários com alterações não salvas e comportamento na raiz. No Android, saída conforme convenção da plataforma; iOS não deve tentar encerrar o app. Testar também navegação por botões e evitar tratar gesto de início/multitarefa como gesto Voltar. Requisito registrado, ainda não implementado.
- Android e iOS; web não é alvo desta entrega.
- API administrativa em Flask, com Firebase Admin SDK; sem base MySQL adicional.
- Não há exemplo funcional fornecido para Correios. Endpoint/autenticação continuam pendentes; preservar fallback manual, sem substituir provedor silenciosamente.
- Conferir hospedagem, custos, URL RTDB e serviços habilitados antes de implantação.
- **Antes de alterações funcionais:** conferir/atualizar dependências compatíveis, informar versões e aguardar os testes do usuário. Não implementar banco, autenticação, migração ou novas regras antes desse retorno.
- Instalar SQLite/Firebase/NetInfo será parte da implementação futura, não da atualização das dependências existentes.
