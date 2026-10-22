# Backup da versão estável — 22/10/2026

Criado após o usuário confirmar funcionamento normal da atualização de dependências e antes de retirar os arquivos GSD ou modificar funcionalidades.

## Arquivo

Na raiz do workspace, fora do versionamento:

```text
.backups/BotecoRate-estavel-2026-10-22-ba74f093.tar.gz
.backups/BotecoRate-estavel-2026-10-22-ba74f093.tar.gz.sha256
```

SHA-256:

```text
5EA274D2545B5B30973EFEFF509B6EA671F5779FF231BEDD4806F886A325D175
```

Contém 1.455 entradas e 8.194.639 bytes compactados. Inclui código, assets, configurações locais ocultas, documentação com mudanças ainda não commitadas, package.json/package-lock.json, arquivos GSD anteriores à retirada e histórico `.git`.

Excluídos `node_modules`, cache `.expo` e a própria `.backups`. Pacotes são reinstaláveis por `npm ci`. Dados AsyncStorage, fotos e permissões dos celulares não estão neste backup de código; ele não é um backup dos dados do aparelho. O arquivo contém configurações locais e deve permanecer privado.

## Validação e restauração

- Arquivo listado com sucesso e entradas essenciais conferidas.
- Seis arquivos extraídos em `.backups/verificacao-ba74f093` e comparados por SHA-256: App.js, package.json, package-lock.json, decisões documentadas, manifesto GSD e `.git/HEAD`. Todos idênticos às origens no momento do backup.
- Para restaurar, conferir o checksum com `Get-FileHash -Algorithm SHA256` e extrair o arquivo **em uma pasta nova vazia**, preservando o workspace atual.
- Na pasta restaurada `BotecoRate`, executar `npm ci` e `npx expo start --clear`.
- A cópia inclui o GSD anterior; restaurar tudo também restaura esses arquivos. Selecionar apenas o código/configuração necessários caso não queira reativar o teste GSD.
- Este backup é local, não foi enviado para nuvem/GitHub; uma cópia externa pode ser feita pelo usuário.

## Retirada do GSD

A remoção permanente foi bloqueada pela revisão automática. Foi adotada alternativa reversível: mover os arquivos identificados para `.backups/gsd-retirado-ba74f093`, preservando os mesmos caminhos relativos. Foram retirados `.planning`, runtime `gsd-core`, agentes/comandos, scripts/hooks GSD, staging, manifestos e diário de migração da pasta ativa do app. As chamadas GSD e permissões exclusivas dele foram retiradas de `.claude/settings.local.json`.

Preservados `.claude/settings.json` com plugin Expo, `.claude/CLAUDE.md`, configurações da raiz e pastas `.kilo`. A nova pasta `.backups` está ignorada pelo Git. Nenhuma tela ou serviço do app foi alterado.
