# Etapa 1 — SQLite, identidade e navegação nativa

Implementação local iniciada em 22/10/2026 após autorização e testes das dependências. O backup estável anterior permanece disponível. Este documento descreve o que foi efetivamente implementado; os demais documentos incluem o desenho completo ainda em evolução.

## Entregue nesta etapa

- `src/database/database.js`: conexão SQLite compartilhada, WAL, foreign keys, versão do esquema e transações exclusivas serializadas.
- `schema.js`: tabelas normalizadas de usuários, credenciais locais, ativações, bares, copropriedade, itens, avaliações de bar/item, históricos e `sync_queue`, além de configurações/migrações.
- `catalogStore.js`: projeção relacional para as telas existentes; preços em centavos; histórico e soft delete; alteração/fila no mesmo commit. Nesta primeira versão, `version` é revisão local usada no preparo da fila, **não versão remota confirmada**.
- `legacyMigration.js`: migração única do catálogo já existente no AsyncStorage. Contas antigas viram contas locais de consulta com senha derivada; após commit são removidas as senhas em texto puro e a sessão antiga. Falha não repovoa nem apaga o catálogo. Datas e históricos de opiniões/itens são preservados.
- Autoria antiga sem UID comprovado permanece sem vinculação Firebase; avaliações legadas ficam visíveis, inelegíveis para ranking, sem atribuição de identidade pelo nome. Não há associação automática de propriedade pelo nome antigo.
- `passwordService.js`: salt aleatório por conta e PBKDF2-HMAC-SHA256 de 600.000 iterações, execução assíncrona via biblioteca auditada `@noble/hashes`. Hash é verificador local, não senha Firebase; não é exportado em objetos de usuário ou histórico.
- `authService.js`: cadastro/login locais; cadastro/login Firebase por e-mail; envio/reenvio e atualização da verificação; recuperação de senha; ativação da conta local com credencial digitada novamente; perfil editável; senha atual exigida para trocar senha remota; logout real.
- Ativação local preserva vínculo local/UID em `ativacoes_conta` e elimina o verificador provisório. Nenhuma conta Firebase é criada silenciosamente a partir das credenciais antigas.
- `permissoes.js` e `catalogRules.js`: acesso de consulta para local/visitante/não verificado, bloqueio de cadastro por usuário comum, escrita somente de dono/admin, autoria por ID, proibição de autoavaliação e mínimo permanente de três itens.
- Native Stack no `App.js`: rotas independentes para lista, perfil, detalhes, formulários, câmera, mapa, cadastro e biometria; retorno Android e gesto lateral iOS via navegação nativa. Formulários de cadastro, item e perfil têm proteção contra descarte. A biometria mantém seu gate sem gesto interativo durante a autenticação.
- Câmera e biometria reaproveitadas sem reescrita interna. Mapa alterado apenas na origem dos bares; GPS e permissões preservados. Fotos novas são copiadas para pasta persistente do aplicativo antes de retornar ao formulário.
- Seed removido do pacote do app e preservado como JSON em `server/seeds/bares-demonstracao.json`. Não há fallback hardcoded em listagem/cadastro/mapa.

## Firebase: o que já funciona e o que não está concluído

SDK JavaScript modular, conforme professor; configuração cliente em `.env.local`, sem conta de serviço no aparelho. Sem configuração, a consulta/cadastro local continuam disponíveis e o login remoto mostra orientação explícita.

`syncService.js` usa NetInfo e execução única concorrente. Pode baixar uma **projeção pública de endereços** em `v1/catalog` e atualizar o SQLite. Checa fila dentro da transação e não sobrescreve alterações pendentes. O controle de versão dessa projeção é independente das revisões locais.

**Sincronização bidirecional de negócio ainda não está concluída.** Alterações autorizadas ficam na fila e a interface informa que aguardam a API. Elas não são enviadas por `set` desprotegido e não são marcadas como sincronizadas. Nenhuma implantação/configuração remota foi realizada nesta etapa.

`firebase/database.rules.json` fecha escritas de negócio e administração; libera leitura pública somente do catálogo de endereços, leitura da autoridade própria e edição do nome próprio com verificação de e-mail e histórico. Validado no emulador local em cinco cenários; ainda não implantado no banco real. Não substituir por regras abertas de teste. Perfil e histórico são escritos atomicamente em caminhos separados; histórico é append-only e as regras comparam a versão anterior para impedir sobrescrita concorrente.

Ferramenta `server/manage.py` preparada para promover UID real verificado a admin e importar uma vez os exemplos com gestão administrativa e ranking de demonstração desabilitado. Usa credenciais fora do repositório e confirmação explícita do projeto. Não foi executada contra Firebase. A carga inclui dados completos de demonstração privados em `v1/demo_data`; a projeção pública inclui apenas nome/endereço/foto/coordenadas. Download completo de cardápios/avaliações e autorização remota serão parte da próxima etapa, não simular com a projeção pública.

## Preparar a configuração cliente

1. No Firebase Console, abrir o projeto `botecorate`. Selecionar o ícone Web **`</>`** (à direita do Android) ou ir a Configurações do projeto → Geral → Seus apps → Adicionar app → Web.
2. Apelido `BotecoRate App`; não habilitar Hosting. Registrar app e selecionar configuração do SDK.
3. Copiar `.env.example` para `.env.local` na pasta BotecoRate e preencher:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=valor_de_apiKey
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=valor_de_authDomain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=botecorate
EXPO_PUBLIC_FIREBASE_DATABASE_URL=url_real_do_realtime_database
EXPO_PUBLIC_FIREBASE_APP_ID=valor_de_appId
```

4. URL do banco: menu de banco de dados/armazenamento → Realtime Database. Criar se necessário, inicialmente em modo bloqueado, e copiar a URL completa exibida. Não confundir com Firestore nem com o endereço do console.
5. Em Authentication, habilitar o provedor E-mail/senha. A exigência de verificação está no app e nas regras preparadas; não usar verificação apenas visual.
6. Reiniciar Metro com `npx expo start --clear` para carregar as variáveis. SDK Web é usado também no app Android/iOS; não é configuração de uma versão web do produto.

Esses valores identificam o app cliente e não concedem acesso administrativo por si. Nunca colocar chave privada/Admin SDK/arquivo de serviço em variável `EXPO_PUBLIC_*`.

## Ferramenta administrativa (não executar sem conferir o destino)

Em ambiente Python separado, instalar `server/requirements.txt`; fornecer `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL` e credenciais via Application Default Credentials. Arquivos de credenciais devem ficar fora da pasta do projeto.

```text
python server/manage.py promote-admin --uid UID_RAFaEL --bootstrap --confirm-project botecorate
python server/manage.py promote-admin --uid UID_EMANUEL --actor-uid UID_RAFAEL --confirm-project botecorate
python server/manage.py import-demo --actor-uid UID_RAFAEL --confirm-project botecorate
```

Substituir os placeholders pelos UIDs reais; o bootstrap só funciona quando ainda não há admin. A ferramenta exige e-mail verificado. A importação é idempotente e interrompe se houver catálogo não identificado como sua própria carga, em vez de sobrescrever. Não disponibilizar essa ferramenta/credencial no celular.

## Verificações executadas

- Testes `npm test` com SQLite real do Node 24: oito casos aprovados para integridade, unicidade, rollback, soft delete, histórico, permissões, ranking e hash interoperável com Node crypto (inclusive Unicode).
- Análise sintática e referências JavaScript sem nomes não declarados.
- `expo install --check`: dependências compatíveis; `expo-doctor`: 21/21.
- Exportação dos bundles Android e iOS concluída. Não equivale a instalar APK/IPA ou validar gestos, sensores e permissões em aparelhos.
- Ferramenta Python compilada sem erro de sintaxe. Não executada contra banco real.
- Cinco testes de regras no emulador Realtime Database aprovados: consulta pública, bloqueio de escrita/autoelevação, e-mail verificado, auditoria imutável e banimento. Executar `npm run test:rules` (Java 17+ e CLI 14.17 usada nesta validação); usa projeto fictício `demo-botecorate`, sem dados reais. Primeira validação detectou método não suportado nas regras e foi corrigida antes de qualquer publicação.
- `npm audit` após as dependências desta etapa: 23 alertas (21 altos e 2 moderados), sem crítico; inclui árvore de ferramentas/testes. Sem correção forçada de versões incompatíveis. Requer revisão específica e não equivale a aprovação de segurança da árvore inteira.

Novas bibliotecas: SQLite, NetInfo, Firebase, Expo Crypto/FileSystem, Native Stack/React Navigation, react-native-screens e noble/hashes. Instalação nativa feita pelas versões compatíveis do Expo SDK 57. As mudanças da árvore devem ser consideradas nesta nova rodada de testes; não são somente as quatro atualizações da rodada anterior.

## Próximas entregas e limites desta etapa

- Serviço Flask autenticado e protocolo de envio/recebimento completo, idempotência, conflitos, arquivos no Storage e escopo privado por conta.
- Painel administrativo, habilitação de dono, evidências empresariais, convites, unanimidade, transferência e custódia temporária.
- Edição completa/exclusão de bar, moderação com motivo e reflexo da copropriedade no ranking remoto.
- Integração Correios depois de confirmar acesso real e configuração; endereço manual preservado. Alterar endereço ainda não recalcula automaticamente o ponto GPS.
- Fluxos Firebase reais e validação manual Android/iOS. Proteção de descarte cobre também os formulários de avaliação de bares e itens; validar a interação com o gesto nos dispositivos. Android optou pelo gesto preditivo em `app.json`; essa opção exige rebuild nativo para binários existentes.

O esquema lógico completo de `BANCO_DE_DADOS.md` continua como alvo; esta etapa não implementa ainda todas as tabelas propostas. Não interpretar autenticação ou SQLite local como substituto da validação remota.

## Andamento da configuração com o usuário

O usuário registrou o app Web e forneceu uma captura de sua configuração cliente e a URL real `https://botecorate-default-rtdb.firebaseio.com/`. O `.env.local` foi preenchido e está ignorado pelo Git. As regras locais passaram no emulador. O usuário confirmou a publicação das regras e a habilitação do provedor E-mail/senha. Nenhum valor de chave cliente foi copiado para esta documentação e nenhuma credencial administrativa foi solicitada.

Verificação real somente de leitura após essa confirmação:

- Catálogo público: HTTP 200, vazio (a carga inicial ainda não foi executada).
- Caminho de autoridade sem autenticação: HTTP 401, acesso negado como esperado.
- Configuração pública do Authentication: HTTP 400, chave cliente inválida. A transcrição da imagem precisa ser substituída pelo valor `apiKey` copiado como texto do console; solicitado ao usuário. Não foram criadas contas nem realizadas gravações remotas nesse diagnóstico.

Correção concluída: o usuário forneceu o valor exato em texto; atualizado somente `.env.local`, ignorado pelo Git. Nova consulta à configuração pública do Authentication retornou HTTP 200, e o catálogo também retornou HTTP 200 (ainda vazio). Cadastro, login e entrega do e-mail ainda precisam de teste no aplicativo; a leitura de configuração não comprova esses fluxos. Nenhuma conta foi criada pelo diagnóstico.
