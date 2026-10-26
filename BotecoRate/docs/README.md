# Documentação do BotecoRate

Atualizado em 26/10/2026.

## Implementação atual

- [Atualização para Expo SDK 58](ATUALIZACAO_DEPENDENCIAS.md): versões compatíveis, verificações e roteiro de abertura no Expo Go 58.

- [Consulta de CEP com ViaCEP](INTEGRACAO_CEP.md): cadastro/edição, prévia antes de aplicar, endereço manual e GPS opcional; sem token ou Flask. Testes físicos pendentes.

- [Copropriedade e transferência](COPROPRIEDADE_E_TRANSFERENCIA.md): convites por UID, escolha do dono substituído, unanimidade, histórico acessível, invalidação e SQLite versão 5.

- [Painel administrativo](PAINEL_ADMINISTRATIVO.md): permissões, banimento, moderação justificada, histórico e limites da exclusão.
- [Históricos legíveis e pesquisáveis](HISTORICOS.md): requisito central, acesso no painel e consultas prontas no SQLite.
- [Lixeira e retenção](LIXEIRA_E_RETENCAO.md): decisões aprovadas, 30 dias, auditoria mínima e implantação geral ainda pendente.
- [Gestão de bares e dependências](GESTAO_BARES.md): edição/exclusão, ranking, regra de ex-donos e integração com os fluxos de propriedade. Primeira entrega da sequência por pontos; validação física pendente.


- [Segurança do versionamento](SEGURANCA_DO_VERSIONAMENTO.md): arquivos privados ignorados e checagem de credenciais antes do commit.
- [Cadastro, abertura e testes no app](TESTES_APLICATIVO.md): início nos bares como visitante, acesso por tipo de conta, perfil organizado por ações, Mostrar/Ocultar senha, biometria e roteiro de testes físicos.
- [Visualizador SQLite](INSPETOR_SQLITE.md): abertura, diagnóstico de timeout e correção do ciclo de consultas da interface do Expo.
- [Sincronização direta SQLite/Firebase](SINCRONIZACAO_DIRETA.md): fluxo atual sem API Flask, regras publicadas, migração dos dados e testes. Fotos novas ainda dependem de habilitar Storage.
- [Configuração do Firebase real](CONFIGURACAO_FIREBASE_REAL.md): Rafael/Emanuel promovidos a administradores e quatro bares importados; consultar a sincronização direta para o estado posterior.

- [Servidor e sincronização](SERVIDOR_E_SINCRONIZACAO.md): referência histórica da etapa com Flask, substituída pela sincronização direta.

- [Túnel para testes externos](TUNEL_TESTES.md): diagnóstico do Ngrok e comando alternativo com Cloudflare e QR para Expo Go.
- [Etapa 1 implementada](IMPLEMENTACAO_ETAPA_1.md): SQLite, identidade, navegação, configuração Firebase, verificações e limites atuais. É a referência do código após o início das alterações.
- [Backup e restauração](BACKUP_E_RESTAURACAO.md): cópia estável verificada antes das grandes mudanças e retirada reversível do teste GSD.
- [Atualização de dependências](ATUALIZACAO_DEPENDENCIAS.md): versões instaladas, verificações, alertas remanescentes e testes antes de continuar.
- [Regras da versão anterior](REGRAS_DE_NEGOCIO.md): referência histórica do app com AsyncStorage. Consultar a Etapa 1 para o código atual e as decisões confirmadas para o objetivo completo.
- `REGRAS_DE_NEGOCIO.docx`: versão legada; não foi atualizada nesta etapa.

## Evolução planejada: SQLite e Firebase Realtime Database

- [Decisões confirmadas](DECISOES_CONFIRMADAS.md): respostas mais recentes, referência iFood e etapa de testes antes da implementação.
- [Referências do professor](REFERENCIAS_PROFESSOR.md): análise dos cinco repositórios, padrão obrigatório de organização e ajustes da proposta anterior.
- [Levantamento e decisões](LEVANTAMENTO_V2.md): requisitos confirmados, propostas e perguntas abertas.
- [Banco de dados e sincronização](BANCO_DE_DADOS.md): modelo lógico proposto, integridade, auditoria e mapeamento remoto.
- [Plano e registro de mudanças](PLANO_DE_EVOLUCAO.md): sequência de implementação e verificações necessárias.

Os documentos de levantamento/banco/plano incluem propostas históricas. O fluxo atual usa SQLite e SDK Firebase diretamente, com regras e migração publicadas em `v1/direct`. Os dois administradores e os quatro bares estão cadastrados. Flask não é necessário ao aplicativo; fotos novas ainda dependem de habilitar Storage. Consulte `SINCRONIZACAO_DIRETA.md` para distinguir entregas de pendências.

## Convenção de manutenção

Cada alteração futura deve atualizar os documentos afetados e o registro de mudanças. Decisões propostas não devem ser descritas como implementadas. Registrar mudanças de esquema, migrações, permissões, integrações, configuração necessária, validações executadas e limitações conhecidas. Nunca incluir senhas, tokens ou credenciais de serviço.
