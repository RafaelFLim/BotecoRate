# Referências do professor e adequação do BotecoRate

Análise estática em 22/10/2026 dos cinco repositórios públicos informados pelo usuário. Foram lidos os arquivos de aplicação, persistência, sincronização, configuração e dependências; não foram executados aplicativos, containers ou serviços desses projetos. Cópias de consulta foram obtidas fora do repositório do BotecoRate. Não houve acesso aos bancos Firebase dos exemplos.

## 1. Versões analisadas

| Repositório | Commit consultado |
| --- | --- |
| [LPAH-2024-SQLITE](https://github.com/FUSVE/LPAH-2024-SQLITE) | `c5458f9506dcc0d42fa5ec1085df8dad6469e251` |
| [API-Tasks](https://github.com/FUSVE/API-Tasks) | `c5935397adc7b8914b4c33fd49d85704c508a23f` |
| [Task-Manager-API](https://github.com/FUSVE/Task-Manager-API) | `bdf91a6c67255d3c69d9986eb4909635db9ce64f` |
| [LPAH-2024-Firebase](https://github.com/FUSVE/LPAH-2024-Firebase) | `f1d8ef99aedae6df1e4489e8a9f6000c52ed3c9d` |
| [LPAH-2026-SQLITE-FIREBASE](https://github.com/FUSVE/LPAH-2026-SQLITE-FIREBASE) | `5b8260c4ba96b4161821ccf664adb93a2c6d5390` |

As versões atuais dos projetos chamados “2024” já usam Expo SDK 57. O nome do repositório não determina a versão da biblioteca. Commits e caminhos abaixo permitem distinguir o que foi observado de recomendações nossas.

## 2. O que cada exemplo ensina

### SQLite isolado

`LPAH-2024-SQLITE/App.js` abre banco por `SQLite.openDatabaseAsync`, ativa WAL, cria tabela via `execAsync`, consulta com `getAllAsync` e executa operações parametrizadas com `runAsync`. Estado React, efeitos, lista, modal de edição e gesto de remoção ficam em `App.js`. O exemplo apaga fisicamente os registros e não tem histórico.

Configuração: `app.json` inclui plugin `expo-sqlite`; `package.json` usa Expo `~57.0.25`, SQLite `~57.0.3`, React `19.2.3` e RN `0.86.3`. Bibliotecas de gestos/reanimated suportam a interação específica do exemplo; não são requisito automático da persistência do BotecoRate.

### Firebase isolado

`LPAH-2024-Firebase/firebaseConfig.js` usa SDK JavaScript modular (`initializeApp`, `getDatabase`). `App.js` usa `ref`, `push`, `onValue`, `update` e `remove`; o listener é desinscrito no efeito. Não há Firebase Authentication, controle de papéis ou SQLite. A remoção é física.

Configuração: SDK `firebase` `^12.0.0`; este exemplo possui `expo-dev-client`, comandos `expo run:android/ios` e perfis EAS. Outros exemplos usam `expo start`; não existe uma configuração de build única comum aos cinco projetos. Não copiar IDs de pacote, EAS, API URLs ou configuração Firebase do professor.

### API de tarefas

`API-Tasks/app.py` é uma API Flask com MySQL, CORS e documentação Flasgger/Swagger. Fornece GET/POST/PUT/DELETE em `/tasks`; as consultas usam parâmetros. O DELETE preenche `deleted_at`; listagens filtram `deleted_at IS NULL`. `banco.sql` contém `created_at`, `updated_at` e `deleted_at`. Há Dockerfile e Compose para MySQL/API.

Não há implementação de autenticação/autorização nos endpoints lidos, apesar da dependência PyJWT. Histórico não está implementado. MySQL é parte desse exemplo de API, não uma exigência adicional para o BotecoRate, que terá SQLite + RTDB.

### Aplicativo consumidor de API

`Task-Manager-API/App.js` usa Axios para GET/POST/PUT/DELETE, estado React e React Native Paper. A URL é de rede local. Não há SQLite, fila offline ou autenticação implementados. Referência para cliente HTTP e tratamento de erros; não exige substituir toda a interface atual por Paper.

### SQLite + Firebase de 2026 — referência principal

Arquivos e funções:

- `src/database/database.js`: conexão compartilhada por `getDatabase()` e criação de tabelas em `initDatabase()`.
- `src/database/taskRepository.js`: CRUD SQLite, `addToSyncQueue`, consultas da fila, marcação `synced`, importação remota por `upsertTaskFromRemote`.
- `src/services/firebaseConfig.js`: inicialização modular e exportação de `db`, `ref`, `set`, `get`, `child`.
- `src/services/syncService.js`: `NetInfo.fetch`, envio sequencial da fila com `set`, confirmação local, remoção da fila e download com `get`.
- `App.js`: inicia banco, lê lista local, tenta sincronizar; NetInfo dispara sincronização na reconexão; botão permite execução manual.
- `src/components/TaskItem.js`: componente separado com status pendente/sincronizado.

Modelo: `tasks` usa ID textual gerado localmente, campos `created_at`/`updated_at` ISO, `completed`, `deleted` e `synced`; `sync_queue` guarda entidade, operação, payload JSON e data. O remoto fica em `users/usuario_teste/tasks/{id}`. `operation` é armazenado na fila, mas o envio usa `set` do snapshot para todos os tipos, preservando `deleted` no objeto.

Dependências observadas: Expo `~57.0.30`, SQLite `~57.0.4`, Firebase `^12.12.1`, NetInfo `12.0.1`, React `19.2.3`, RN `0.86.3`. Não instalar versões apenas por cópia; conferir compatibilidade com o SDK do projeto na implementação.

## 3. Diretriz confirmada pelo usuário

O código e a configuração do BotecoRate devem seguir o esquema dos exemplos do professor. A referência principal é o projeto combinado de 2026, complementada pelo `deleted_at` da API e pelos padrões de API/Firebase dos outros exemplos.

Estrutura prevista, sem criar esses arquivos nesta etapa:

```text
App.js
src/
  database/
    database.js
    migrations/
    usuarioRepository.js
    barRepository.js
    itemRepository.js
    avaliacaoRepository.js
    propriedadeRepository.js
    syncRepository.js
  services/
    firebaseConfig.js
    authService.js
    syncService.js
    permissionService.js
    adminService.js
    enderecoService.js
  screens/                 # telas atuais e novas
  components/              # componentes compartilhados
  utils/
```

Manter JavaScript, componentes funcionais, hooks, funções assíncronas, SQLite como leitura da interface, repositórios com SQL parametrizado, SDK modular do Firebase, fila explícita e NetInfo. Preservar convenções locais de nomes e não introduzir ORM ou outro framework por padrão.

Nome proposto da fila passa a ser `sync_queue`, alinhado ao exemplo; substitui `sync_outbox` dos primeiros rascunhos. Campos extras de idempotência, conta e versão continuam necessários. `deleted_at` é a autoridade de exclusão: não manter um segundo `deleted` independente. `synced`/status pertencem ao controle local e não são prova de aceitação ou autoridade no remoto.

## 4. Extensões necessárias, além do exemplo didático

1. Trocar `usuario_teste` pelo UID autenticado. Catálogo de bares é compartilhado; não duplicar um bar canônico inteiro dentro de cada dono. Manter caminhos públicos e vínculos de copropriedade separados.
2. Adicionar Authentication, autorização por usuário/dono/admin, regras RTDB e banimento. Nenhum desses fluxos está implementado nos cinco exemplos consultados.
3. Gravar alteração, histórico e fila em uma transação SQLite. No exemplo combinado, alteração e enfileiramento são awaits separados e podem ficar inconsistentes em uma interrupção.
4. Serializar as sincronizações. No exemplo, inicialização, listener e botão podem chamar `handleSync` em paralelo; `syncing` indica estado visual, sem funcionar como exclusão mútua.
5. Validar versão remota antes de sobrescrever: o exemplo envia fila com `set` antes de baixar e compara datas somente no upsert local. Esse fluxo não resolve conflitos entre dois aparelhos, nem usa horário autoritativo do servidor.
6. Usar IDs estáveis e operação idempotente; não marcar uma edição nova como sincronizada ao receber confirmação de uma edição antiga do mesmo registro.
7. Preservar exclusão lógica, snapshots e identidade do autor, com proteção contra reescrita de histórico.
8. A leitura completa de tarefas do exemplo não é ainda um protocolo de paginação/cursor. Incrementalidade só deve ser adicionada depois que sua consistência estiver definida; não fingir que o exemplo já a oferece.
9. Não copiar configurações de banco, senhas de demonstração, regras permissivas, IDs de aplicativo ou IP de rede local. Configuração cliente Firebase do nosso projeto não equivale a credencial Admin SDK; esta nunca vai no app.

## 5. Ajuste da proposta anterior: cliente e servidor

A proposta inicial previa todos os comandos passando obrigatoriamente por um serviço próprio. Isso não corresponde ao padrão de escrita direta pelo SDK mostrado pelo professor e deixa de ser decisão fechada.

Diretriz revisada: `syncService.js` permanece no aplicativo, com SQLite, fila, NetInfo e SDK modular. O desenho detalhado deverá escolher, por operação, escrita direta no RTDB protegida por regras/transações ou comando de servidor quando necessário. Uma atualização multipath sozinha não resolve comparação concorrente de versão. Regras que só validam o cliente visualmente também não bastam.

Operações de Firebase Authentication para banir/excluir terceiros exigem ambiente confiável com Admin SDK. O painel pode seguir o exemplo de consumo HTTP via Axios, chamando API autenticada. Não colocar credenciais administrativas no celular. Isso é uma extensão necessária aos requisitos, não uma funcionalidade existente nos exemplos.

Não criar uma segunda base MySQL só porque a referência de API a utiliza: uma API auxiliar pode validar tokens e usar Admin SDK com RTDB/Auth. Escolha de Flask versus outra tecnologia, hospedagem e fronteiras de autorização/transação ainda pendentes. O plano deve justificar cada diferença em relação à referência, mantendo a organização do professor.

## 6. Consolidação das perguntas

> Registro histórico: o usuário respondeu estas perguntas. Consultar [Decisões confirmadas](DECISOES_CONFIRMADAS.md) para o estado atual, sem repetir as perguntas já resolvidas.

Perguntas abertas concentradas para o próximo alinhamento:

1. Alcance geográfico da verificação (Vassouras/RJ, estado ou Brasil) e adoção de conferência administrativa de CNPJ + licença/dispensa + vínculo pessoal. Sem CNPJ terá caminho alternativo ou ficará sem habilitação de dono?
2. Ativação online da conta local por e-mail + senha digitada novamente; conta já autenticada poderá preparar alterações offline? “Autenticada” significa login Firebase ou também e-mail verificado?
3. Convite para acrescentar coproprietário exige unanimidade também? Transferência já definida: escolher dono substituído + todos os donos atuais + destinatário aceitam. Destinatário precisa estar habilitado como dono antes de aceitar? Proposta: sim.
4. Cadastro de bar pelo admin será permitido? Banimento/exclusão de dono: ocultar o bar, preservar com coproprietários ou colocar sob gestão administrativa? Evitar bar publicado sem responsável elegível.
5. Avaliação anterior à pessoa se tornar dona fica preservada, mas fora do ranking? Proposta: sim. Admin modera por ocultação/exclusão justificada, sem reescrever opinião de terceiros.
6. Os três itens são exigidos só na publicação inicial ou permanentemente? Proposta: manter mínimo enquanto publicado.
7. Importar os quatro bares com cardápios; o que fazer com donos fictícios e avaliações de demonstração? Proposta: gestão administrativa explícita e excluir avaliações demonstrativas do ranking. Dados sem autor não viram avaliações reais por inferência de nome.
8. Para Correios, confirmar endpoint realmente acessível e eventual credencial fornecida para turma. Projeto `botecorate` criado não confirma RTDB/Auth/Storage habilitados; decidir ambiente do pequeno serviço administrativo e plataformas de entrega (Android/iOS/web).

Rafael e Emanuel se cadastram antes do bootstrap administrativo por UID; não pedir nem armazenar suas senhas na documentação. Não é necessário solicitar os e-mails para concluir este planejamento.
