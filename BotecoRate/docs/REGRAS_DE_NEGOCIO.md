# BotecoRate — Regras de Negócio e Funcionalidades

> Documento de referência do projeto (Engenharia de Software, trabalho de dupla, 7º período).
> Reflete o estado do app neste momento do desenvolvimento — não é um documento estático:
> precisa ser atualizado conforme novas funcionalidades forem implementadas.

## Índice

1. [Visão geral](#1-visão-geral)
2. [Princípio transversal: histórico de alterações](#2-princípio-transversal-histórico-de-alterações)
3. [Arquitetura em resumo](#3-arquitetura-em-resumo)
4. [Autenticação e conta de usuário](#4-autenticação-e-conta-de-usuário)
5. [Bares](#5-bares)
6. [Avaliações de bar](#6-avaliações-de-bar)
7. [Cardápio (comidas e bebidas)](#7-cardápio-comidas-e-bebidas)
8. [Avaliações de item do cardápio](#8-avaliações-de-item-do-cardápio)
9. [Mapa](#9-mapa)
10. [Modelo de dados](#10-modelo-de-dados)
11. [Regras de negócio consolidadas](#11-regras-de-negócio-consolidadas)
12. [Decisões técnicas e limitações conhecidas](#12-decisões-técnicas-e-limitações-conhecidas)
13. [Próximos passos](#13-próximos-passos)

---

## 1. Visão geral

BotecoRate é um app de avaliação de bares e botecos regionais, inspirado no concurso **Comida di
Buteco**: cada bar compete com o que serve (comidas e bebidas do cardápio), e a nota vem da
comunidade de usuários do app. Os 3 bares mais bem avaliados aparecem destacados com selo de
medalha na listagem, no mesmo espírito de ranking do concurso.

Todo o dado é local ao aparelho (sem backend/API): contas, bares, avaliações e cardápios ficam
salvos no `AsyncStorage` do dispositivo.

## 2. Princípio transversal: histórico de alterações

Esta é uma regra estrutural do app, não um detalhe de uma funcionalidade específica — vale pro
que já existe e é **obrigatória para qualquer funcionalidade nova** que vier a guardar
informação editável pelo usuário:

> **Toda informação que o usuário pode editar precisa manter um histórico de alterações**: antes
> de aplicar uma edição, a versão anterior do dado (os campos editáveis + a data em que valia) é
> empilhada num registro de histórico. Nada é sobrescrito sem deixar rastro de como era antes.

Padrão técnico usado em todo lugar que já implementa isso: cada registro tem um array
`historico`; cada edição empurra um snapshot dos campos editáveis de antes da mudança, junto com
a data; o registro atual passa a ter `editadoEm` preenchido com a data da última edição.

### Onde já está implementado

| Funcionalidade | O que entra no histórico a cada edição |
|---|---|
| Avaliação de bar | nota, comentário, data |
| Avaliação de item de cardápio | nota, comentário, data |
| Item de cardápio (nome/descrição/valor/tipo/foto) | tipo, nome, descrição, valor, foto, data |

### Onde ainda não se aplica, e por quê

- **Dados do próprio bar** (nome, endereço, foto, detalhes): hoje não existe nem uma tela pra
  editar esses campos depois do cadastro — então ainda não há o que ter histórico. **Quando** uma
  edição de bar for implementada, ela precisa nascer seguindo esta regra, sem exceção.
- **Senha da conta**: a troca de senha (tela de Perfil) hoje **não** guarda a senha anterior.
  Isso está em aberto — ver decisão pendente na seção 12: manter sem histórico (guardar senha
  antiga é prática ruim mesmo num app sem hash) ou aplicar a regra aqui também.

## 3. Arquitetura em resumo

- **Navegação**: manual, via `useState` em `App.js` e sub-navegação local dentro de cada tela
  (sem React Navigation / Expo Router).
- **Persistência**: dois serviços, cada um lendo/gravando a lista inteira de uma vez —
  `src/services/authStorage.js` (contas e sessão) e `src/services/storage.js` (bares, que
  carregam dentro de si o cardápio e as avaliações). Não há lógica de negócio dentro dos
  serviços: cada tela é responsável por montar a lista atualizada antes de salvar.
- **Sem backend**: tudo roda no aparelho. Isso implica em regras específicas descritas nas
  seções seguintes (ex.: senha em texto puro, dados de seed).

## 4. Autenticação e conta de usuário

### 4.1 Cadastro de conta (`TelaCadastroUsuario`)

- Campos: usuário (nome de login) e senha (com confirmação).
- **Regras de validação**, nessa ordem:
  1. Usuário e senha não podem estar vazios.
  2. Senha e confirmação de senha precisam ser iguais.
  3. A senha precisa passar na validação de força (ver [12](#senha)): mínimo 8 caracteres, ao
     menos 1 letra maiúscula e ao menos 1 caractere especial.
  4. Não pode já existir uma conta com o mesmo nome de usuário (comparação sem diferenciar
     maiúsculas/minúsculas).
- Conta criada não loga automaticamente — a pessoa é levada de volta pro login.

### 4.2 Login (`TelaLogin`)

- Usuário + senha precisam bater exatamente (comparação sem diferenciar maiúsculas/minúsculas
  só no nome de usuário; a senha é sensível a maiúsculas/minúsculas) com uma conta salva.
- Sem nenhuma conta cadastrada no aparelho, o login informa isso e pede pra criar conta primeiro.
- Ao logar com sucesso, o **id da conta** é gravado como "sessão" do aparelho — é essa conta que
  o atalho de biometria (ver 4.3) destrava depois.

### 4.3 Biometria — atalho de entrada (`TelaBiometria`)

- Se existe uma sessão salva no aparelho (alguém já logou nele antes), a tela de login mostra um
  botão "👆 Entrar como *usuário*".
- Tocar nesse botão pede autenticação biométrica do aparelho (digital/face, via
  `expo-local-authentication`).
- **Sucesso**: entra direto na listagem de bares como a conta da sessão, sem digitar senha.
- **Falha**: oferece tentar de novo, ou "Voltar para o login" (isso desloga — limpa a conta
  ativa e volta pro formulário de usuário/senha).
- A lógica interna dessa tela é tratada como "não mexer" pelo time — só é importada/conectada
  por outras telas.

### 4.4 Perfil (`TelaPerfil`)

Acessível pelo avatar (inicial do nome) no cabeçalho da listagem de bares.

- Mostra nome do usuário logado.
- **Trocar senha**: exige a senha atual correta + uma nova senha que passe na validação de força
  (mesmas regras do cadastro). Não há trava impedindo a nova senha de ser igual à atual.
- **Sair**: desloga por completo (limpa a conta ativa da memória) e volta para a tela de login.

## 5. Bares

### 5.1 Listagem / Ranking / Medalhas (`TelaListagemBares`)

- A lista de bares **é o próprio ranking**: ordenada da maior nota média pra menor.
- Os **3 primeiros bares que já têm pelo menos 1 avaliação** recebem selo de medalha (🥇 🥈 🥉),
  sobreposto na foto do card — no estilo do pódio do Comida di Buteco.
- Um bar sem nenhuma avaliação **nunca** recebe medalha, mesmo que apareça no topo por falta de
  concorrência (nota média de bar sem avaliação é considerada 0).
- Cabeçalho da tela: título do app, botão "🗺️ Mapa", botão "+ Bar" (cadastro) e avatar do
  usuário (leva ao Perfil).

### 5.2 Cadastro de bar (`TelaCadastroBar`)

Só é possível salvar o bar se **todas** as condições abaixo forem satisfeitas:

| Campo | Obrigatório? | Regra |
|---|---|---|
| Foto do bar | Sim | Tirada na hora pela câmera do app (`TelaCamera`) |
| Nome | Sim | Texto livre |
| Endereço | Sim | Pré-preenchido pela geolocalização atual (se disponível); sempre editável |
| Detalhes do bar | Sim | Texto livre (ambiente, especialidades, diferenciais) |
| Cardápio | Sim | **Mínimo 3 itens**, entre comidas e/ou bebidas (não precisa ser 3 de cada — a mistura é livre) |

- **Localização/GPS**: se o aparelho não conseguir localização (permissão negada ou GPS
  desligado), a pessoa pode escolher "Cadastrar sem localização" — o bar é salvo sem
  coordenadas, aparece na listagem normalmente, mas **não aparece no mapa** até ser posicionado
  depois (ver 5.4).
- O bar salvo grava `criadoPor` com o nome de usuário de quem cadastrou — esse campo é a base da
  trava de dono usada no cardápio (ver 7.3).
- Bar novo entra sempre com `avaliacoes: []` (zerado).

### 5.3 Detalhes do bar (`TelaDetalhesBar`)

Mostra, nessa ordem: foto grande, nome/endereço/nota média, aviso + botão de posicionar no mapa
(se aplicável), seção "Detalhes" (texto livre do cadastro), seção "Cardápio" (ver 7), lista de
avaliações da comunidade (ver 6) e o formulário de nova avaliação.

### 5.4 Posicionar bar no mapa depois

Bar cadastrado sem localização mostra, na tela de detalhes, um aviso e o botão
"📍 Adicionar ao mapa", que:

1. Pede permissão de localização, se ainda não tiver.
2. Tenta converter o **endereço digitado** em coordenadas (geocodificação).
3. Se não conseguir, usa a **localização atual do aparelho** como posição do bar.
4. Falhando os dois (sem endereço reconhecível e sem GPS ligado), avisa e não salva nada.

## 6. Avaliações de bar

Sistema de avaliação da comunidade sobre o bar como um todo.

- **Campos**: nota (1 a 5 estrelas, obrigatória) e comentário (opcional — se vazio, salva
  "Sem comentário.").
- **Autoria**: toda avaliação grava o nome de quem avaliou (`autor`); sem usuário logado no
  momento, grava "anônimo" (situação apenas defensiva, não deve ocorrer no fluxo normal).
- **Uma avaliação por pessoa, por bar**: se o usuário logado já tem uma avaliação nesse bar, o
  formulário de nova avaliação **some** e vira um aviso explicando que a edição é feita direto
  no card da avaliação já existente.
- **Editar / excluir**: os ícones ✏️ (editar) e 🗑️ (excluir) só aparecem no card da própria
  avaliação do usuário logado — nunca nas avaliações de outras pessoas.
- **Data e hora**: toda avaliação grava `criadoEm` (quando foi feita). Uma edição grava
  `editadoEm` e o card passa a mostrar essa data (com a marca "(editado)") em vez da data de
  criação.
- **Histórico de edições**: segue o princípio da seção 2 — a cada edição, a versão anterior
  (nota + comentário + data) é empilhada, disponível por um link "Ver histórico de edições"
  dentro do card.
- **Exclusão**: pede confirmação antes de remover.

## 7. Cardápio (comidas e bebidas)

### 7.1 Estrutura de um item

Cada bar tem uma lista `cardapio`, onde cada item tem: tipo (`comida` ou `bebida`), nome,
descrição (detalhes — ingredientes, tamanho etc.), valor (preço), foto (opcional) e sua própria
lista de avaliações (ver 8).

### 7.2 Cadastro — mínimo obrigatório (`TelaCadastroBar`)

- Ao cadastrar um bar novo, é preciso montar uma lista de **no mínimo 3 itens** de cardápio
  antes de conseguir salvar o bar (ver tabela em 5.2). O contador na tela mostra
  "X/3" e confirma com ✓ quando a exigência é atingida.
- Cada item, pra entrar na lista, precisa de: nome, tipo (comida/bebida), descrição e valor
  válido (número maior que zero, aceita vírgula como separador decimal). A foto é opcional.
- Os itens ficam numa lista local (removível antes de salvar) até o bar inteiro ser gravado de
  uma vez.

### 7.3 Adicionar item depois de o bar já existir (`TelaDetalhesBar` → `TelaFormularioItem`)

- Só quem **cadastrou o bar** (`bar.criadoPor` bate com o usuário logado) vê o botão "+ Item" na
  seção de Cardápio da tela de detalhes.
- **Exceção de compatibilidade**: bar sem `criadoPor` registrado (criado antes desse campo
  existir) libera a edição do cardápio pra **qualquer** usuário logado, pra não ficar travado
  pra sempre sem dono.
- O formulário de item novo usa as mesmas regras de validação do cadastro (nome, tipo,
  descrição e valor obrigatórios; foto opcional).

### 7.4 Editar / excluir item do cardápio

- Mesma trava de dono do item 7.3: só quem pode adicionar item também pode editar ou excluir os
  itens existentes (ícones ✏️/🗑️ em cada linha do cardápio).
- **Editar**: abre o mesmo formulário, pré-preenchido com os dados atuais do item.
- **Excluir**: pede confirmação antes de remover o item (e, junto, todas as avaliações que esse
  item já tinha).
- **Histórico de edições do item**: segue o princípio da seção 2 — cada edição guarda a versão
  anterior (tipo, nome, descrição, valor, foto e data), visível na tela de detalhes do item como
  "Ver histórico de edições do item".

### 7.5 Exibição na listagem do bar

A seção Cardápio, na tela de detalhes do bar, lista cada item com foto (ou ícone-placeholder por
tipo), nome, nota média + quantidade de avaliações, e valor formatado em reais. Tocar num item
abre a tela de detalhes dele.

## 8. Avaliações de item do cardápio

Sistema **idêntico** ao de avaliação de bar (seção 6), só que aplicado a um item específico do
cardápio em vez do bar inteiro:

- Nota (1-5) obrigatória, comentário opcional.
- Uma avaliação por usuário por item (bloqueia formulário se já avaliou, mostra aviso).
- Editar/excluir só na própria avaliação.
- Data de criação/edição e histórico de edições da avaliação, igual ao do bar.

> Importante: **não confundir** com o histórico de edições do item em si (7.4) — são dois
> históricos independentes: um é sobre o item mudar de nome/preço/descrição, o outro é sobre uma
> avaliação daquele item ser editada.

## 9. Mapa

- Mostra a localização atual do usuário (pede permissão + exige GPS ligado) e um pino por bar
  que tenha coordenadas salvas.
- Bar cadastrado sem localização **não aparece** no mapa até ser posicionado (ver 5.4).
- Toque num pino de bar mostra nome, endereço e distância até o usuário.
- Tela acessível pelo botão "🗺️ Mapa" no cabeçalho da listagem.

## 10. Modelo de dados

### Usuário (`@boteco_rate_usuarios`)

```js
{ id, usuario, senha }
```

### Sessão (`@boteco_rate_sessao`)

```js
{ usuarioId }
```

### Bar (dentro da lista `@boteco_rate_bares`)

```js
{
  id, nome, endereco, foto, detalhes, criadoPor,
  latitude, longitude,        // null se cadastrado sem GPS
  avaliacoes: [ AvaliacaoDeBar ],
  cardapio: [ ItemDeCardapio ],
}
```

### Avaliação (de bar ou de item — mesma forma)

```js
{
  id, nota, comentario, autor,
  criadoEm, editadoEm,        // ISO 8601; editadoEm é null até a 1ª edição
  historico: [ { nota, comentario, data } ],
}
```

### Item de cardápio

```js
{
  id, tipo,                   // 'comida' | 'bebida'
  nome, descricao, valor, foto,
  criadoEm, editadoEm,
  historico: [ { tipo, nome, descricao, valor, foto, data } ],
  avaliacoes: [ Avaliacao ],
}
```

## 11. Regras de negócio consolidadas

1. **Toda informação editável pelo usuário mantém histórico de alterações** (ver seção 2) — não
   é opcional, é padrão obrigatório do projeto.
2. Não existe backend — tudo é local ao aparelho (AsyncStorage).
3. Conta é única por nome de usuário (case-insensitive), senha guardada em texto puro.
4. Senha (criação ou troca) precisa ter ≥ 8 caracteres, 1 maiúscula e 1 caractere especial.
5. Biometria é um atalho pra última conta que logou no aparelho — não substitui o login por
   usuário/senha, que continua disponível.
6. "Sair" do Perfil é logout completo (limpa a sessão ativa e volta ao login).
7. Todo bar precisa, pra ser cadastrado, de: foto, nome, endereço, detalhes e no mínimo 3 itens
   de cardápio.
8. Bar sem GPS no momento do cadastro pode ser salvo mesmo assim, mas fica fora do mapa até ser
   posicionado manualmente.
9. A listagem de bares é ordenada por nota média (ranking); só os 3 primeiros com avaliação
   ganham medalha.
10. Um usuário só pode ter **uma** avaliação por bar e **uma** avaliação por item de cardápio.
11. Só o autor de uma avaliação pode editá-la ou excluí-la; edição gera entrada no histórico da
    avaliação.
12. Só quem cadastrou o bar (`criadoPor`) pode adicionar, editar ou excluir itens do cardápio
    dele; bar sem dono registrado (dado legado) libera essa ação pra qualquer usuário logado.
13. Editar um item do cardápio gera entrada no histórico do **item** (independente do histórico
    das avaliações desse item).
14. Cada item de cardápio precisa de nome, tipo, descrição e valor (> 0); a foto é sempre
    opcional.

## 12. Decisões técnicas e limitações conhecidas

- <a name="senha"></a>**Senha em texto puro**: decisão consciente por ser trabalho acadêmico —
  em um app real, a senha seria armazenada como hash. A validação de força (regra 4 acima)
  reduz o risco de senha fraca, mas não substitui um hashing adequado.
- **Sem recuperação de senha**: não existe fluxo de "esqueci minha senha" — perder a senha
  significa perder o acesso àquela conta.
- **Dados de demonstração (seed)**: `src/data/mockBares.js` traz 4 bares fictícios (incluindo um
  baseado num local real, o Bar e Mercearia do Rubão, em Vassouras/RJ) com avaliações, cardápio
  e donos fictícios, usados na primeira execução do app ou mesclados automaticamente em cima do
  que já estiver salvo no aparelho (bar novo do seed é adicionado; bar já existente ganha os
  campos que porventura ainda não tinha, sem sobrescrever o que a pessoa já editou).
- **Um só aparelho**: a "conta" vive só no AsyncStorage daquele aparelho — reinstalar o app ou
  trocar de aparelho perde usuários, bares e avaliações criados durante os testes (os 4 bares
  de seed voltam, mas nada que a pessoa tenha cadastrado por cima).
- **Regras não retroativas**: a exigência de senha forte (regra 4) só vale pra senha nova
  (criação ou troca) — não força quem já tem conta com senha antiga a atualizar no próximo
  login.
- **Pendência**: decidir se a troca de senha também passa a guardar histórico (ver seção 2) ou
  se fica formalmente marcada como exceção à regra 1.

## 13. Próximos passos

- ⬜ Decidir sobre fluxo de recuperação de senha e/ou remoção de conta.
- ⬜ Decidir se a troca de senha entra na regra de histórico (seção 2) ou fica como exceção
  documentada.
- ⬜ Se/quando existir edição dos dados do próprio bar (nome, endereço, foto, detalhes), ela
  precisa nascer com histórico de alterações, seguindo a regra 1.
