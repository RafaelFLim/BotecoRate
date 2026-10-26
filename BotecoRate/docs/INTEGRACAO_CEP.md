# Consulta de CEP com ViaCEP — 26/10/2026

O usuário autorizou substituir Correios por ViaCEP em 26/10/2026. Escopo: **CEP → endereço**, no cadastro e na edição de bares, mantendo a digitação manual. A integração dos Correios foi retirada anteriormente.

## Fluxo entregue

1. Informar oito dígitos, com ou sem hífen, e tocar em **Buscar endereço pelo CEP**.
2. Conferir a prévia e tocar em **Usar este endereço**. A consulta sozinha não substitui nem salva o endereço existente.
3. Completar número/complemento no campo **Endereço completo**. Para CEP geral sem rua, informar também o logradouro/bairro. O complemento postal do ViaCEP não é usado como complemento do imóvel.
4. Salvar o bar pelo fluxo normal. É possível preencher tudo manualmente, inclusive offline.

Cadastro abre sem pedir GPS. O botão **Estou no bar: usar minha localização** define somente as coordenadas do aparelho; não altera o texto do endereço. Há opção para continuar sem aguardar. A consulta de CEP não fornece coordenadas. Alterar o endereço remove a posição anterior, evitando marcar outro local no mapa; pode-se definir novamente a posição estando no estabelecimento.

## Integração e persistência

- `src/services/cepService.js` consulta diretamente `https://viacep.com.br/ws/{cep}/json/`, por HTTPS, com validação prévia, limite de dez segundos incluindo leitura JSON e cancelamento. Não exige chave, Bearer Token ou Flask, nem acrescenta dependências.
- `src/components/CampoEndereco.js` é compartilhado pelas duas telas. Troca de CEP, edição manual, indisponibilidade do formulário, troca de conta e desmontagem descartam consultas/previsões anteriores. Uma resposta atrasada não altera o endereço.
- O texto aplicado utiliza o campo `endereco` existente: SQLite, histórico, fila e sincronização direta Firebase seguem o mesmo protocolo. O CEP consultado é somente uma ferramenta de preenchimento; não é salvo separadamente nem infere CEP de endereços antigos. Não houve migração ou publicação de regras.
- Erros de formato, CEP não encontrado, resposta inválida, indisponibilidade, falta de conexão e timeout são apresentados sem apagar o endereço existente. Não há consultas automáticas por tecla nem busca em lote.
- A API pública é de terceiro; o resultado deve ser conferido. Fonte: [documentação oficial ViaCEP](https://viacep.com.br/). As instruções versionadas do [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) foram consultadas antes das alterações.

## Validação e roteiro físico

- `npm test`: 44 aprovados, 10 cenários dependentes de emulador pulados. Seis testes novos cobrem formato, URL/ausência de credenciais, CEP geral/inexistente, falhas, timeout e cancelamento.
- Consulta real pela função implementada: `01001-000` retornou `Praça da Sé - Sé - São Paulo - SP` em 26/10/2026. Nenhum bar foi criado/alterado remotamente por esse teste.
- Geração dos bundles Android/iOS conferida nesta entrega. Validação física no Expo Go ainda depende do usuário.

Roteiro para Android/Expo Go (conta admin ou dono vinculado):

1. Abrir **Novo bar** com GPS desligado/sem permissão: formulário deve abrir e permitir CEP e endereço manual.
2. Buscar `01001-000`: conferir a prévia, aplicar, completar número e salvar com foto/detalhes/três itens. Reabrir e conferir o texto. Sincronizar e conferir em outro aparelho quando disponível.
3. Em **Gerenciar bar**, consultar outro CEP: endereço atual deve permanecer até aplicar. Aplicar e verificar remoção da posição antiga; salvar e reabrir.
4. Testar `123`, `99999999` e modo avião. Endereço anterior deve continuar disponível para edição/salvamento manual.
5. Consultar CEP geral sem logradouro e completar a rua manualmente.
6. Durante busca, mudar CEP, editar endereço, sair ou trocar de conta. Resposta anterior não deve substituir o rascunho.
7. Confirmar que número/complemento podem ser editados; usar GPS somente estando no bar e verificar que não altera o texto. Cancelar a espera de GPS e continuar o cadastro.

Próxima etapa da sequência continua dependendo do retorno sobre os testes desta entrega; fotos e demais pendências não foram iniciadas.

## Integração com atualização remota

Em 26/10/2026, ViaCEP foi reaplicado sobre `ce815a2`, preservando administração/copropriedade e suas decisões atuais. Suíte combinada: 55 aprovados e 23 cenários dependentes de emulador pulados. A contagem anterior corresponde à entrega antes dessa integração.
