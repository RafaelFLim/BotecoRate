// Temporary remote Expo Go access; no changes to the application or Firebase.
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = '2026.10.3';
const checksum = '76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2';
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('npm run start:tunnel -- [--port 8081] [--check]\n--check: somente prepara e verifica a ferramenta local.');
  process.exit(0);
}
const portIndex = args.indexOf('--port');
const port = portIndex < 0 ? 8081 : Number(args[portIndex + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535 ||
    args.some((arg, i) => arg !== '--check' && arg !== '--port' && !(portIndex >= 0 && i === portIndex + 1))) {
  console.error('Argumentos inválidos. Use npm run start:tunnel -- --help');
  process.exit(1);
}

let tunnel;
let metro;
let closing = false;
let startupTimer;
const stateFile = path.join(root, '.expo', 'cloudflare-tunnel.json');
function stop(code = 0) {
  if (closing) return;
  closing = true;
  clearTimeout(startupTimer);
  for (const child of [metro, tunnel]) if (child && child.exitCode === null) child.kill();
  fs.rm(stateFile, { force: true }).finally(() => { process.exitCode = code; });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

async function prepareTool() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Este comando foi preparado para Windows x64. Veja docs/TUNEL_TESTES.md.');
  }
  const directory = path.join(root, '.tools');
  const binary = path.join(directory, `cloudflared-${version}.exe`);
  await fs.mkdir(directory, { recursive: true });
  let data = await fs.readFile(binary).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (!data) {
    console.log(`Preparando Cloudflare Tunnel ${version} (download oficial, somente na primeira execução)...`);
    const response = await fetch(`https://github.com/cloudflare/cloudflared/releases/download/${version}/cloudflared-windows-amd64.exe`, {
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) throw new Error(`Download falhou: HTTP ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(data).digest('hex') !== checksum) throw new Error('Download com checksum inválido.');
    await fs.writeFile(binary, data, { flag: 'wx' });
  }
  if (createHash('sha256').update(data).digest('hex') !== checksum) {
    throw new Error('Ferramenta local com checksum inválido. Remova somente o executável em .tools e tente novamente.');
  }
  return binary;
}

async function main() {
  const binary = await prepareTool();
  if (closing) return;
  if (args.includes('--check')) {
    console.log(`Cloudflare ${version}: integridade verificada.`);
    return;
  }
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`A porta ${port} está ocupada. Feche o Expo anterior ou use --port 8082.`)));
    server.listen(port, '0.0.0.0', () => server.close(resolve));
  });
  if (closing) return;
  console.log('Criando endereço temporário para testes externos...');
  // HTTP/2 also works on networks that block outbound QUIC/UDP.
  tunnel = spawn(binary, ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate', '--protocol', 'http2'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  tunnel.on('error', error => { console.error(error.message); stop(1); });
  tunnel.on('exit', code => {
    if (!closing) { console.error(`O túnel foi encerrado (${code}). Execute o comando novamente.`); stop(1); }
  });
  startupTimer = setTimeout(() => { console.error('Tempo esgotado ao criar o túnel. Tente novamente.'); stop(1); }, 60000);
  let log = '';
  let started = false;
  async function inspect(chunk) {
    log = (log + chunk.toString()).slice(-16000);
    const match = log.match(/https:\/\/([a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com)\b/);
    if (started || closing || !match) return;
    started = true;
    clearTimeout(startupTimer);
    const publicUrl = match[0];
    const expoGoUrl = `exps://${match[1]}`;
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, JSON.stringify({ publicUrl, expoGoUrl, port }, null, 2));
    if (closing) return;
    const expoDir = path.dirname(require.resolve('expo/package.json'));
    // Set before Expo loads dotenv. Piped output suppresses its HTTP-only
    // exp:// QR while preserving Metro's file watcher and Fast Refresh.
    const env = { ...process.env, EXPO_PACKAGER_PROXY_URL: publicUrl };
    delete env.CI;
    metro = spawn(process.execPath, [path.join(expoDir, 'bin', 'cli'), 'start', '--lan', '--port', String(port), '--clear', '--go'], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env,
    });
    metro.stdout.on('data', chunk => process.stdout.write(chunk));
    metro.stderr.on('data', chunk => process.stderr.write(chunk));
    metro.on('error', error => { console.error(error.message); stop(1); });
    metro.on('exit', code => stop(code ?? 1));
    console.log(`\nEXPO GO — TESTE REMOTO\n${expoGoUrl}\nCompartilhe esse endereço ou o QR abaixo. Aguarde o Metro iniciar.\n`);
    try {
      const cliDir = path.dirname(require.resolve('@expo/cli/package.json', { paths: [expoDir] }));
      require(path.join(cliDir, 'build', 'src', 'utils', 'qr.js')).printQRCode(expoGoUrl).print();
    } catch {
      console.log('Cole o endereço acima no Expo Go para abrir o aplicativo.');
    }
    console.log('\nMantenha este terminal aberto. Ctrl+C encerra o Expo e o túnel.\n');
  }
  for (const stream of [tunnel.stdout, tunnel.stderr]) stream.on('data', chunk => {
    inspect(chunk).catch(error => { console.error(error.message); stop(1); });
  });
}
main().catch(error => { console.error(error.message); stop(1); });
