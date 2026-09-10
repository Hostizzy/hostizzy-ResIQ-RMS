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

const TEAM = [
  { id: 1, email: 'admin@hostizzy.com', name: 'Super Admin', role: 'staff', is_super_admin: true,  is_active: true },
  { id: 2, email: 'ops@hostizzy.com',   name: 'Ops',         role: 'admin', is_super_admin: false, is_active: true },
];

const TABLES = {
  property_owners: OWNERS, properties: PROPERTIES,
  reservations: RESERVATIONS, team_members: TEAM,
};

function fakeSupabase() {
  const makeChain = (table) => {
    const q = { _eq: [], _in: [] };
    const rows = () => {
      let out = TABLES[table] || [];
      for (const [c, v] of q._eq) out = out.filter(r => String(r[c]) === String(v));
      for (const [c, vals] of q._in) out = out.filter(r => vals.map(String).includes(String(r[c])));
      return q._limit ? out.slice(0, q._limit) : out;
    };
    const chain = {
      select: () => chain, order: () => chain, update: () => chain,
      gte: () => chain, lte: () => chain, not: () => chain,
      limit: (n) => { q._limit = n; return chain; },
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
await db.initScope({ userType: 'staff', role: 'staff', is_super_admin: true, email: 'admin@hostizzy.com' });

t('super admin is flagged', db._isSuperAdmin === true);

// Deliberately NOT unscoped. Permission to see a host's book is not permission
// for it to arrive uninvited in Hostizzy's daily views.
t('super admin still starts scoped to Hostizzy', db._ownerPropertyIds !== null);
t('super admin starts on Hostizzy\'s book', db._viewScope.kind === 'hostizzy');

res = await db.getReservations();
t('super admin does not see host bookings until they switch',
  !res.some(r => r.booking_id.startsWith('HOST')));
t('super admin sees Hostizzy bookings', res.some(r => r.booking_id === 'HZ-1'));

// The directory is not property-scoped: approving and supporting hosts is the
// super admin's job, so they see all of them regardless of which book is open.
owners = await db.getOwners();
t('super admin sees hosts in the directory', owners.length === OWNERS.length);

props = await db.getProperties();
t('super admin property list follows the open book', props.length === 2);

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

await db.initScope({ userType: 'staff', role: 'staff', is_super_admin: true, email: 'admin@hostizzy.com' });
t('a super admin can grant it',
  !(await rejects(() => db.saveTeamMember({ id: 1, is_super_admin: true }))));

// ── Before the migration lands ──
// No is_super_admin field at all: fall back to role so a deploy that lands
// before the SQL does not lock the Hosts view out of the product.
await db.initScope({ userType: 'staff', role: 'admin', email: 'legacy@hostizzy.com' });
t('pre-migration, role admin still works as the fallback', db._isSuperAdmin === true);
await db.initScope({ userType: 'staff', role: 'manager', email: 'legacy2@hostizzy.com' });
t('pre-migration, a non-admin is still scoped', db._isSuperAdmin === false);

// ── Switching books ──
// Being ALLOWED to see a host's data is not the same as having it mixed in.
// A super admin starts on Hostizzy's book like everyone else and switches
// deliberately, one book at a time — never both at once, because a mixed list
// is how someone else's guest ends up in a Hostizzy report.
await db.initScope({ userType: 'staff', role: 'staff', is_super_admin: true, email: 'admin@hostizzy.com' });

t('a super admin starts on Hostizzy\'s book, not everything',
  db._viewScope.kind === 'hostizzy' && db._ownerPropertyIds !== null);
t('by default a super admin does not see host bookings',
  !(await db.getReservations()).some(r => r.booking_id.startsWith('HOST')));

await db.setViewScope({ kind: 'host', ownerId: 'host-1', label: 'Self-signup Host' });
t('switching to a host scopes to that host', db._ownerPropertyIds.join() === '3');
let scoped = await db.getReservations();
t('viewing a host shows their bookings', scoped.some(r => r.booking_id === 'HOST-1'));
t('viewing a host hides Hostizzy\'s own', !scoped.some(r => r.booking_id.startsWith('HZ')));
t('viewing one host hides the other host', !scoped.some(r => r.booking_id === 'HOST-2'));
t('the banner has a label to show', db._viewScope.label === 'Self-signup Host');

// A refresh mid-session must not snap the viewer back underneath them.
await db.refreshPropertyScope();
t('refreshing keeps the selected book', db._viewScope.kind === 'host' && db._ownerPropertyIds.join() === '3');

await db.setViewScope({ kind: 'hostizzy' });
t('switching back restores Hostizzy\'s book',
  db._viewScope.kind === 'hostizzy' && db._ownerPropertyIds.includes(1));
t('back on Hostizzy, host bookings are gone again',
  !(await db.getReservations()).some(r => r.booking_id.startsWith('HOST')));

t('a host scope without an ownerId is refused',
  await rejects(() => db.setViewScope({ kind: 'host' })));

// The Hosts directory needs every property to count them, and says so.
t('a super admin can read all properties for the Hosts view',
  (await db.getAllProperties()).length === PROPERTIES.length);

await db.initScope({ userType: 'staff', role: 'admin', is_super_admin: false, email: 's4@hostizzy.com' });
t('ordinary staff cannot switch books', await rejects(() => db.setViewScope({ kind: 'host', ownerId: 'host-1' })));
t('ordinary staff cannot read all properties', await rejects(() => db.getAllProperties()));

db.clearScope();
t('logout resets the book to Hostizzy', db._viewScope.kind === 'hostizzy');

// ── An owner is unaffected by any of this ──
await db.initScope({ userType: 'owner', id: 'host-1' });
t('a host still sees only their own property', db._ownerPropertyIds.join() === '3');
t('a host is never super admin', db._isSuperAdmin === false);

// ── A restored session must not scope from a stale cached profile ──
// js/app.js used to JSON.parse localStorage.currentUser and scope straight
// from it. That object is written once at login and never refreshed, so a
// session cached before is_super_admin existed carries no such key — and the
// pre-migration fallback below then reads role === 'admin' and hands an
// ordinary Hostizzy admin every host's guests and payments. The flag was
// applied in production while those sessions were still open, so this was
// live, not theoretical.
const cached = { userType: 'staff', role: 'admin', email: 'ops@hostizzy.com' }; // no flag
await db.initScope(cached);
t('a stale cached profile would wrongly read as super admin', db._isSuperAdmin === true);

// Re-reading the record before scoping is what closes it.
const fresh = await db.findUserByEmail('ops@hostizzy.com');
t('the refreshed record carries the flag', fresh && fresh.is_super_admin === false);
await db.initScope({ ...fresh, userType: 'staff' });
t('scoping from the refreshed record denies super admin', db._isSuperAdmin === false);
t('scoping from the refreshed record hides host bookings',
  !(await db.getReservations()).some(r => r.booking_id.startsWith('HOST')));

// And the real super admin still resolves correctly through the same path.
const su = await db.findUserByEmail('admin@hostizzy.com');
await db.initScope({ ...su, userType: 'staff' });
t('the refreshed super admin record still grants the flag', db._isSuperAdmin === true);

// The guard above only works if app.js actually refreshes BEFORE it scopes.
// Assert the order, because getting it backwards restores the original bug
// while looking correct.
const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const restore = appSrc.slice(appSrc.indexOf("const storedUser = localStorage.getItem('currentUser')"));
// Match the calls, not the prose — this block is heavily commented and both
// names appear in the comments explaining why the order matters.
const refreshAt = restore.indexOf('await db.findUserByEmail(');
const scopeAt = restore.indexOf('await db.initScope(');
t('session restore refreshes the profile from the database',
  refreshAt !== -1);
t('session restore refreshes BEFORE it scopes',
  refreshAt !== -1 && scopeAt !== -1 && refreshAt < scopeAt);

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nAll staff scoping checks passed');
