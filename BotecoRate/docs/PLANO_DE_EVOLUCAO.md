# Plano de evolução e registro de mudanças

### 22/10/2026 — túnel para testes externos

- Diagnosticado `ERR_NGROK_108` na conta compartilhada do Expo, mascarado pelo erro de `body`.
- Adicionado `npm run start:tunnel` com Cloudflare portátil, checksum verificado e QR HTTPS para Expo Go. Ferramenta local ignorada pelo Git.
- Verificados manifestos públicos Android/iOS e entrega do pacote Android pelo túnel. Falta validação do QR no aparelho físico. Procedimento em `TUNEL_TESTES.md`.
- Nenhuma alteração funcional no app ou Firebase nesta correção.

Data: 22/10/2026. Situação: primeira etapa implementada localmente; ver `IMPLEMENTACAO_ETAPA_1.md`. Sincronização completa e administração permanecem em implementação futura.

> Após o usuário confirmar os testes e autorizar o início, foram implementadas as bases SQLite/autenticação/navegação. Não houve implantação em Firebase. Ver [Etapa 1](IMPLEMENTACAO_ETAPA_1.md).

## Sequência proposta

Todas as etapas seguem a organização e as configurações compatíveis descritas em [Referências do professor](REFERENCIAS_PROFESSOR.md), com o app combinado de 2026 como base. As fronteiras de escrita remota/servidor precisam ser fechadas antes da implementação da sincronização.

1. Fechar validação de donos, ativação da conta local, sessão previamente autenticada offline, destino dos dados legados, Correios e demais pendências em `LEVANTAMENTO_V2.md`. Transferência por substituição com unanimidade já definida.
2. Conferir configuração do projeto Firebase: URL real do Realtime Database, Authentication por e-mail/senha, região, regras, armazenamento e ambiente de execução do servidor. O link do console informado não comprova que esses serviços já foram habilitados. Não foi acessada a conta do console nesta etapa.
3. Criar ambiente de desenvolvimento/emuladores, regras restritivas e contratos de comandos/respostas. Definir custos/configuração antes de implantar serviços.
4. Produzir DDL SQLite e migrações, repositórios e testes de integridade. Detalhar fronteiras transacionais remotas e protocolo de sincronização antes de codificar o worker.
5. Implementar conta local offline de consulta, com verificador de senha derivado e sem texto puro; integrar ativação via Authentication, perfil editável, isolamento por conta e bootstrap auditado dos admins Rafael e Emanuel. Não guardar credenciais Firebase no banco de negócio.
6. Implementar validação de dono e painel administrativo; permissões verificadas no servidor, com fluxo de banimento/exclusão e reconciliação com Authentication.
7. Migrar bares/cardápios/avaliações para serviços de domínio e SQLite; implementar coproprietários, convites, transferências, históricos e exclusão lógica.
8. Implementar sincronização bidirecional, fotos persistentes, idempotência, conflitos, retomada e status visível.
9. Integrar endereços pelo endpoint confirmado, cache permitido e fallback manual, com coordenadas independentes e verificadas.
10. Importar os bares existentes uma única vez no banco, validar a carga e retirar `mockBares.js` e todas as referências/fallbacks das telas. Não remover antes de a leitura pelo banco estar funcional.
11. Validar os fluxos integrados em dois dispositivos, offline/online e emuladores. Atualizar regras de negócio, dicionário de dados, configuração e guia de execução com o comportamento efetivamente entregue.

## Critérios de aceite principais

- Alteração de nome não perde autoria/propriedade; e-mail/senha tratados pelo Authentication.
- Usuário comum não publica bar; dono altera somente bares vinculados; admin altera qualquer bar.
- Nenhum dono ativo avalia seu próprio estabelecimento ou seus itens.
- Transferência substitui o dono selecionado e preserva os outros; só conclui após aceite de todos os donos atuais e do destinatário, com validação atômica. Mudança de propriedade invalida votos anteriores.
- Conta criada offline persiste no aparelho, mas só consulta bares e endereços; desbloqueio local não concede permissões Firebase. Ativação exige autenticação online comprovada, sem vincular contas por coincidência de nome/e-mail.
- Operação repetida não duplica dados/históricos; operação antiga não ressuscita excluídos.
- Papel local adulterado não concede permissão remota; banimento bloqueia novos comandos.
- Rascunhos offline sobrevivem ao reinício; troca de conta não vaza cache/documentos nem envia fila alheia.
- Histórico confirmado é imutável e não contém senhas ou comprovantes públicos.
- Aplicativo funciona com base vazia sem recriar demonstrações.

## Registro de mudanças

### 22/10/2026 — confirmação das regras e diagnóstico da conexão real

- Chave corrigida com valor exato fornecido em texto: configuração pública Authentication e catálogo retornaram HTTP 200. Próximo passo é testar cadastro/login/verificação no aplicativo; nenhuma conta foi criada automaticamente.
- Usuário confirmou publicação das regras e ativação de E-mail/senha.
- Leituras reais confirmaram catálogo público acessível e autoridade protegida sem login.
- Authentication recusou a chave cliente transcrita da imagem; solicitado valor exato em texto antes do teste de cadastro/login. Nenhuma conta criada ou escrita remota executada pelo diagnóstico.

### 22/10/2026 — início autorizado da implementação

- Adicionadas bibliotecas compatíveis para SQLite, conectividade, autenticação, credenciais locais, fotos e navegação nativa.
- Implementados esquema local, migração do AsyncStorage, históricos, exclusão lógica e fila transacional; senhas antigas convertidas em verificadores locais.
- Adaptados login/cadastro/perfil e rotas nativas. Câmera/biometria preservadas; mapa usa a nova origem de dados.
- Seed saiu do app e passou a artefato administrativo. Preparadas configuração Firebase, regras restritivas e ferramenta de bootstrap/carga, sem execução remota.
- Oito testes SQLite/negócio/hash aprovados; bundles Android/iOS e Expo Doctor 21/21. Não declarar pronta a sincronização bidirecional ou painel administrativo.
- Usuário pediu orientação para localizar a configuração Firebase; passos fornecidos e registrados.

### 22/10/2026 — baseline estável, backup e GSD

- Usuário confirmou funcionamento após atualizar dependências.
- Registrado suporte a gesto Voltar Android/iOS para a futura navegação; ainda não implementado.
- Criado backup local com código, configurações ocultas, documentação e Git; verificado por extração/checksums. Instruções em `BACKUP_E_RESTAURACAO.md`.
- GSD retirado para recuperação local, após bloqueio automático da remoção permanente; removidas referências automáticas dos hooks/configurações. Configurações não relacionadas preservadas.
- Nenhum código funcional alterado nesta etapa.

### 22/10/2026 — decisões finais e atualização de dependências

- Registradas respostas em `DECISOES_CONFIRMADAS.md`, incluindo e-mail verificado, Brasil, convites unânimes sem papel prévio, custódia administrativa, avaliação inelegível sinalizada, três itens permanentes e Android/iOS com Flask.
- Pesquisadas fontes públicas oficiais do cadastro iFood; documentados limites da evidência e proposta proporcional de análise empresarial/pessoal.
- Atualizados Expo, câmera, localização e splash screen dentro do SDK 57, com atualização transitiva compatível. Resultados e testes em `ATUALIZACAO_DEPENDENCIAS.md`.
- Compatibilidade Expo aprovada e doctor 21/21. Auditoria npm com 18 alertas remanescentes, sem crítico; não aplicada correção forçada incompatível.
- Nenhum código funcional alterado. Próxima implementação depende do retorno do usuário sobre testes Android/iOS.

### 22/10/2026 — levantamento e documentação

- Registradas respostas do usuário e requisitos novos; corrigida a proposta remota de Firestore para Realtime Database.
- Modelada relação muitos-para-muitos entre usuários e bares.
- Documentadas alternativas para validação empresarial e dúvidas de transferência, offline e Correios.
- Propostos banco lógico, auditoria, exclusão lógica, protocolo de sincronização e bootstrap dos dois admins.
- Criado índice de documentação e sinalizada a distinção entre implementação atual e arquitetura planejada.
- Conferidas fontes oficiais e links internos dos documentos. Não executados testes de aplicativo por não haver alteração de código funcional.
- Não instaladas dependências, não removidos mocks, não criadas contas, não alteradas permissões no Firebase e não importados dados.

### 22/10/2026 — esclarecimentos de transferência e conta offline

- Confirmados seleção do dono substituído, unanimidade dos donos atuais e aceite do destinatário; incluídos votos individuais e invalidação por mudança de propriedade.
- Confirmado cadastro local offline com usuário/senha, limitado à consulta de bares e endereços até autenticação Firebase.
- Propostas tabelas locais de identidade provisória e verificador de senha sem sincronização ou histórico de credenciais; ativação online ainda precisa de definição do fluxo.
- Registradas consultas oficiais de licenciamento vinculadas ao CNPJ e distinção entre autenticidade da licença e identificação do solicitante.
- Apenas documentação alterada. Nenhum cadastro, integração ou esquema executado nesta etapa.

### 22/10/2026 — análise das referências do professor

- Lidos código e configurações dos cinco repositórios públicos; registrados commits e padrões observados.
- Adotada como diretriz a estrutura `database.js` + repositórios + `firebaseConfig.js` + `syncService.js`, fila `sync_queue`, SDK modular e NetInfo.
- Explicitadas diferenças necessárias para autenticação, copropriedade, auditoria, concorrência e administração. Revisada a proposta de exigir API própria para toda escrita.
- Concentradas perguntas abertas em um único registro de alinhamento. Não instaladas bibliotecas nem alterados código funcional ou Firebase.
