// Workaround for the inspector shipped with expo-sqlite 57.0.4.
// A fresh onLoadData function on each parent render was restarting its effect,
// which toggled parent loading again and caused hundreds of queries per second.
// No application/native/database code is modified.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const packageFile=require.resolve('expo-sqlite/package.json',{paths:[root]});
const version=JSON.parse(fs.readFileSync(packageFile,'utf8')).version;
if(version!=='57.0.4') {
  console.log(`Inspetor SQLite ${version}: workaround 57.0.4 não aplicado; conferir comportamento desta versão.`);
  process.exit(0);
}
function files(directory) {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    return entry.isDirectory()?files(file):file.endsWith('.js')?[file]:[];
  });
}
const prefix='DataBrowser=function({tableName:f,schema:x,onLoadData:w,onUpdate:j,onDelete:p,onInsert:v}){';
const marker=prefix+'const loadDataRef=(0,e.useRef)(w);loadDataRef.current=w;';
const candidates=files(path.join(path.dirname(packageFile),'dev-plugin-dist')).filter(file=>fs.readFileSync(file,'utf8').includes(prefix));
if(candidates.length!==1) throw new Error('Bundle do inspetor mudou; nenhuma alteração foi aplicada.');
const target=candidates[0];
let source=fs.readFileSync(target,'utf8');
if(source.includes(marker)) {
  console.log('Inspetor SQLite: correção do ciclo de consultas já aplicada.');
  process.exit(0);
}
const replacements=[
  [prefix+'const[N,y]',marker+'const[N,y]'],
  ['const t=await w(50,e);y(t),b(e)','const t=await loadDataRef.current(50,e);y(t),b(e)'],
  ['},[w]),H=(0,e.useMemo)','},[]),H=(0,e.useMemo)'],
];
for(const [before] of replacements) if(source.split(before).length!==2) throw new Error('Código do inspetor não corresponde à versão esperada; nenhuma alteração aplicada.');
const backup=path.join(root,'.tools','sqlite-inspector-57.0.4-original.js');
fs.mkdirSync(path.dirname(backup),{recursive:true});
if(!fs.existsSync(backup)) fs.writeFileSync(backup,source,{flag:'wx'});
for(const [before,after] of replacements) source=source.replace(before,after);
const temporary=target+'.tmp';
fs.writeFileSync(temporary,source);
fs.renameSync(temporary,target);
console.log('Inspetor SQLite: ciclo corrigido com referência estável ao carregador; original em .tools.');
