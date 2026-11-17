// Diagnóstico somente de leitura. Nunca imprime valores de configuração.
const fs = require('node:fs');
const path = require('node:path');
const {parseEnv} = require('node:util');
const file = path.resolve(__dirname,'../.env.local');
const config = fs.existsSync(file) ? parseEnv(fs.readFileSync(file,'utf8')) : {};
const fields = ['API_KEY','AUTH_DOMAIN','PROJECT_ID','DATABASE_URL','APP_ID'];
const missing = fields.filter(field=>!config['EXPO_PUBLIC_FIREBASE_'+field]);
console.log(JSON.stringify({file:'.env.local',exists:fs.existsSync(file),configured:!missing.length,missing},null,2));
if (missing.length) process.exitCode = 1;
else if (process.argv.includes('--online')) {
  const requests = [
    ['authentication','https://identitytoolkit.googleapis.com/v1/projects?key='+encodeURIComponent(config.EXPO_PUBLIC_FIREBASE_API_KEY)],
    ['catalog',config.EXPO_PUBLIC_FIREBASE_DATABASE_URL.replace(/\/$/,'')+'/v1/direct/public_bars.json'],
  ];
  Promise.all(requests.map(async([service,url])=>{
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(15000)});
      console.log(JSON.stringify({service,status:response.status,ok:response.ok}));
      if (!response.ok) process.exitCode=1;
    } catch {
      console.log(JSON.stringify({service,ok:false,message:'Falha de rede; nenhum cadastro foi realizado.'}));
      process.exitCode=1;
    }
  })).catch(()=>{process.exitCode=1;});
}
