# Histórico e decisões do BotecoRate

Versão documental 2026.11.10.1. Este guia preserva o contexto da evolução e identifica escolhas superadas. As regras vigentes estão no [Guia de regras de negócio](REGRAS_DE_NEGOCIO.md). A consolidação substitui documentos sobrepostos e preserva a cópia integral anterior em backup local.

## Evolução registrada

| Período | Entrega ou decisão | Consequência atual |
| --- | --- | --- |
| Versão original | Contas, bares e avaliações em AsyncStorage; mocks; navegação local | Superada pela persistência relacional e identidade remota |
| 22 de outubro de 2026 | Levantamento de SQLite/Firebase, papéis, endereço e exemplos do professor | Decisões documentadas antes da implementação |
| 22 de outubro de 2026 | Atualização compatível, confirmação de funcionamento e backup estável | Base preservada; teste GSD retirado |
| 22 de outubro de 2026 | SQLite, fila, histórico, contas locais e API Flask inicial | Ferramentas Python preservadas; API deixou de ser obrigatória |
| 22 de outubro de 2026 | Configuração real, admins e importação de demonstração | Carga única, sem seed de bares a cada abertura |
| 22 de outubro de 2026 | Sincronização SDK direta conforme o professor | SQLite local, RTDB canônico, regras e escrita multipath |
| 22 de outubro de 2026 | Correção de inicialização Firebase e loop do inspetor | Usuário confirmou abertura e tabela consultável sem oscilação |
| 22 a 23 de outubro de 2026 | Painel, moderação, propriedade, gestão e integração da dupla | Fluxos com auditoria e autorização remota |
| 26 de outubro de 2026 | Migração registrada para Expo SDK 58 | Dependências e patch do inspetor revistos |
| 27 de outubro de 2026 | Fotos Base64 e testes em dois Android | Imagens entre aparelhos sem Storage; evidência física registrada |
| 29 de outubro de 2026 | Histórico paginado/filtrável, identidade e padrão de erros | Requisitos transversais para as próximas telas |
| Evoluções até 10 de novembro | Custódia, lixeira/restauração, validação e novos CNPJs | SQLite chega à versão 10 com endereço estruturado |
| Evoluções até 10 de novembro | Aceite do remetente, exclusão compartilhada e correções de CEP/teclado | Necessidade de regressão física |
| 10 de novembro de 2026 | Testes JavaScript migrados para Jest; fluxos Maestro criados | 135 testes aprovados com emulador; E2E sem execução |
| 10 de novembro de 2026 | Cinco pares Markdown/Word | Fonte única, geração reproduzível e mapa dos originais |

As datas vêm dos registros anteriores. Uma data agrupa várias sessões e não implica que todos os fluxos foram implantados/testados juntos.

## Escolhas confirmadas

O professor é a referência de organização: conexão SQLite compartilhada, inicialização, repositórios/stores, Firebase modular, fila explícita e sincronização por conectividade. O BotecoRate amplia os exemplos com autorização, auditoria, conflitos e consenso entre donos. Não adiciona MySQL somente porque um exemplo de API o utiliza.

O Firebase escolhido é Realtime Database. E-mail/senha e confirmação de e-mail protegem interações. Conta local sem internet serve para consulta; a exceção de troca de senha local foi aceita explicitamente. Rafael e Emanuel recebem papel admin pela identidade cadastrada, com bootstrap confiável, sem credenciais hardcoded.

A validação de donos usa conferência humana de CNPJ e vínculo. A pesquisa inicial sobre alvará e identificação de parceiros não definiu uma integração governamental nacional que comprove automaticamente a pessoa dona. O fluxo final não depende de um cadastro profissional equivalente a CRM. Validade do CNPJ, situação cadastral e representação da empresa são verificações distintas.

Convites não autorizam criar bares. Novo cadastro depende de aprovação e CNPJ disponível por conta; admin mantém cadastro direto. Copropriedade exige todos os donos e destinatário, contando o envio como aceite do remetente. Transferência escolhe um vínculo a substituir. Avaliações anteriores de qualquer dono ficam permanentemente fora do ranking.

Banimento/exclusão do último dono elegível gera custódia, preservando o bar. Lixeira pessoal usa quem executou a exclusão; admin vê todas. Retenção aprovada é 30 dias, com auditoria mínima após hard delete. A entrega atual restaura, mas ainda não expurga automaticamente.

Histórico legível, paginação, erro vermelho perceptível e campos visíveis com teclado são pilares. A documentação deve acompanhar mudanças e distinguir teste automatizado de teste em aparelho.

## Decisões superadas e limites

### Persistência e transporte

A descrição sem backend, com senha em texto puro e AsyncStorage integral pertence à versão original. Hoje o SQLite é o banco local, a conta local usa hash e a online usa Authentication. IDs e vínculos atuais autorizam gestão; nome ou `criadoPor` isolado não bastam.

A API Flask obrigatória foi substituída pelo SDK direto. O exemplo do professor transmite registros, não o arquivo `.db`. O código `database.js` cria o banco no aparelho e o inspetor permite consultá-lo enquanto o app está conectado.

Multipath garante atomicidade de escrita; comparação de versões e autorização dependem também das regras. Não confundir o exemplo didático de última gravação com o protocolo do aplicativo.

### Fotos e endereço

O upload Storage foi preparado inicialmente, porém o bucket não foi habilitado naquela etapa. A escolha posterior foi Base64, sem mudança de faturamento. Instruções antigas que diziam que fotos novas aguardavam Storage foram superadas.

Correios foi solicitado com as documentações fornecidas. O fluxo implementado usa ViaCEP/manual. Consulta pública de CEP não comprova posição exata nem torna a integração Correios concluída. Campos de endereço separados substituem a caixa única; o texto legado permanece como referência.

### Convites e histórico

A necessidade de o remetente aceitar novamente foi corrigida para novos pedidos. Solicitações antigas não recebem voto retroativo silencioso. Histórico saiu da tela de convites por usabilidade; os eventos continuam na auditoria.

Paginar cartões não pagina o download do Firebase. Filtrar contexto antigo de bar/dono/endereço não é consulta temporal perfeita. Fotos resumidas na tela não removem o Base64 dos snapshots. Esses limites permanecem explícitos.

## Importação e configuração reais registradas

A carga inicial criou quatro bares, doze itens, nove avaliações de bares e nove de itens no projeto do grupo. Avaliações demonstrativas ficaram inelegíveis para ranking e não receberam identidades Firebase inventadas. Mocks do código de execução deixaram de ser a fonte do catálogo.

As contas administrativas foram confirmadas por UID, estado e e-mail verificado. A conta de serviço foi usada apenas em processos confiáveis; mudou de localização ao longo das sessões e continua fora do código cliente e ignorada. Preparações de índices/diretórios foram aditivas, com backups locais privados. Não repetir essas operações como teste.

A estrutura direta mantém `v1/migrations/direct_v1`; diário e catálogo anteriores permanecem como origem histórica. Leituras públicas e bloqueio de acesso privado sem sessão foram verificados na publicação correspondente. Regras de validação de donos e CNPJ tiveram publicação/releitura registrada em 10/11. A consolidação documental não publica regras nem altera dados.

## Referências do professor

Análise estática registrada em 22/10/2026. Os commits identificam o material consultado, sem afirmar que continuam sendo os HEADs. Não foram executados serviços nem acessados bancos dos exemplos.

| Repositório | Commit consultado | Uso no projeto |
| --- | --- | --- |
| [LPAH 2024 SQLITE](https://github.com/FUSVE/LPAH-2024-SQLITE) | `c5458f9506dcc0d42fa5ec1085df8dad6469e251` | SQLite assíncrono, WAL, DDL e parâmetros |
| [API Tasks](https://github.com/FUSVE/API-Tasks) | `c5935397adc7b8914b4c33fd49d85704c508a23f` | Flask, CRUD e `deleted_at` |
| [Task Manager API](https://github.com/FUSVE/Task-Manager-API) | `bdf91a6c67255d3c69d9986eb4909635db9ce64f` | Consumo HTTP da fase anterior |
| [LPAH 2024 Firebase](https://github.com/FUSVE/LPAH-2024-Firebase) | `f1d8ef99aedae6df1e4489e8a9f6000c52ed3c9d` | SDK modular e listeners |
| [LPAH 2026 SQLITE FIREBASE](https://github.com/FUSVE/LPAH-2026-SQLITE-FIREBASE) | `5b8260c4ba96b4161821ccf664adb93a2c6d5390` | SQLite, repositório, fila, NetInfo e sync |

No exemplo principal, `src/database/database.js` compartilha conexão e inicializa tabelas; `taskRepository.js` grava/consulta/enfileira; `firebaseConfig.js` inicializa o SDK; `syncService.js` envia e baixa; `App.js` acompanha a conectividade. O remoto usa identidade didática fixa, substituída no BotecoRate por autenticação e catálogo compartilhado.

Os exemplos não entregam todos os requisitos de papéis, consenso, auditoria imutável, transação alteração/fila e conflitos entre aparelhos. As extensões atendem ao escopo da dupla. Não copiar IDs de pacote, credenciais, regras abertas nem configurações privadas. O nome 2024/2026 não define a versão das bibliotecas.

Para testes, `../Exemplo-Teste` fornecido pelo usuário mostrou `jest.config.js`, lógica com `test/expect` e fluxos Maestro YAML. A migração adotou essas ferramentas preservando a separação de integrações. Os E2E próprios evitam limpeza de estado para conservar os bancos dos celulares.

## Referências externas preservadas

- [Documentação Correios CEP fornecida pelo usuário](https://app.swaggerhub.com/apis/emanuel-3af/correios-cep-v3/3.15.6)
- [Manual API Busca CEP dos Correios](https://www.correios.com.br/atendimento/developers/manuais/manual-api-busca-cep)
- [Manual de dígito verificador do CNPJ](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf)
- [Consulta oficial CNPJ](https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_S.aspx)
- [Consulta CNPJ Serpro](https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnpj/pt/)
- [SQLite no Expo SDK 57 da referência inicial](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Leitura e escrita no RTDB](https://firebase.google.com/docs/database/web/read-and-write)
- [Segurança no RTDB](https://firebase.google.com/docs/database/security)
- [Administração de usuários Firebase](https://firebase.google.com/docs/auth/admin/manage-users)

Essas fontes foram preservadas dos registros. A consolidação não constitui nova pesquisa de disponibilidade, contrato ou preços.

## Pendências ordenadas

1. Regressão física recente nos dois Android, começando por teclado, endereço, convites, exclusão compartilhada e restauração.
2. Instalar/configurar Maestro e executar os seis fluxos, registrando resultados reais.
3. Testar comum/dono sem vínculo, CNPJs adicionais e custódia com contas descartáveis; validar iOS quando houver ambiente.
4. Hard delete manual e executor após 30 dias, com auditoria mínima, mídia, histórico, índices e limpeza de réplicas.
5. Definir integração Correios e acesso; preservar entrada manual e ViaCEP enquanto vigentes.
6. Avaliar escala do download/histórico, paginação remota, retenção de backups e reconciliação com Authentication.
7. Avaliar comprovantes privados, consulta automática CNPJ, galeria e melhorias futuras.

A auditoria de dependências ainda possui alertas conhecidos e requer revisão específica de compatibilidade. Não aplicar atualizações principais nem alteração de faturamento como efeito colateral.

## Mapa dos documentos anteriores

O conteúdo vigente foi sintetizado nos destinos abaixo. Repetições, roteiros ultrapassados e propostas substituídas saíram da leitura principal. O ZIP preserva originais completos, evidências detalhadas e resultados de execuções antigas. O JSON ilustrativo de foto foi incorporado ao assunto Base64; regras executáveis continuam nos geradores Firebase.

| Documento anterior | Destino principal |
| --- | --- |
| README | Visão geral |
| REGRAS_DE_NEGOCIO | Regras e decisões superadas |
| DECISOES_CONFIRMADAS | Regras e este histórico |
| LEVANTAMENTO_V2 | Histórico e pendências |
| PLANO_DE_EVOLUCAO | Histórico e situação no índice |
| REFERENCIAS_PROFESSOR | Este histórico |
| IMPLEMENTACAO_ETAPA_1 | Histórico e arquitetura |
| BANCO_DE_DADOS | Banco e arquitetura |
| SERVIDOR_E_SINCRONIZACAO | Banco e desenvolvimento |
| SINCRONIZACAO_DIRETA | Banco e arquitetura |
| CONFIGURACAO_FIREBASE_REAL | Desenvolvimento e histórico |
| FOTOS_BASE64 e FOTO_BASE64_REGRA.json | Banco e regras |
| INTEGRACAO_CEP | Banco e regras |
| GESTAO_BARES | Regras e testes |
| COPROPRIEDADE_E_TRANSFERENCIA | Regras e banco |
| PAINEL_ADMINISTRATIVO | Regras e banco |
| VALIDACAO_DE_DONOS | Regras e banco |
| LIXEIRA_E_RETENCAO | Regras, banco e pendências |
| HISTORICOS | Regras e banco |
| MEUS_DADOS_E_IDENTIDADE | Regras e banco |
| FEEDBACK_E_ERROS | Regras e testes |
| ATUALIZACAO_DEPENDENCIAS | Desenvolvimento e histórico |
| BACKUP_E_RESTAURACAO | Desenvolvimento |
| SEGURANCA_DO_VERSIONAMENTO | Desenvolvimento e banco |
| INSPETOR_SQLITE | Desenvolvimento |
| TUNEL_TESTES | Desenvolvimento |
| TESTES_APLICATIVO | Desenvolvimento e testes |
| TESTES_INTEGRADOS_2_CELULARES | Desenvolvimento e evidência histórica |
| TESTES_JEST | Desenvolvimento e testes |
| TESTES_MAESTRO | Desenvolvimento e testes |

A versão Word antiga de REGRAS_DE_NEGOCIO está no backup e foi substituída pela versão gerada da fonte atual. O PDF anterior permanece em `output/pdf` como artefato da época; o guia de desenvolvimento concentra o roteiro mantido.
