# Comunicação de erros — requisito central

Decisão de 29/10/2026: mensagens de erro devem ser explícitas, sempre em vermelho e perceptíveis no ponto em que a pessoa tenta concluir uma ação. Cor sozinha não basta. Não apresentar falhas como avisos neutros nem depender de uma mensagem no começo de um formulário longo.

## Padrão implementado

- `MensagemErro` concentra a aparência: texto e borda vermelhos (`#b91c1c`), fundo claro, prefixo **Erro:**, sem truncar o conteúdo ou sumir por temporizador. Usa papel de alerta/região assertiva para acessibilidade e anúncio explícito no iOS. Isso não substitui validação física com TalkBack/VoiceOver.
- `Formulario error={error}` mantém o erro fora do ScrollView e do deslocamento do teclado, abaixo do cabeçalho. A mensagem continua visível mesmo quando o campo/botão está longe do início do conteúdo. Não provoca rolagem para o topo nem apaga o rascunho.
- `Campo error={fieldError}` destaca a borda em vermelho, descreve o problema imediatamente abaixo do campo e fornece a orientação à acessibilidade. O anúncio principal fica na faixa; o texto do campo não cria outro alerta automático. Usar quando o campo incorreto for conhecido, sem marcar arbitrariamente um campo em falhas gerais de rede/autorização.
- Mensagens informativas, sucesso, confirmação de e-mail ainda pendente, modo offline esperado e confirmações destrutivas são separados de erros. Recuperação de senha enviada com sucesso não aparece em vermelho. Falha parcial (conta criada, mas e-mail não enviado) preserva a conta e mostra o problema em vermelho, sem induzir cadastro duplicado.
- Nova tentativa limpa o erro anterior; em campos com validação associada, editar limpa a mensagem obsoleta. Não usar o desaparecimento do erro como confirmação de gravação. Sucesso depende da operação terminar.

## Aplicação nesta etapa

Meus dados/nome/senha/vínculo, login/cadastro, administração, propriedade e gerenciamento de bar usam o erro fixo do formulário. O nome `.` é validado antes da chamada de alteração: recebe o aviso de pelo menos três letras no campo e na faixa fixa. Duplicidade remota também aparece no campo; divergência das senhas aponta a confirmação.

Cadastros de bar/item e telas de avaliações receberam a faixa fora da área rolável. Falhas de gravação/atualização/revogação em App recebem uma faixa global vermelha; a faixa global pode ser fechada, é limpa na troca de conta e a de sincronização desaparece ao atualizar com sucesso. Erros de consulta de CEP e de lotes já rejeitados aparecem junto à consulta/registro correspondente, em vermelho. Mapa, biometria, abertura e câmera também usam o componente comum.

Erros da câmera não usam mais apenas um Alert nativo. Ao receber uma foto, a câmera aguarda a cópia/retorno do aplicativo: se falhar, mostra a mensagem e permite tentar novamente, sem abrir um modal de sucesso sobre o erro. Diálogos nativos do sistema para permissões/biometria e confirmações informativas/destrutivas mantêm a aparência da plataforma; não são o único feedback de uma falha do app.

## Regras para próximas entregas

Históricos, lixeiras, validação de donos e custódia devem seguir este padrão. A mensagem precisa dizer o que não foi possível concluir e como corrigir/tentar novamente, preservando os dados digitados. Não incluir senhas, tokens, Base64 ou detalhes privados em erros. Não usar alertas neutros como único resultado de uma falha, toast curto ou mensagem escondida na rolagem. Evitar marcar sucesso antes de confirmar a operação.

Esta etapa altera somente apresentação e tratamento das falhas já detectadas. Não acrescenta dependência, tabela/migração SQLite ou regra Firebase; não muda as validações de negócio/autorização. As mensagens não entram como dados de negócio na fila/histórico e não registram credenciais.

## Verificação

Regressões executam os componentes reais com fronteiras nativas simuladas: nome `.`, duplicidade remota, confirmação de senha divergente, erro fora da rolagem/teclado, borda vermelha/orientação do campo, alerta/anúncio acessível, recuperação bem-sucedida separada de erro e falha assíncrona da cópia da foto sem sucesso indevido. Não são observação da tela nem teste nativo do teclado/leitor de tela.

Resultado: sete testes de interface aprovados; suíte local com 82 aprovados, sem falhas, e 31 casos dependentes de emulador pulados nesta execução. Exportações Android/iOS aprovadas em `.tools/export-error-feedback`. Regras e protocolo remoto não foram alterados nesta etapa; a suíte do emulador aprovada anteriormente não foi repetida. Scanner aprovado em 146 arquivos, diff sem erros de whitespace. Sem commit/push.

Roteiro físico:

1. Meus dados → Trocar nome: digitar `.` e salvar com o teclado aberto e a tela rolada até o botão. Conferir faixa fixa vermelha, borda/mensagem no campo e manutenção do texto. Corrigir e salvar um nome disponível.
2. Testar nome ocupado e confirmação de senha divergente; depois corrigir. Sucesso não deve permanecer marcado como erro.
3. Login errado e consulta CEP sem rede: conferir mensagens explícitas e rascunhos preservados. Envio válido da recuperação deve aparecer como informação.
4. Testar formulário de bar/item incompleto, negativa de localização e eventual falha de foto, com retorno/repetição disponíveis.
5. No Android/iOS, conferir teclado, fontes ampliadas, botões/gestos e anúncio com TalkBack/VoiceOver. Validação física permanece pendente.

Referência: [acessibilidade no React Native](https://reactnative.dev/docs/accessibility).
