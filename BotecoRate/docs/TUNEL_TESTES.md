# Testes em outras redes pelo Expo Go

## Diagnóstico em 22/10/2026

O `npx expo start --tunnel` falhou com `Cannot read properties of undefined (reading 'body')`. O diagnóstico do agente Ngrok revelou `ERR_NGROK_108`: a conta compartilhada usada pelo Expo atingiu 5000 sessões simultâneas. O tratamento de erro de `@expo/ngrok` esconde a causa original. O Metro local funciona; este erro não indica falha no Firebase.

As versões do Expo e de `@expo/ngrok` foram conferidas. Não foi necessário atualizar dependências nem modificar `node_modules`. A equipe Expo descreve essa limitação e recomenda túneis alternativos na [issue 43335](https://github.com/expo/expo/issues/43335).

## Como executar no Windows x64

1. Encerre o Expo anterior com Ctrl+C.
2. No terminal dentro da pasta BotecoRate, execute:

   ```powershell
   npm run start:tunnel
   ```

3. Aguarde a inicialização do Metro. Compartilhe o QR ou o endereço `exps://...trycloudflare.com` mostrado como **EXPO GO — TESTE REMOTO**.
4. A outra pessoa deve usar Expo Go compatível com o SDK 57. Pode estar em outra rede. No Android, use o leitor do Expo Go; no iPhone, a câmera. Se necessário, cole o endereço no Expo Go.
5. Mantenha o terminal e o computador ligados durante o teste. Ctrl+C encerra o Expo e o túnel; a próxima execução gera outro endereço.

Para outra porta: `npm run start:tunnel -- --port 8082`. O comando recusa porta ocupada e não encerra servidores de outras sessões. Para apenas preparar/verificar a ferramenta: `npm run start:tunnel -- --check`.

## Funcionamento e limites

O launcher `scripts/start-tunnel.cjs` baixa o executável oficial portátil Cloudflared 2026.10.3 somente na primeira execução, para `.tools/`, ignorada pelo Git. Não instala serviço ou programa global. Verifica SHA256 antes de executar: `76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2`.

Inicia Quick Tunnel por HTTP/2 e informa seu endereço HTTPS ao processo Expo usando `EXPO_PACKAGER_PROXY_URL` antes do carregamento de dotenv. Não altera `.env.local`. Usa QR próprio `exps://` para preservar HTTPS no Expo Go. O Metro mantém observação de arquivos e Fast Refresh; atalhos interativos de teclado do CLI não são repassados por esse launcher. Para recarregar manualmente, use o menu de desenvolvimento no celular.

O endereço da sessão fica em `.expo/cloudflare-tunnel.json`, ignorado. O launcher encerra seus processos filhos quando recebe Ctrl+C ou um deles termina. Não altera telas, autenticação, banco, regras ou dados remotos.

Quick Tunnel não exige conta. Qualquer pessoa com o endereço temporário pode acessar o servidor de desenvolvimento; use para testes e encerre ao terminar. Não é hospedagem de produção e não tem garantia de disponibilidade. Consulte a [documentação oficial](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

O launcher instala automaticamente somente o binário Windows x64. Outros sistemas precisam de adaptação para a distribuição oficial correspondente.

## Verificação realizada

- Download oficial e integridade SHA256 aprovados.
- Túnel real criado sem conta Cloudflare ou Ngrok própria.
- Manifestos remotos Android e iOS: HTTP 200, com endereço público correto para o pacote.
- Pacote Android carregado pelo endereço público: HTTP 200, 6.399.585 bytes.
- Endpoint `/status` remoto respondeu `packager-status:running`.
- Encerramento e reinício do launcher verificados.

A abertura do QR no aparelho físico e os testes funcionais com outra pessoa ainda precisam de validação pelo usuário. O túnel usado na verificação foi encerrado; gere um novo pelo comando acima.
