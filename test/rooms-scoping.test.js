// Exercise the rooms scoping logic against a fake Supabase, asserting that a
// host can only ever reach their own properties' rooms.
const ROOMS = [
  { id: 1, property_id: 10, name: 'Garden Room' },   // host A
  { id: 2, property_id: 11, name: 'Attic Room'  },   // host A
  { id: 3, property_id: 99, name: 'Someone Else' },  // host B  ← must never leak
];

function fakeSupabase(captured) {
  // Fresh chain per from() — otherwise filters leak between calls and the
  // test lies to us.
  const makeChain = () => {
  const q = { _eq: null, _in: null };
  const chain = {
    select: () => chain, order: () => chain,
    eq: (c, v) => { q._eq = [c, v]; return chain; },
    in: (c, v) => { q._in = [c, v]; return chain; },
    maybeSingle: async () => ({ data: ROOMS.find(r => r.id === q._eq?.[1]) || null }),
    then: (res) => {
      let rows = ROOMS;
      if (q._eq) rows = rows.filter(r => String(r[q._eq[0]]) === String(q._eq[1]));
      if (q._in) rows = rows.filter(r => q._in[1].map(String).includes(String(r[q._in[0]])));
      captured.push({ eq: q._eq, in: q._in });
      return res({ data: rows, error: null });
    },
  };
  return chain;
  };
  return { from: () => makeChain() };
}

// Load the real db object from js/db.js
import { readFileSync } from 'fs';
const src = readFileSync(new URL('../js/db.js', import.meta.url), 'utf8');
const captured = [];
// Node 22 already provides crypto.getRandomValues.
const db = new Function('supabase', `${src}; return db;`)(fakeSupabase(captured));

const ok = (l, c) => console.log(`${c ? '✓' : '✗ FAIL'}  ${l}`);
let fails = 0;
const t = (l, c) => { if (!c) fails++; ok(l, c); };

// ── Host A: owns properties 10 and 11 ──
db._ownerId = 'host-a'; db._ownerPropertyIds = [10, 11];
let rows = await db.getRooms();
t('host sees only their own rooms when asking for all', rows.length === 2 && !rows.some(r => r.property_id === 99));
rows = await db.getRooms(10);
t('host can read a room on their own property', rows.length === 1 && rows[0].id === 1);
rows = await db.getRooms(99);
t('host gets nothing for someone else\'s property', rows.length === 0);

// ── Owner with no properties yet ──
db._ownerPropertyIds = [];
rows = await db.getRooms();
t('owner with no properties gets nothing, not everything', rows.length === 0);

// ── Hostizzy staff: unscoped by design ──
db._ownerId = null; db._ownerPropertyIds = null;
rows = await db.getRooms();
t('staff still see all rooms', rows.length === 3);

// ── Writes ──
db._ownerId = 'host-a'; db._ownerPropertyIds = [10, 11];
let threw = false;
try { await db.saveRoom({ property_id: 99, name: 'Sneaky' }); } catch { threw = true; }
t('cannot create a room on another owner\'s property', threw);

threw = false;
try { await db.deleteRoom(3); } catch { threw = true; }
t('cannot delete another owner\'s room', threw);

threw = false;
try { await db.saveRoom({ id: 3, property_id: 10, name: 'Hijack' }); } catch { threw = true; }
t('cannot hijack another owner\'s room by spoofing property_id', threw);

// ── Logged out ──
db._ownerId = '__deny__'; db._ownerPropertyIds = [];
rows = await db.getRooms();
t('denied scope returns nothing', rows.length === 0);

console.log(fails ? `\n${fails} FAILED` : '\nall scoping assertions passed');
process.exit(fails ? 1 : 0);
