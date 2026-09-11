// An owner's properties come from properties.owner_id. There used to be a
// second record — property_owners.property_ids — that only the owner portal
// maintained, and the two had drifted: Team → Add Owner wrote the array and
// never the column, so an owner showed properties in the staff table and saw
// nothing in the portal or the app.
//
// The other half of that bug was the status filter. Owner earnings were
// selected with ['confirmed', 'checked_in', 'completed'] — an underscore and a
// word the app never writes. Real values are 'checked-in' and 'checked-out',
// so the filter matched only bookings that had not started yet and pending
// payout read zero for everyone.

const PROPERTIES = [
  { id: 10, name: 'The Bageecha',  owner_id: 'owner-a' },
  { id: 11, name: 'Banyan Retreat', owner_id: 'owner-a' },
  { id: 99, name: 'Someone Else',   owner_id: 'owner-b' },   // ← must never leak
  { id: 12, name: 'Unassigned',     owner_id: null },
];

const RESERVATIONS = [
  { id: 1, property_id: 10, booking_id: 'BK-1', status: 'confirmed',   payment_status: 'paid', total_amount: 10000, hostizzy_revenue: 1500, host_payout: 8500 },
  { id: 2, property_id: 10, booking_id: 'BK-2', status: 'checked-in',  payment_status: 'paid', total_amount: 12000, hostizzy_revenue: 1800, host_payout: 10200 },
  { id: 3, property_id: 11, booking_id: 'BK-3', status: 'checked-out', payment_status: 'paid', total_amount:  8000, hostizzy_revenue: 1200, host_payout: 6800 },
  { id: 4, property_id: 10, booking_id: 'BK-4', status: 'cancelled',   payment_status: 'paid', total_amount:  5000, hostizzy_revenue:  750, host_payout: 4250 },
  { id: 5, property_id: 99, booking_id: 'BK-X', status: 'checked-out', payment_status: 'paid', total_amount: 99000, hostizzy_revenue: 9900, host_payout: 89100 },
];

const PAYOUTS = [
  { owner_id: 'owner-a', amount: 5000, status: 'completed' },   // 'completed' IS valid here
  { owner_id: 'owner-a', amount: 3000, status: 'pending' },
];

const TABLES = { properties: PROPERTIES, reservations: RESERVATIONS, payout_requests: PAYOUTS };

function fakeSupabase(log) {
  const makeChain = (table) => {
    const q = { _eq: [], _in: [], _not: null, _update: null };
    const rows = () => {
      let out = TABLES[table] || [];
      for (const [c, v] of q._eq) out = out.filter(r => String(r[c]) === String(v));
      for (const [c, vals] of q._in) out = out.filter(r => vals.map(String).includes(String(r[c])));
      return out;
    };
    const chain = {
      select: () => chain,
      order: () => chain,
      update: (row) => { q._update = row; return chain; },
      gte: () => chain,
      lte: () => chain,
      eq: (c, v) => { q._eq.push([c, v]); return chain; },
      in: (c, v) => {
        // The reservations table has no owner_id worth reading — it exists but
        // was never written — so asking for it is the bug, not a valid query.
        if (table === 'reservations' && c === 'owner_id') {
          throw new Error('reservations.owner_id is never populated');
        }
        q._in.push([c, v]);
        return chain;
      },
      not: (c, op, v) => { q._not = [c, op, v]; return chain; },
      then: (res) => { log.push({ table, eq: q._eq, in: q._in, not: q._not, update: q._update }); return res({ data: rows(), error: null }); },
    };
    return chain;
  };
  return { from: (t) => makeChain(t) };
}

import { readFileSync } from 'fs';
const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
const log = [];
const db = new Function('supabase', 'window', `${src}; return db;`)(fakeSupabase(log), {});

const ok = (l, c) => console.log(`${c ? '✓' : '✗ FAIL'}  ${l}`);
let fails = 0;
const t = (l, c) => { if (!c) fails++; ok(l, c); };

// ── The link itself ──
let ids = await db.getOwnerPropertyIds('owner-a');
t('an owner resolves to their own properties', ids.length === 2 && ids.includes(10) && ids.includes(11));
t('another owner\'s property is not included', !ids.includes(99));
t('an unassigned property belongs to nobody', !ids.includes(12));
t('the link is read from properties.owner_id',
  log.some(e => e.table === 'properties' && e.eq.some(([c]) => c === 'owner_id')));

t('an owner with no properties resolves to empty',
  (await db.getOwnerPropertyIds('owner-nobody')).length === 0);

// ── Earnings ──
const rev = await db.getOwnerRevenue('owner-a');
t('earnings include a checked-in booking',
  rev.bookings.some(b => b.status === 'checked-in'));
t('earnings include a checked-out booking',
  rev.bookings.some(b => b.status === 'checked-out'));
t('earnings exclude cancelled', !rev.bookings.some(b => b.status === 'cancelled'));
t('earnings exclude another owner\'s booking',
  !rev.bookings.some(b => b.booking_id === 'BK-X'));
t('revenue totals only this owner\'s bookings', rev.totalRevenue === 30000);
t('commission totals only this owner\'s bookings', rev.hostizzyCommission === 4500);

// The old filter would have returned only BK-1. This is the regression guard.
t('earnings are more than just the not-yet-started booking', rev.totalBookings === 3);

// ── Pending payout ──
// 8500 + 10200 + 6800 = 25500 earned, less 5000 already paid out.
// A 'pending' payout request must not count as paid.
const pending = await db.getOwnerPendingPayout('owner-a');
t('pending payout nets completed payouts off earnings', pending === 20500);
t('pending payout is not zero for an owner with completed stays', pending > 0);

// ── Bookings list ──
const bookings = await db.getOwnerBookings('owner-a');
t('bookings list is scoped to the owner', bookings.length === 4 && !bookings.some(b => b.booking_id === 'BK-X'));

// ── An owner with nothing ──
const empty = await db.getOwnerRevenue('owner-nobody');
t('an owner with no properties earns zero, not everything', empty.totalRevenue === 0 && empty.totalBookings === 0);
t('an owner with no properties has no pending payout',
  (await db.getOwnerPendingPayout('owner-nobody')) === 0);
t('an owner with no properties has no bookings',
  (await db.getOwnerBookings('owner-nobody')).length === 0);

// ── Assignment ──
log.length = 0;
await db.setOwnerProperties('owner-a', [10, 12]);
const writes = log.filter(e => e.table === 'properties');
t('assignment claims the selected properties first',
  writes[0]?.in?.some(([c, v]) => c === 'id' && v.includes(10) && v.includes(12)));
t('assignment then releases what is no longer selected',
  writes[1]?.eq?.some(([c, v]) => c === 'owner_id' && v === 'owner-a') && writes[1]?.not);
t('the release excludes the properties just claimed',
  String(writes[1]?.not?.[2] || '').includes('10') && String(writes[1]?.not?.[2] || '').includes('12'));

// Assigning nothing must still release everything, or a cleared owner keeps
// properties they were meant to lose.
log.length = 0;
await db.setOwnerProperties('owner-a', []);
const clearWrites = log.filter(e => e.table === 'properties');
t('assigning no properties releases them all',
  clearWrites.length === 1 && clearWrites[0].not === null);

// ── The portal must not read the deprecated mirror ──
// property_owners.property_ids is a denormalised copy of properties.owner_id.
// It drifts: verify.sql found three real owners whose mirror was empty while
// owner_id linked a property. Five owner-portal views gated on the mirror, so
// those owners logged in and were told "No properties linked to your account"
// while owning property. One of them read it off the CACHED login object, so
// it was stale even when the column was right.
import { readFileSync as read } from 'fs';
const portal = read(new URL('../owner-portal-functions.js', import.meta.url), 'utf8');

// Strip comments first — the fix is explained in prose that names the column.
const code = portal
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const mirrorReads = (code.match(/\.property_ids/g) || []).length;
t('the owner portal never reads the property_ids mirror', mirrorReads === 0);
t('the owner portal resolves properties from the source of truth',
  code.includes('getOwnerPropertyIds'));

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nAll owner scoping checks passed');
