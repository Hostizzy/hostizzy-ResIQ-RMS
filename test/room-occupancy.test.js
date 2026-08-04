// computeDayOccupancy() decides what the calendar says is still sellable, and
// resiq_check_booking_conflict() decides what the database will actually accept.
// If they disagree, the calendar offers a date the save then rejects — so these
// assertions pin the parent/child rule down on the JavaScript side.
//
// The rule, from sql/rooms-and-conflict-guard.sql:
//   - a booking with room_id NULL is the WHOLE property and takes every room
//   - a booking on one room leaves the others sellable, but makes the whole
//     place unsellable
//   - a property with no rooms has a capacity of one

import { readFileSync } from 'fs';
const src = readFileSync(new URL('../js/utils.js', import.meta.url), 'utf8');

// utils.js applies the saved theme at load, so the sandbox needs just enough
// browser to get past that. The functions under test touch none of it.
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const noopEl = { classList: { add() {}, remove() {} }, setAttribute() {}, style: {}, textContent: '' };
const document = {
  documentElement: noopEl,
  body: noopEl,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  createElement: () => ({ ...noopEl, innerHTML: '', appendChild() {} }),
};
const window = { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} };

const { computeDayOccupancy, roomLabelFor, indexRoomsByProperty } =
  new Function('localStorage', 'document', 'window',
    `${src}; return { computeDayOccupancy, roomLabelFor, indexRoomsByProperty };`
  )(localStorage, document, window);

const ok = (l, c) => console.log(`${c ? '✓' : '✗ FAIL'}  ${l}`);
let fails = 0;
const t = (l, c) => { if (!c) fails++; ok(l, c); };

const ROOMS = [
  { id: 1, property_id: 10, name: 'Garden Room' },
  { id: 2, property_id: 10, name: 'Attic Room' },
  { id: 3, property_id: 10, name: 'Loft' },
  { id: 4, property_id: 10, name: 'Annexe' },
];

// ── Nothing booked ──
let o = computeDayOccupancy([], ROOMS);
t('empty day is 0 of 4', o.sold === 0 && o.total === 4);
t('empty day can still be sold whole', o.wholeSellable === true);
t('empty day lists every room as free', o.freeRooms.length === 4);

// ── One room booked ──
o = computeDayOccupancy([{ room_id: 2 }], ROOMS);
t('one room booked is 1 of 4', o.sold === 1 && o.total === 4);
t('the other three stay free', o.freeRooms.length === 3);
t('the booked room is not listed free', !o.freeRooms.some(r => r.id === 2));
t('whole place is no longer sellable once a room is taken', o.wholeSellable === false);

// ── Whole property booked — the case the old calendar could not express ──
o = computeDayOccupancy([{ room_id: null }], ROOMS);
t('a whole-property booking takes every room', o.sold === 4 && o.total === 4);
t('a whole-property booking leaves no free rooms', o.freeRooms.length === 0);
t('wholeTaken is set', o.wholeTaken === true);
t('whole place is not sellable twice', o.wholeSellable === false);

// A whole-property booking alongside a room booking — an overlap that should
// not exist once the trigger is live, but the maths must not go over capacity.
o = computeDayOccupancy([{ room_id: null }, { room_id: 1 }], ROOMS);
t('sold never exceeds total', o.sold === 4);

// ── Every room booked individually ──
o = computeDayOccupancy([{ room_id: 1 }, { room_id: 2 }, { room_id: 3 }, { room_id: 4 }], ROOMS);
t('all rooms individually booked is 4 of 4', o.sold === 4);
t('no free rooms left', o.freeRooms.length === 0);
t('whole place not sellable', o.wholeSellable === false);

// Two bookings on the SAME room (back-to-back dates both touching this day)
// must not count twice.
o = computeDayOccupancy([{ room_id: 1 }, { room_id: 1 }], ROOMS);
t('the same room booked twice counts once', o.sold === 1);

// ── A property with no rooms: capacity of one ──
o = computeDayOccupancy([], []);
t('whole-place property with no booking is 0 of 1', o.sold === 0 && o.total === 1);
t('whole-place property with no booking is sellable', o.wholeSellable === true);

o = computeDayOccupancy([{ room_id: null }], []);
t('whole-place property with a booking is 1 of 1', o.sold === 1 && o.total === 1);
t('whole-place property with a booking is not sellable', o.wholeSellable === false);

// ── Room labelling ──
const byProperty = indexRoomsByProperty(ROOMS);
t('rooms index groups by property', byProperty[10].length === 4);
t('a room booking shows the room name',
  roomLabelFor({ property_id: 10, room_id: 3 }, byProperty) === 'Loft');
t('a whole-property booking says Entire place',
  roomLabelFor({ property_id: 10, room_id: null }, byProperty) === 'Entire place');
t('a property with no rooms says nothing at all',
  roomLabelFor({ property_id: 99, room_id: null }, byProperty) === '');
t('a deleted room does not render as blank',
  roomLabelFor({ property_id: 10, room_id: 999 }, byProperty) === 'Room removed');

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nAll room occupancy checks passed');
