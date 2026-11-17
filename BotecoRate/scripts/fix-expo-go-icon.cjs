// Expo Go Android SDK 58 reads iconUrl directly, while CLI 58.1.x can send it
// as a relative URL. Keep only this field absolute, using the client authority.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const expoDir = path.dirname(require.resolve('expo/package.json', { paths: [root] }));
const cliPackage = require.resolve('@expo/cli/package.json', { paths: [expoDir] });
const version = JSON.parse(fs.readFileSync(cliPackage, 'utf8')).version;
const supportedVersions = new Set(['58.1.15', '58.1.17']);
if (!supportedVersions.has(version)) {
  console.log(`Expo CLI ${version}: workaround do ícone não aplicado; conferir esta versão.`);
  process.exit(0);
}
const target = path.join(path.dirname(cliPackage), 'build/src/start/server/middleware/ManifestMiddleware.js');
const source = fs.readFileSync(target, 'utf8');
const marker = `// BotecoRate: absolute Expo Go icon URL (CLI ${version}).`;
if (source.includes(marker)) {
  console.log('Expo Go: correção da URL do ícone já aplicada.');
  process.exit(0);
}
const anchor = '        const bundleUrl = shouldUseRelativeManifestUrls ? this.toPathRelativeUrl(absoluteBundleUrl) : absoluteBundleUrl;';
if (source.split(anchor).length !== 2) throw new Error('ManifestMiddleware mudou; nenhuma correção de ícone aplicada.');
const patch = `        ${marker}
        if (shouldUseRelativeManifestUrls && projectConfig.exp.iconUrl) {
            const iconBaseUrl = new URL((protocol ?? "http") + "://" + hostUri + "/");
            projectConfig.exp.iconUrl = new URL(projectConfig.exp.iconUrl, iconBaseUrl).href;
        }
`;
const backup = path.join(root, '.tools', `expo-cli-${version}-manifest-original.js`);
fs.mkdirSync(path.dirname(backup), { recursive: true });
if (!fs.existsSync(backup)) fs.writeFileSync(backup, source, { flag: 'wx' });
fs.writeFileSync(target, source.replace(anchor, patch + anchor));
console.log('Expo Go: ícone passa a usar URL absoluta; manifesto e bundle mantêm URLs relativas.');
