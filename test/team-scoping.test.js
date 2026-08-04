// Hosts manage their own caretakers through the same Team view Hostizzy staff
// use. These assertions pin down that a scoped caller can never read, edit or
// delete a row belonging to anyone else — including the owner directory, which
// is a staff-only view.

const TEAM = [
  { id: 1, owner_id: 'host-a', name: 'Ravi (caretaker)' },
  { id: 2, owner_id: 'host-a', name: 'Meena (caretaker)' },
  { id: 3, owner_id: 'host-b', name: 'Someone Else' },      // ← must never leak
  { id: 4, owner_id: null,     name: 'Hostizzy Admin' },    // ← must never leak
];

const OWNERS = [
  { id: 'host-a', name: 'Host A', email: 'a@example.com' },
  { id: 'host-b', name: 'Host B', email: 'b@example.com' },
  { id: 'managed-1', name: 'Managed Owner', email: 'm@example.com' },
];

const TABLES = { team_members: TEAM, property_owners: OWNERS };

function fakeSupabase(log) {
  // Fresh chain per from() — otherwise filters leak between calls and the
  // test lies to us.
  const makeChain = (table) => {
    const rowsFor = () => TABLES[table] || [];
    const q = { _eq: [], _op: 'select' };
    const apply = () => {
      let rows = rowsFor();
      for (const [c, v] of q._eq) rows = rows.filter(r => String(r[c]) === String(v));
      return rows;
    };
    const chain = {
      select: () => chain,
      order: () => chain,
      insert: (rows) => { q._op = 'insert'; q._rows = rows; return chain; },
      update: (row) => { q._op = 'update'; q._rows = [row]; return chain; },
      delete: () => { q._op = 'delete'; return chain; },
      eq: (c, v) => { q._eq.push([c, v]); return chain; },
      in: () => chain,
      maybeSingle: async () => ({ data: apply()[0] || null, error: null }),
      then: (res) => {
        log.push({ table, op: q._op, eq: q._eq, rows: q._rows });
        return res({ data: q._op === 'select' ? apply() : (q._rows || []), error: null });
      },
    };
    return chain;
  };
  return { from: (table) => makeChain(table) };
}

import { readFileSync } from 'fs';
const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
const log = [];
const db = new Function('supabase', 'window', `${src}; return db;`)(fakeSupabase(log), {});

const ok = (l, c) => console.log(`${c ? '✓' : '✗ FAIL'}  ${l}`);
let fails = 0;
const t = (l, c) => { if (!c) fails++; ok(l, c); };
const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };

// ── Host A ──
db._ownerId = 'host-a'; db._ownerPropertyIds = [10, 11];

let members = await db.getTeamMembers();
t('host sees only their own team members',
  members.length === 2 && members.every(m => m.owner_id === 'host-a'));

t('host cannot delete another host\'s caretaker', await rejects(() => db.deleteTeamMember(3)));
t('host cannot delete a Hostizzy staff member', await rejects(() => db.deleteTeamMember(4)));
t('host can delete their own caretaker', !(await rejects(() => db.deleteTeamMember(1))));

t('host cannot edit another host\'s caretaker',
  await rejects(() => db.saveTeamMember({ id: 3, name: 'hijacked' })));

// A host must not be able to plant a member under someone else by passing an
// owner_id of their choosing — the scope overwrites whatever was supplied.
log.length = 0;
await db.saveTeamMember({ name: 'New Caretaker', owner_id: 'host-b' });
const inserted = log.find(e => e.op === 'insert')?.rows?.[0];
t('insert is stamped with the caller\'s own owner_id', inserted?.owner_id === 'host-a');

// The owner directory is a staff view.
let owners = await db.getOwners();
t('host sees only their own record in the owner directory',
  owners.length === 1 && owners[0].id === 'host-a');

// ── Hostizzy staff: unscoped by design ──
db._ownerId = null; db._ownerPropertyIds = null;
members = await db.getTeamMembers();
t('staff still see every team member', members.length === TEAM.length);
owners = await db.getOwners();
t('staff still see every owner', owners.length === OWNERS.length);
t('staff can delete any team member', !(await rejects(() => db.deleteTeamMember(3))));

log.length = 0;
await db.saveTeamMember({ name: 'Hostizzy Hire' });
t('staff insert is left unscoped',
  log.find(e => e.op === 'insert')?.rows?.[0]?.owner_id === undefined);

// ── Denied scope (pre-login) ──
db.clearScope();
t('denied scope reads nothing from team members', (await db.getTeamMembers()).length === 0);
t('denied scope reads nothing from the owner directory', (await db.getOwners()).length === 0);
t('denied scope cannot write a team member',
  await rejects(() => db.saveTeamMember({ name: 'Nope' })));

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nAll team scoping checks passed');
