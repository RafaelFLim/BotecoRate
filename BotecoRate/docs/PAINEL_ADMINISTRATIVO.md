# Painel administrativo

Implementação de 22/10/2026. Acesso: **Minha conta → Painel administrativo**, com conta Firebase ativa, administrativa e e-mail verificado. Exige internet. Não usa Flask nem credenciais administrativas no celular.

## Funções entregues

- Buscar usuário por nome, e-mail ou UID; consultar permissão, estado e histórico.
- Alterar permissão entre comum, dono e admin. Promoções exigem e-mail verificado no diretório sincronizado com o token de autenticação. A solicitação/comprovação de propriedade de um estabelecimento continua sendo uma etapa separada.
- Banir, restaurar acesso de banido e excluir logicamente o usuário. Exclusão move para a lixeira administrativa, com `deleted_at` e `purge_after` de 30 dias; restauração administrativa permitida dentro desse prazo.
- Buscar avaliações de bares e de itens; ocultar, restaurar e mover para a lixeira com justificativa. Não se altera nota, texto nem autor da opinião. Ocultar não inicia prazo de exclusão; enviar à lixeira inicia.
- Consultar histórico geral e de cada registro, com data local, responsável, versão, valores anteriores/novos e justificativa; busca por data ISO, responsável, registro ou motivo.

Todas as ações administrativas exigem justificativa de 5–500 caracteres e confirmação. O admin não altera o próprio acesso: isso evita perder o último administrador pelo painel. Para duas contas administrativas, a autorização é reavaliada no servidor em cada escrita; um administrador já removido perde a autoridade de escrever.

## Banco e regras

| Caminho Realtime Database | Finalidade | Leitura |
| --- | --- | --- |
| `v1/user_directory/{uid}` | Nome, e-mail, verificação, UID e atualização; sem senha | Próprio usuário e admin ativo verificado |
| `v1/access_control/{uid}` | Autoridade de papel/estado, versão, motivo e exclusão | Próprio usuário e admin ativo verificado |
| `v1/access_history/{uid}/{version}` | Evento com `before`, `record` e responsável | Admin ativo verificado |
| `v1/direct/moderation/{tabela}/{id}` | Estado de moderação separado da avaliação | Mesmo acesso do catálogo autenticado |
| `v1/direct/moderation_history/{tabela}/{id}/{version}` | Histórico da moderação | Mesmo acesso do catálogo autenticado |

Diretório e acesso administrativo não ficam dentro de `direct`, pois a leitura autenticada desse caminho é mais ampla. A moderação é visibilidade no produto, não sigilo do conteúdo: o catálogo autenticado ainda contém os originais e o histórico. A remoção definitiva do conteúdo faz parte da etapa da lixeira geral.

Uma escrita multipath salva estado e histórico juntos. Regras exigem versão seguinte, responsável autenticado e igualdade de todos os campos antes/depois; sem evento correspondente, ou com evento forjado, a operação falha. Não é permitido apagar/substituir históricos pelo SDK cliente. Alterar `papel` no SQLite não concede autoridade remota.

O diretório é publicado pela própria conta no cadastro/login/atualização do perfil, sem permitir que ela publique seu papel. Contas antigas podem entrar novamente ou ser importadas pela ferramenta administrativa local. O diretório é uma projeção: a identidade de login continua no Firebase Authentication.

## SQLite versão 4

Migração aditiva executa `CREATE TABLE/INDEX/VIEW IF NOT EXISTS`, preservando catálogo, contas, fila e históricos. Tabelas novas:

- `review_moderation`: chave composta tabela/ID, estado, justificativa, responsável, versão, atualização, `deleted_at` e prazo.
- `review_moderation_historico`: eventos imutáveis recebidos, identificados por tabela/ID/versão.
- `admin_access_historico`: cópia dos eventos de acesso lidos por um admin; não contém senha, token ou e-mail.

O snapshot direto recebe a moderação e a projeta no SQLite na mesma transação. Avaliações ocultas/excluídas ficam fora da exibição e do cálculo do ranking após a sincronização; o conteúdo original é preservado. A gravação de outra parte do catálogo não confunde uma opinião oculta com exclusão solicitada pelo autor. Como os demais dados, outro aparelho offline só conhece a moderação quando sincroniza.

Uma assinatura do acesso remoto atualiza o papel da sessão aberta. Banimento/exclusão remove a sessão do app e a referência de acesso por biometria. As regras já bloqueiam imediatamente novas operações online; a notificação no celular depende da conexão. Após restauração, a conta volta a entrar normalmente.

## Limites explícitos

- A exclusão desta etapa bloqueia o BotecoRate; não apaga nem desabilita fisicamente uma identidade de terceiro no Authentication. Isso requer Admin SDK em ambiente confiável, fora do app.
- Lixeira geral para bares/itens, remoção definitiva manual e limpeza automática aos 30 dias **ainda não implementadas**. Nenhuma limpeza automática é anunciada como ativa. O planejamento aprovado está em `LIXEIRA_E_RETENCAO.md`.
- Banir/excluir um dono não apaga os bares ou suas relações. Admins ativos continuam gerenciando qualquer bar; custódia institucional automática continua pendente.
- O painel e a busca carregam o conjunto atual em memória, apropriado ao volume acadêmico. Paginação e índices remotos específicos serão necessários conforme crescimento.

## Verificação

Testes em SQLite real e Firebase Database Emulator cobrem isolamento do diretório, promoção, banimento, moderação, motivos, CAS, integridade/imutabilidade de históricos, proteção contra autoalteração, prazo e restauração. Não são usados usuários reais para testar banimentos ou exclusões. O roteiro físico está em `TESTES_APLICATIVO.md`.


Resultado final desta entrega: 37 testes locais aprovados, 16 testes com dependência de emulador pulados nessa execução; 21 testes aprovados na execução específica do emulador; 11 testes Python aprovados e 2 pulados. Compilações de exportação Android/iOS aprovadas e scanner de segredos sem ocorrências nos 103 arquivos rastreáveis. Regras administrativas publicadas e conferidas; três contas reais importadas no diretório, com autoridade e catálogo preservados. Teste físico do painel ainda deve ser realizado com o roteiro, usando contas de teste.
