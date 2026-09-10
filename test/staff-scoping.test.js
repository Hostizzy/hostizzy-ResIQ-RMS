// Hostizzy staff used to be unscoped — `_ownerPropertyIds = null` meant every
// query ran without a property filter, so a self-signup host's bookings, guests
// and payments appeared in Hostizzy's own operational views.
//
// A host runs their own business through ResIQ. Their guests never agreed to
// appear in Hostizzy's book. Ordinary staff now see Hostizzy's own properties —
// unowned, or belonging to a managed owner — and a super admin still sees
// everything, for support.
//
// Super admin is team_members.is_super_admin, deliberately NOT role = 'admin'.
// role says what someone may DO inside Hostizzy's book; the flag says whether
// they may see other people's businesses. Promoting a colleague to admin must
// not silently hand them every host's guests and payments.

const OWNERS = [
  { id: 'managed-1', name: 'Managed Owner', account_type: 'managed', is_external: false },
  { id: 'host-1',    name: 'Self-signup Host', account_type: 'host', is_external: true },
  { id: 'host-2',    name: 'Another Host',     account_type: 'host', is_external: true },
];

const PROPERTIES = [
  { id: 1, name: 'Hostizzy Villa',   owner_id: null },        // Hostizzy's own stock
  { id: 2, name: 'The Orchard Farm', owner_id: 'managed-1' },
  { id: 3, name: 'Host Cottage',     owner_id: 'host-1' },    // ← staff must not see
  { id: 4, name: 'Host Homestay',    owner_id: 'host-2' },    // ← staff must not see
];

const RESERVATIONS = [
  { id: 1, property_id: 1, booking_id: 'HZ-1', status: 'confirmed' },
  { id: 2, property_id: 2, booking_id: 'HZ-2', status: 'checked-in' },
  { id: 3, property_id: 3, booking_id: 'HOST-1', status: 'confirmed' },
  { id: 4, property_id: 4, booking_id: 'HOST-2', status: 'checked-out' },
];

const TABLES = { property_owners: OWNERS, properties: PROPERTIES, reservations: RESERVATIONS };

function fakeSupabase() {
  const makeChain = (table) => {
    const q = { _eq: [], _in: [] };
    const rows = () => {
      let out = TABLES[table] || [];
      for (const [c, v] of q._eq) out = out.filter(r => String(r[c]) === String(v));
      for (const [c, vals] of q._in) out = out.filter(r => vals.map(String).includes(String(r[c])));
      return out;
    };
    const chain = {
      select: () => chain, order: () => chain, update: () => chain,
      gte: () => chain, lte: () => chain, not: () => chain,
      eq: (c, v) => { q._eq.push([c, v]); return chain; },
      in: (c, v) => { q._in.push([c, v]); return chain; },
      then: (res) => res({ data: rows(), error: null }),
    };
    return chain;
  };
  return { from: (t) => makeChain(t) };
}

import { readFileSync } from 'fs';
const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
const win = {};
const db = new Function('supabase', 'window', `${src}; return db;`)(fakeSupabase(), win);
// js/db.js hangs accountTypeOf off window; the scope helpers call it bare.
globalThis.accountTypeOf = win.accountTypeOf;
globalThis.isHostAccount = win.isHostAccount;

const ok = (l, c) => console.log(`${c ? '✓' : '✗ FAIL'}  ${l}`);
let fails = 0;
const t = (l, c) => { if (!c) fails++; ok(l, c); };

// ── Ordinary staff ──
// role 'admin' with the flag false: being a Hostizzy admin must NOT by itself
// grant sight of other people's businesses. That was the whole point of
// splitting the two.
await db.initScope({ userType: 'staff', role: 'admin', is_super_admin: false, email: 's@hostizzy.com' });

t('ordinary staff are no longer unscoped', db._ownerPropertyIds !== null);
t('ordinary staff are not super admin', db._isSuperAdmin === false);
t('staff scope includes Hostizzy\'s own unowned property', db._ownerPropertyIds.includes(1));
t('staff scope includes a managed owner\'s property', db._ownerPropertyIds.includes(2));
t('staff scope excludes both hosts\' properties',
  !db._ownerPropertyIds.includes(3) && !db._ownerPropertyIds.includes(4));

let res = await db.getReservations();
t('staff see Hostizzy bookings', res.some(r => r.booking_id === 'HZ-1'));
t('staff do NOT see host bookings',
  !res.some(r => r.booking_id === 'HOST-1' || r.booking_id === 'HOST-2'));

let props = await db.getProperties();
t('staff property list excludes host properties',
  props.length === 2 && !props.some(p => p.owner_id && String(p.owner_id).startsWith('host')));

let owners = await db.getOwners();
t('staff owner directory excludes hosts',
  owners.length === 1 && owners[0].id === 'managed-1');

t('a Hostizzy admin without the flag is not a super admin', db._isSuperAdmin === false);

// ── Super admin ──
// role 'staff' with the flag true: the flag alone decides, not the role.
await db.initScope({ userType: 'staff', role: 'staff', is_super_admin: true, email: 'admin@hostsphereindia.com' });

t('super admin is flagged', db._isSuperAdmin === true);
t('super admin stays unscoped', db._ownerPropertyIds === null);

res = await db.getReservations();
t('super admin sees host bookings', res.some(r => r.booking_id === 'HOST-1'));
t('super admin sees everything', res.length === RESERVATIONS.length);

owners = await db.getOwners();
t('super admin sees hosts in the directory', owners.length === OWNERS.length);

props = await db.getProperties();
t('super admin sees every property', props.length === PROPERTIES.length);

// ── The flag must not survive a logout ──
db.clearScope();
t('logout clears the super admin flag', db._isSuperAdmin === false);
t('logout denies by default', db._isDenied() === true);

// A staff session started right after an admin one must not inherit the flag.
await db.initScope({ userType: 'staff', role: 'staff', is_super_admin: false, email: 's2@hostizzy.com' });
t('a later staff session is not super admin', db._isSuperAdmin === false);
t('a later staff session is scoped', !((await db.getReservations()).some(r => r.booking_id === 'HOST-1')));

// ── The flag cannot be granted by whoever fancies it ──
// The web app reaches Postgres as the service role, so this check in db.js is
// the only thing standing between a staff member and self-promotion.
const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
await db.initScope({ userType: 'staff', role: 'admin', is_super_admin: false, email: 's3@hostizzy.com' });
t('ordinary staff cannot grant themselves super admin',
  await rejects(() => db.saveTeamMember({ id: 1, is_super_admin: true })));

await db.initScope({ userType: 'staff', role: 'staff', is_super_admin: true, email: 'admin@hostsphereindia.com' });
t('a super admin can grant it',
  !(await rejects(() => db.saveTeamMember({ id: 1, is_super_admin: true }))));

// ── Before the migration lands ──
// No is_super_admin field at all: fall back to role so a deploy that lands
// before the SQL does not lock the Hosts view out of the product.
await db.initScope({ userType: 'staff', role: 'admin', email: 'legacy@hostizzy.com' });
t('pre-migration, role admin still works as the fallback', db._isSuperAdmin === true);
await db.initScope({ userType: 'staff', role: 'manager', email: 'legacy2@hostizzy.com' });
t('pre-migration, a non-admin is still scoped', db._isSuperAdmin === false);

// ── An owner is unaffected by any of this ──
await db.initScope({ userType: 'owner', id: 'host-1' });
t('a host still sees only their own property', db._ownerPropertyIds.join() === '3');
t('a host is never super admin', db._isSuperAdmin === false);

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nAll staff scoping checks passed');
