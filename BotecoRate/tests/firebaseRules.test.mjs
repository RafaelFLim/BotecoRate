import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update } from 'firebase/database';

const enabled = Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST);
let env;
before(async () => {
  if (!enabled) return;
  env = await initializeTestEnvironment({ projectId: 'demo-botecorate', database: {
    rules: readFileSync(new URL('../firebase/database.rules.json', import.meta.url), 'utf8'),
  } });
  await env.withSecurityRulesDisabled(async ctx => {
    await set(ref(ctx.database(), 'v1'), {
      catalog: { version: 1, bares: [{ id: 'b', nome: 'Bar', endereco: 'Rua A' }] },
      access_control: { banned: { role: 'admin', status: 'banido' } },
      private_profiles: { other: { documento: 'privado' } },
    });
  });
});
after(async () => { if (env) await env.cleanup(); });
const options = { skip: !enabled };
test('visitante só lê catálogo público e não escreve', options, async () => {
  const db=env.unauthenticatedContext().database();
  await assertSucceeds(get(ref(db,'v1/catalog')));
  await assertFails(get(ref(db,'v1')));
  await assertFails(get(ref(db,'v1/private_profiles/other')));
  await assertFails(set(ref(db,'v1/catalog/version'),2));
});
test('usuário não promove a si nem lê autoridade de terceiros', options, async () => {
  const db=env.authenticatedContext('alice',{email_verified:true}).database();
  await assertSucceeds(get(ref(db,'v1/access_control/alice')));
  await assertFails(get(ref(db,'v1/access_control/banned')));
  await assertFails(set(ref(db,'v1/access_control/alice'),{role:'admin',status:'ativo'}));
  await assertFails(set(ref(db,'v1/bars/b'),{nome:'forjado'}));
  await assertFails(get(ref(db,'v1/sync')));
  await assertFails(set(ref(db,'v1/sync/entities/bares/b'),{nome:'forjado'}));
  await assertFails(get(ref(db,'v1/media')));
  await assertFails(set(ref(db,'v1/media/foto'),{uid:'alice'}));
});
test('perfil exige e-mail verificado e não permite escrever como outro usuário', options, async () => {
  const profile={name:'Nome',version:1,updated_at:'2026-10-22',history:{1:{name:'Anterior',date:'2026-10-22'}}};
  const unverified=env.authenticatedContext('unverified',{email_verified:false}).database();
  await assertFails(set(ref(unverified,'v1/public_profiles/unverified'),profile));
  const db=env.authenticatedContext('alice',{email_verified:true}).database();
  await assertFails(set(ref(db,'v1/public_profiles/other'),profile));
});
test('nome próprio mantém histórico imutável e proíbe apagar versões antigas', options, async () => {
  const db=env.authenticatedContext('alice',{email_verified:true}).database();
  const first={name:'Alice',version:1,updated_at:'2026-10-22'};
  await assertFails(set(ref(db,'v1/public_profiles/alice'),first));
  await assertSucceeds(update(ref(db,'v1'),{
    'public_profiles/alice':first,'profile_history/alice/1':{name:'Inicial',date:'2026-10-22'}
  }));
  await assertSucceeds(update(ref(db,'v1'),{
    'public_profiles/alice':{name:'Alice nova',version:2,updated_at:'2026-10-22'},
    'profile_history/alice/2':{name:'Alice',date:'2026-10-22'}
  }));
  await assertFails(set(ref(db,'v1/profile_history/alice/1'),null));
  await assertFails(set(ref(db,'v1/profile_history/alice/1'),{name:'Forjado',date:'2026-10-22'}));
  await assertFails(update(ref(db,'v1'),{
    'public_profiles/alice':{name:'Fora de ordem',version:2,updated_at:'2026-10-22'},
    'profile_history/alice/3':{name:'Alice nova',date:'2026-10-22'}
  }));
});
test('admin banido também não altera o próprio perfil', options, async () => {
  const db=env.authenticatedContext('banned',{email_verified:true}).database();
  await assertFails(set(ref(db,'v1/public_profiles/banned'),{name:'Banido',version:1,updated_at:'2026-10-22',history:{1:{name:'Anterior',date:'2026-10-22'}}}));
});
