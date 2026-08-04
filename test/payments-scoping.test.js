// payments has no property_id — a payment hangs off a reservation by
// booking_id. Scoping it the same way as reservations threw
// "column payments.property_id does not exist" for every host, while staff
// never saw it because they are unscoped. These assertions pin the two-hop
// scoping down, and pin down that the filter is on booking_id.

const RESERVATIONS = [
  { id: 1, property_id: 10, booking_id: 'BK-A' },   // host A
  { id: 2, property_id: 11, booking_id: 'BK-B' },   // host A
  { id: 3, property_id: 99, booking_id: 'BK-X' },   // host B  ← must never leak
];

const PAYMENTS = [
  { id: 1, booking_id: 'BK-A', amount: 5000 },
  { id: 2, booking_id: 'BK-A', amount: 2500 },
  { id: 3, booking_id: 'BK-B', amount: 9000 },
  { id: 4, booking_id: 'BK-X', amount: 7777 },      // ← must never leak
];

const TABLES = { reservations: RESERVATIONS, payments: PAYMENTS };

function fakeSupabase(log) {
  const makeChain = (table) => {
    const q = { _in: null };
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: () => chain,
      in: (col, vals) => {
        // The real column matters: asking payments for property_id is exactly
        // the bug, so the fake refuses it the way Postgres would.
        if (table === 'payments' && col !== 'booking_id') {
          throw Object.assign(new Error(`column payments.${col} does not exist`), { code: '42703' });
        }
        q._in = [col, vals];
        return chain;
      },
      then: (res) => {
        log.push({ table, in: q._in });
        let rows = TABLES[table] || [];
        if (q._in) rows = rows.filter(r => q._in[1].map(String).includes(String(r[q._in[0]])));
        return res({ data: rows, error: null });
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

// ── Host A: owns properties 10 and 11 ──
db._ownerId = 'host-a'; db._ownerPropertyIds = [10, 11];
log.length = 0;
let rows = await db.getAllPayments();
t('host sees only payments for their own bookings',
  rows.length === 3 && !rows.some(p => p.booking_id === 'BK-X'));
t('payments are filtered by booking_id, not property_id',
  log.some(e => e.table === 'payments' && e.in?.[0] === 'booking_id'));
t('reservations are consulted first to resolve the booking ids',
  log[0]?.table === 'reservations' && log[0]?.in?.[0] === 'property_id');

// ── A host whose properties have no bookings yet ──
db._ownerPropertyIds = [12];
rows = await db.getAllPayments();
t('host with no bookings gets nothing, not everything', rows.length === 0);

// ── A brand-new host with no properties at all ──
// This is the state right after signup, and the one that has to not explode.
db._ownerPropertyIds = [];
log.length = 0;
rows = await db.getAllPayments();
t('host with no properties gets nothing', rows.length === 0);
t('host with no properties issues no query at all', log.length === 0);

// ── Hostizzy staff: unscoped by design ──
db._ownerId = null; db._ownerPropertyIds = null;
rows = await db.getAllPayments();
t('staff still see every payment', rows.length === PAYMENTS.length);

// ── Denied scope (pre-login) ──
db.clearScope();
t('denied scope reads no payments', (await db.getAllPayments()).length === 0);

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nAll payment scoping checks passed');
