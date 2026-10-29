import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { get, ref, set, update } from 'firebase/database';
import { validatedUsername, usernameKey } from '../src/utils/username.js';

test('nomes exigem três letras e normalizam equivalências sem aceitar emojis ou símbolos', () => {
  for (const value of ['A', 'AB12', '12345', '...', '__', 'Ana😀', 'A1️⃣bc', 'Ana\nMaria', '★Ana']) assert.throws(() => validatedUsername(value));
  assert.equal(validatedUsername('  João   Silva  '), 'João Silva');
  assert.equal(validatedUsername('Ana123'), 'Ana123');
  assert.equal(usernameKey("JÓÃO.Silva-_ '"), usernameKey('joao silva'));
  assert.equal(usernameKey('Jose\u0301'), usernameKey('José'));
  assert.throws(() => validatedUsername('joao.silva', 'João Silva'), /diferente/);
});

let env;
const options = { skip: !process.env.FIREBASE_DATABASE_EMULATOR_HOST };
before(async () => {
  if (!options.skip) env = await initializeTestEnvironment({ projectId: 'demo-profile-names', database: { rules: readFileSync(new URL('../firebase/database.rules.json', import.meta.url), 'utf8') } });
});
after(async () => { if (env) await env.cleanup(); });
const now = '2026-10-29T13:00:00.000Z';
const directory = (uid, name, verified = true) => ({ uid, name, email: `${uid}@example.test`, email_verified: verified, updated_at: now });
const account = (uid, verified = true) => env.authenticatedContext(uid, { email_verified: verified, email: `${uid}@example.test` }).database();
async function reset() {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(ctx => set(ref(ctx.database(), 'v1'), {
    user_directory: { alice: directory('alice', 'Alfa'), bob: directory('bob', 'Beta') },
    username_index: { alfa: 'alice', beta: 'bob' },
    access_control: { admin: {role:'admin',status:'ativo'}, banned: {role:'admin',status:'banido'} },
  }));
}
function change(uid, name, oldName = uid === 'alice' ? 'Alfa' : 'Beta', version = 1) {
  const changes = {
    [`public_profiles/${uid}`]: { name, version, updated_at: now },
    [`profile_history/${uid}/${version}`]: { name: oldName, date: now },
    [`user_directory/${uid}`]: directory(uid, name),
    [`username_index/${usernameKey(name)||'invalid'}`]: uid,
  };
  if (usernameKey(oldName) !== usernameKey(name)) changes[`username_index/${usernameKey(oldName)}`] = null;
  return changes;
}

test('nomes: troca atômica conserva auditoria, reserva nome único e libera anterior', options, async () => {
  await reset(); const db = account('alice');
  await assertSucceeds(update(ref(db, 'v1'), change('alice', 'João Silva')));
  assert.equal((await get(ref(db, 'v1/username_index/joaosilva'))).val(), 'alice');
  assert.equal((await get(ref(db, 'v1/username_index/alfa'))).exists(), false);
  assert.equal((await get(ref(db, 'v1/profile_history/alice/1/name'))).val(), 'Alfa');
  await assertFails(set(ref(db, 'v1/profile_history/alice/1/name'), 'Forjado'));
  await assertFails(set(ref(db, 'v1/username_index/joaosilva'), null));
});

test('nomes: colisão entre contas e variações de maiúsculas/acentos/pontuação são recusadas', options, async () => {
  await reset();
  const results = await Promise.allSettled([
    update(ref(account('alice'), 'v1'), change('alice', 'João Silva')),
    update(ref(account('bob'), 'v1'), change('bob', 'joao.silva')),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
});

test('nomes: validação remota impede atalhos no diretório, chave falsa e nome atual/inválido', options, async () => {
  await reset(); const db = account('alice');
  for (const invalid of ['Alfa', '12345', 'A.12', 'Ana😀', '...']) await assertFails(update(ref(db, 'v1'), change('alice', invalid)));
  const forged = change('alice', 'Outro Nome'); delete forged['username_index/outronome']; forged['username_index/falso'] = 'alice';
  await assertFails(update(ref(db, 'v1'), forged));
  await assertFails(update(ref(db, 'v1'), { 'user_directory/alice': directory('alice', 'Outro Nome'), 'username_index/outronome': 'alice' }));
  await assertFails(set(ref(db, 'v1/ownership_accounts/alice/name'), 'Outro Nome'));
  await assertFails(update(ref(account('alice', false), 'v1'), change('alice', 'Outro Nome')));
});

test('nomes: cadastro não verificado reserva somente o próprio nome; disponibilidade não lista contas', options, async () => {
  await reset(); const db = account('new', false);
  await assertSucceeds(update(ref(db, 'v1'), { 'user_directory/new': directory('new', 'Novo Usuário', false), 'username_index/novousuario': 'new' }));
  await assertFails(update(ref(db, 'v1'), { 'user_directory/new': directory('new', 'Outro Nome', false), 'username_index/outronome': 'new' }));
  await assertFails(set(ref(db, 'v1/username_index/qualquer'), 'new'));
  const visitor = env.unauthenticatedContext().database();
  await assertSucceeds(get(ref(visitor, 'v1/username_index/novousuario')));
  await assertFails(get(ref(visitor, 'v1/username_index')));
  await assertFails(get(ref(visitor, 'v1/user_directory')));
});

test('nomes: histórico global é administrativo; titular consulta sua trilha e terceiros não',options,async()=>{
  await reset();await assertSucceeds(update(ref(account('alice'),'v1'),change('alice','Novo Nome')));
  await assertSucceeds(get(ref(account('admin'),'v1/profile_history')));
  await assertSucceeds(get(ref(account('admin'),'v1/public_profiles')));
  await assertSucceeds(get(ref(account('alice'),'v1/profile_history/alice')));
  await assertFails(get(ref(account('bob'),'v1/profile_history/alice')));
  await assertFails(get(ref(account('banned'),'v1/profile_history')));
});
