const { spawnSync } = require('node:child_process');
const path = require('node:path');
const python = path.resolve('server/.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const args = ['-m','unittest','discover','-s','server/tests'];
if (process.argv.includes('--emulator')) args.push('-p','test_emulator.py');
args.push('-v');
const result = spawnSync(python,args,{stdio:'inherit'});
if (result.error) console.error('Prepare server/.venv e instale server/requirements.txt.', result.error.message);
process.exit(result.status ?? 1);
