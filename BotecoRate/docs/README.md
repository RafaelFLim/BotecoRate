# Documentação do BotecoRate

Atualizado em 22/10/2026.

## Implementação atual

- [Gestão de bares e dependências](GESTAO_BARES.md): edição/exclusão, ranking, regra de ex-donos e contrato para os futuros fluxos de propriedade. Primeira entrega da sequência por pontos; validação física pendente.

- [Cadastro, abertura e testes no app](TESTES_APLICATIVO.md): início nos bares como visitante, acesso por tipo de conta, perfil organizado por ações, Mostrar/Ocultar senha, biometria e roteiro de testes físicos.

- [Servidor e sincronização](SERVIDOR_E_SINCRONIZACAO.md): segunda etapa local, protocolo, API autenticada, fotos, conflitos, configuração e limites. Referência mais recente.

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

Os documentos de levantamento/banco/plano incluem propostas históricas. SQLite e autenticação local estão implementados; servidor e sincronização foram acrescentados localmente na segunda etapa. Nenhuma implantação, promoção de conta ou importação em produção foi executada. Consulte os documentos de implementação para distinguir entregas de pendências.

## Convenção de manutenção

Cada alteração futura deve atualizar os documentos afetados e o registro de mudanças. Decisões propostas não devem ser descritas como implementadas. Registrar mudanças de esquema, migrações, permissões, integrações, configuração necessária, validações executadas e limitações conhecidas. Nunca incluir senhas, tokens ou credenciais de serviço.
