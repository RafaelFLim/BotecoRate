// Read-only check. Reports file/line/category, never the credential value.
// --staged inspects the actual Git index, not the current working-tree version.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const git=(args,options={})=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024,...options});
const root=git(['rev-parse','--show-toplevel']).trim();
const staged=process.argv.includes('--staged');
const names=git(staged?['diff','--cached','--name-only','--diff-filter=ACMR','-z']:['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root}).split('\0').filter(Boolean);
const patterns=[
  ['chave privada',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['conta de serviço administrativa',/"type"\s*:\s*"service_account"/g],
  ['token GitHub',/\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['token OAuth Google',/\bya29\.[A-Za-z0-9_-]{25,}/g],
  ['credencial AWS',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['token Slack',/\bxox[baprs]-[A-Za-z0-9-]{25,}/g],
  ['chave OpenAI',/\bsk-(?:proj-|svcacct-)[A-Za-z0-9_-]{30,}/g],
];
let checked=0;
const findings=[];
for(const name of new Set(names)) {
  const base=path.posix.basename(name);
  if ((/^\.env(?:\.|$)/.test(base) && !/\.example$/.test(base)) || /\.env$/.test(base) || base==='.envrc' || /^(?:id_rsa|id_ed25519|id_ecdsa|id_dsa)$/.test(base) || /(?:^|\/)(?:credentials|credenciais|\.credentials|secrets|\.secrets|\.ssh)\//.test(name) || /(?:firebase-adminsdk|firebase-admin|service[-_]?account|conta[-_]servico|application_default_credentials|-credentials)/i.test(base) && base.endsWith('.json') || /\.(?:db|sqlite|sqlite3)(?:-|$)/i.test(base) || /\.(?:pem|key|p8|p12|pfx|jks|keystore|mobileprovision)$/.test(base)) {
    findings.push({arquivo:name,categoria:'arquivo local/privado não deve ser versionado'});
  }
  let buffer;
  if(staged)buffer=execFileSync('git',['show',':'+name],{cwd:root,maxBuffer:32*1024*1024});
  else {
    const file=path.join(root,name);
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
    buffer=fs.readFileSync(file);
  }
  if(buffer.includes(0))continue;
  const source=buffer.toString('utf8');checked++;
  for(const [category,regex] of patterns) {
    regex.lastIndex=0;
    for(const match of source.matchAll(regex)) findings.push({arquivo:name,linha:source.slice(0,match.index).split('\n').length,categoria:category});
  }
  if(/(?:^|\/)\.env.*\.example$/.test(name)) {
    for(const [index,line] of source.split(/\r?\n/).entries()) {
      if(!/^[A-Z0-9_]*(?:PRIVATE_KEY|PASSWORD|SECRET|TOKEN|API_KEY)=.+/.test(line))continue;
      findings.push({arquivo:name,linha:index+1,categoria:'exemplo de configuração deve manter a credencial vazia'});
    }
  }
}
if(findings.length) {
  console.error('Revisar antes de commitar (nenhum valor sensível foi exibido):');
  for(const hit of findings)console.error(JSON.stringify(hit));
  process.exitCode=1;
} else console.log(`Verificação aprovada: ${checked} arquivos de texto ${staged?'no staging':'rastreáveis'}, sem padrões de credenciais privadas detectados.`);
