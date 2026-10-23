# Arquivos privados e verificação antes do commit

Atualizado em 22/10/2026. O `.gitignore` da raiz protege todas as pastas do repositório:

- `.env`, variantes `.env.*`, `.envrc` e arquivos `*.env`. Exceções permitem exemplos `.env.example` / `.env.*.example`, sem credenciais preenchidas.
- Diretórios de credenciais/segredos, nomes usuais de JSON de conta de serviço, chaves privadas, certificados e arquivos SSH privados.
- Bancos `.db`, `.sqlite`, `.sqlite3` e seus sidecars, backups, ferramentas locais e ambientes Python. Esquemas `.sql`, código e regras Firebase continuam versionáveis.

`.env.local` e o JSON administrativo existente fora do repositório não foram movidos nem apagados. O arquivo `BotecoRate/.claude/settings.json` já estava rastreado, apesar da regra de ignore; removido somente do índice, mantendo sua cópia local. Não continha credenciais na verificação. A remoção passa a valer para o repositório remoto depois do próximo commit/push. Não foi reescrito o histórico.

## Checagem de conteúdo

Da pasta BotecoRate:

```powershell
npm run check:secrets
npm run check:secrets -- --staged
```

O primeiro comando examina os arquivos rastreados e não ignorados que podem entrar no Git. O segundo examina o **conteúdo efetivamente preparado no índice**, mesmo que o arquivo tenha sido editado depois de `git add`. São operações somente de leitura; não preparam nem publicam arquivos.

`scripts/check-secrets.cjs` detecta formatos comuns de chaves privadas, contas de serviço e tokens, e bloqueia arquivos privados conhecidos ou credenciais preenchidas nos exemplos. Relata arquivo, linha e categoria, sem imprimir o segredo. Não é uma garantia contra todo tipo de informação sensível: nomes arbitrários, senhas sem formato reconhecível e conteúdo binário exigem revisão humana. Não foi instalado hook global ou alterada configuração de hooks do Git; execute a checagem do staging após preparar o commit.

O Firebase cliente usa valores `EXPO_PUBLIC_*` que são incorporados ao app. Esses identificadores não são credenciais administrativas, e o ignore não os torna secretos no aplicativo distribuído. A autorização depende de Authentication e regras remotas. Chave privada/Admin SDK nunca deve ser colocada no código cliente ou nessas variáveis.

Se uma chave real já tiver sido publicada, ignorar/apagar em commit posterior não resolve o vazamento: é preciso revogar/substituir a chave e avaliar a limpeza do histórico. Nesta revisão não foram encontrados os padrões de credenciais privadas procurados nos arquivos candidatos nem no histórico consultado; não foi necessária rotação ou alteração de acesso Firebase.

## Verificação desta alteração

Validados 19 caminhos de ignore, incluindo ambientes, JSON administrativo, bancos/sidecars e preservação dos exemplos, código, esquemas e regras. Nenhum arquivo rastreado permaneceu coberto por ignore após a retirada da configuração local do índice.

Scanner executado em 92 arquivos de texto candidatos, sem ocorrências. Exercitado também em repositório temporário ignorado, com fixtures inteiramente fictícias: exemplo vazio aceito; marcador de chave privada e JSON de serviço bloqueados; versão sensível no staging continuou bloqueada mesmo após limpar o arquivo na pasta; arquivo `custom.env` bloqueado pelo nome. Nenhum segredo real foi utilizado nos testes. No staging principal havia somente a remoção da configuração local, sem arquivos de texto preparados para commit; a checagem do staging deve ser repetida após `git add`.


## Atualização de 22/10/2026 — painel administrativo

O usuário moveu sua conta de serviço para a raiz do workspace. Confirmados `git check-ignore` e ausência em `git ls-files`: o arquivo continua ignorado e não rastreado. A afirmação anterior de localização externa descreve a etapa anterior. O painel usa apenas SDK cliente e regras; a chave não é importada por nenhum arquivo do app. Backups da preparação administrativa ficam em `.tools`, também ignorado. A alteração pendente do `.gitignore` da raiz integra esta entrega e deve entrar no próximo commit a partir da raiz, junto com os demais arquivos; `git add .` apenas dentro de BotecoRate não inclui seu diretório pai.
