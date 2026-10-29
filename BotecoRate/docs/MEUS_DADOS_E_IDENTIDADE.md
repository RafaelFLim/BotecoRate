# Meus dados, nomes e senha — 29/10/2026

## Navegação

Atualização de feedback em 29/10: falhas aparecem na faixa fixa vermelha; nome inválido/ocupado e confirmação de senha divergente também são indicados junto ao campo. Erros não são mostrados como avisos neutros de sucesso. O caso de nome `.` está coberto em teste de componente. Padrão e roteiro em `FEEDBACK_E_ERROS.md`.

**Minha conta → Meus dados** mostra nome/e-mail e duas opções: **Trocar nome de usuário** e **Troca de senha**. Cada opção abre seu próprio formulário; Voltar/gesto retorna a Meus dados, com proteção contra descarte de alterações. Acesso e segurança continua separado para biometria/bloqueio/saída. Cada rota e conta tem estado próprio.

## Nome de usuário

- Entre 3 letras e 100 caracteres no total. Números e pontuação não contam como letras. Aceita letras latinas e os acentos da política compartilhada, números, espaços, ponto, hífen, sublinhado e apóstrofo. Não aceita emojis, símbolos fora da lista ou quebras de linha.
- Exemplos: `Ana123` é válido; `A`, `AB12`, `12345`, `...` e nomes com emoji não são válidos.
- Normaliza texto em NFC, espaços repetidos e bordas. A chave de disponibilidade ignora maiúsculas, os acentos suportados, espaços e pontuação permitida. `João Silva`, `JOAO.SILVA` e `joao_silva` ocupam a mesma chave. Não permite trocar apenas essas diferenças do nome atual.
- Conta local: disponibilidade entre contas locais deste aparelho, inclusive na transação de gravação. Renomear também atualiza `contas_locais.usuario_normalizado`, para o login usar o novo nome; mantém ID, senha e histórico. Offline não garante disponibilidade global. A ativação com e-mail verifica novamente o nome online, preservando a conta local se houver conflito.
- Conta Firebase: nome novo exige internet, e-mail verificado e conta ativa. `v1/username_index/{chave}` reserva o nome pelo UID. Reserva nova, liberação da anterior, perfil, diretório, cartão de convite e histórico são gravados juntos. As regras calculam a mesma chave e rejeitam duplicidade, chave forjada, alterações parciais e nomes inválidos, inclusive com chamadas diretas ao SDK.
- A troca libera a reserva anterior; a trilha original continua em `profile_history`. Exclusão administrativa não libera o nome imediatamente: manter a reserva enquanto a conta está na lixeira; sua limpeza deverá integrar o expurgo futuro. Nomes antigos inválidos não são renomeados à força; podem entrar e escolher um nome válido. Dados já existentes são preparados pela ferramenta administrativa.

A consulta de disponibilidade lê somente uma chave exata do índice (UID ou ausência); a listagem completa permanece bloqueada. Não expõe e-mail, senha ou diretório. O perfil RTDB é canônico; `Auth.displayName` é um espelho. Alterar somente esse espelho não muda o nome reconhecido pelo app.

## Troca de senha

**Conta com e-mail:** Meus dados → Troca de senha → Enviar confirmação por e-mail. O app usa `sendPasswordResetEmail` para o e-mail da própria conta autenticada, em português. O link recebido abre a página hospedada do Firebase onde a pessoa define e conclui a troca. O envio não equivale a senha alterada; a interface não afirma conclusão antes da ação no e-mail. Após concluir, entrar com a nova senha. Não há senha nova pendente no SQLite, RTDB, fila ou histórico, e o app não usa `updatePassword` para trocar a senha online diretamente.

**Exceção local confirmada pelo usuário:** a conta sem e-mail mantém senha atual, nova senha e confirmação no próprio app. Exige conferir a senha atual; limpa os campos após sucesso. Sessão/troca de conta e alteração concorrente do verificador são conferidas na gravação. Mantém somente salt/hash/custo, sem conteúdo de senha em auditoria.

A política do projeto Auth foi configurada e relida: mínimo de 8 caracteres, uma maiúscula e um caractere especial, sem forçar troca das senhas existentes no login. A lista de caracteres especiais do app foi alinhada à política Firebase. A conferência somente de leitura por `validatePassword` rejeitou senha fraca e aceitou um exemplo forte; não criou conta nem enviou e-mail. O fluxo de recuperação na tela de login usa o mesmo mecanismo de link.

Referências: [gerenciamento e redefinição de senha Firebase](https://firebase.google.com/docs/auth/web/manage-users#send_a_password_reset_email), [política de senha](https://docs.cloud.google.com/identity-platform/docs/password-policy), [operações de string nas regras RTDB](https://firebase.google.com/docs/reference/security/database#string_methods).

## Banco, publicação e preparação

Sem alteração do esquema SQLite 5. `usuarios_historico` continua guardando o nome anterior; `profile_history/{uid}/{versao}` é imutável e validado junto com o perfil novo. O índice é infraestrutura de unicidade, não um objeto excluível pelo usuário. A preparação registra autoria/data em `profile_names_preparation` e preserva identidades, permissões, propriedade e conteúdo.

As trocas de nome aparecem em **Painel administrativo → Histórico geral**, identificadas como Nome de usuário, com antes/depois, UID, data e versão, e também no histórico contextual da conta. Para eventos antigos, o valor seguinte vem do snapshot anterior da versão seguinte ou do perfil atual da mesma versão; se faltar evidência, aparece como indisponível no legado. A réplica SQL usa ID estável para não duplicar o evento ao atualizar o painel. Leitura global de perfis/históricos é restrita a admin ativo/verificado; o titular lê a própria trilha, e terceiros não leem outra conta.

Ferramenta local: `python -m server.manage prepare-profile-names --actor-uid UID_ADMIN --confirm-project botecorate`, com variáveis `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL` e credencial via `GOOGLE_APPLICATION_CREDENTIALS`, fora do Git. Aborta ao detectar nomes equivalentes entre UIDs diferentes; não resolve o conflito renomeando alguém. É aditiva/idempotente e prepara o diretório ausente a partir das contas reais. Política compartilhada em `src/constants/usernamePolicy.json`, usada pelo app, gerador de regras e preparação Python.

As ferramentas de importação do diretório e preparação dos cartões preservam o nome canônico antes do espelho Auth. A importação reconcilia as reservas na mesma transação e aborta em colisões; não é um atalho para renomear usuários fora do histórico.

Na publicação desta etapa: conferidas quatro contas e quatro reservas sem colisões; índice preparado com autoria administrativa e regras publicadas/relidas. A política Auth foi alterada apenas em `passwordPolicyConfig`; outras configurações preservadas. Backups privados em `.tools`, ignorados pelo Git. Nenhum usuário real foi renomeado, banido ou teve sua senha alterada pelos testes; nenhum e-mail real foi enviado pelo agente. Usar a versão atual nos aparelhos para cadastrar/alterar nomes; clientes anteriores não enviam a reserva exigida pelas regras.

## Validação e roteiro físico

Testes de serviço usam SQLite/PBKDF2 reais e simulam as fronteiras nativas/Auth. Testes de regras usam RTDB Emulator: nomes inválidos, igualdade normalizada, concorrência entre contas, diretório/índice forjados, e-mail não verificado, reserva inicial, liberação e auditoria imutável. A ferramenta Python testa normalização, preservação, idempotência e colisão. Isso não substitui o e-mail e os gestos no celular.

Resultado final automatizado: **106 testes aprovados** com RTDB Emulator, nenhum pulado; **20 testes Python aprovados**, com três integrações de servidor legado puladas nessa execução. Exportações Android/iOS aprovadas em `.tools/export-account-profile`. Sem commit/push. Recebimento do e-mail, conclusão do link e navegação física continuam pendentes.

1. Perfil → Meus dados: conferir as duas opções, abrir cada uma e voltar por botão/gesto.
2. Nome: testar atual, variante de maiúsculas/acentos/pontuação, nome ocupado, emoji, números/pontos e menos de três letras. Salvar nome disponível e conferir no perfil, outro aparelho e histórico; repetir offline para conferir erro recuperável em conta com e-mail.
3. Conta local: renomear, sair e entrar com o novo nome. Trocar senha com confirmação diferente/incorreta/correta; depois entrar com a nova senha.
4. Conta com e-mail: solicitar o link, conferir recebimento/spam, concluir na página Firebase e entrar com a senha nova. Testar link expirado/usado e reenvio pela interface padrão. Conferir que apenas solicitar o e-mail não troca a senha. Esta parte permanece pendente de teste físico pelo usuário.
