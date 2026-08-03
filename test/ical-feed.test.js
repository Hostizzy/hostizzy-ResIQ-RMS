/**
 * Round-trips the outbound feed through ResIQ's OWN iCal parser.
 *
 * If our importer can read our exporter, the format is sound — and that's the
 * exact path a channel takes when it subscribes. Cheaper and more meaningful
 * than asserting on strings.
 */
import { buildCalendar, relevantBookings } from '../api/ical-feed.js';
import { readFileSync } from 'fs';

let pass = 0, fail = 0;
const ok = (label, cond) => { cond ? pass++ : fail++; console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`); };

// ── Reuse the app's real parser rather than writing a second one. It attaches
//    itself to a global, so give it one. ──
const parserSrc = readFileSync(new URL('../js/ical-parser.js', import.meta.url), 'utf8');
new Function('global', parserSrc)(globalThis);


const rows = [
    { id: 1, check_in: '2026-07-12', check_out: '2026-07-15', status: 'confirmed', room_id: null, ical_uid: null },
    { id: 2, check_in: '2026-07-20', check_out: '2026-07-22', status: 'confirmed', room_id: 10,   ical_uid: 'abc-123@airbnb.com' },
    { id: 3, check_in: '2026-08-01', check_out: '2026-08-01', status: 'confirmed', room_id: 10,   ical_uid: null }, // zero-night
    { id: 4, check_in: null,          check_out: '2026-08-05', status: 'confirmed', room_id: 10,  ical_uid: null }, // malformed
];

const ics = buildCalendar(rows, 'ResIQ — Garden Room', '2026-08-01T00:00:00.000Z');

ok('starts and ends a valid VCALENDAR', ics.startsWith('BEGIN:VCALENDAR') && ics.trim().endsWith('END:VCALENDAR'));
ok('uses CRLF line endings as RFC 5545 requires', ics.includes('\r\n') && !/[^\r]\n/.test(ics));
ok('zero-night booking skipped', !ics.includes('20260801\r\nDTEND;VALUE=DATE:20260801'));
ok('malformed row skipped', (ics.match(/BEGIN:VEVENT/g) || []).length === 2);
ok('echoes the channel UID back (loop prevention)', ics.includes('UID:abc-123@airbnb.com'));
ok('mints our own UID when there is none', ics.includes('UID:resiq-1@resiq.hostizzy.com'));
ok('leaks no guest data', !/SUMMARY:(?!Reserved)/.test(ics));
ok('no line exceeds 75 octets', ics.split('\r\n').every(l => Buffer.from(l, 'utf8').length <= 75));

// ── The real test: our own importer reads it ──
const { events: parsedEvents } = globalThis.IcalParser.parseICS(ics);
ok('our parser reads the feed', Array.isArray(parsedEvents) && parsedEvents.length === 2);
if (Array.isArray(parsedEvents) && parsedEvents.length === 2) {
    const a = parsedEvents.find(e => String(e.uid || '').startsWith('resiq-1'));
    ok('round-tripped booking is recognisable', !!a);
    const startStr = JSON.stringify(a || {});
    ok('check-in survives the round trip',  startStr.includes('2026-07-12'));
    ok('checkout survives, DTEND still exclusive', startStr.includes('2026-07-15'));
    ok('channel-sourced UID preserved',
       parsedEvents.some(e => String(e.uid || '') === 'abc-123@airbnb.com'));
}

// ── Parent/child rule ──
const all = [
    { id: 1, check_in: '2026-07-12', check_out: '2026-07-15', status: 'confirmed', room_id: null },
    { id: 2, check_in: '2026-07-20', check_out: '2026-07-22', status: 'confirmed', room_id: 10 },
    { id: 3, check_in: '2026-07-25', check_out: '2026-07-27', status: 'confirmed', room_id: 11 },
    { id: 4, check_in: '2026-08-01', check_out: '2026-08-03', status: 'cancelled', room_id: 10 },
];
ok('property feed carries every live booking',
   relevantBookings(all, { kind: 'property' }).length === 3);
ok('room feed = own bookings + whole-property',
   relevantBookings(all, { kind: 'room', room: { id: 10 } }).map(r => r.id).join() === '1,2');
ok('one room never blocks another',
   !relevantBookings(all, { kind: 'room', room: { id: 11 } }).some(r => r.id === 2));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
