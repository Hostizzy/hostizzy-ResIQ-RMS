// =====================================================
// iCal parser smoke tests — run via: node test/ical-parser.test.js
// =====================================================
// Hand-written fixtures, no framework. Prints PASS/FAIL per case and
// exits 1 on any failure so CI can pick it up.
// =====================================================

const {
    parseICS,
    classifyEvent,
    _unfoldLines,
    _parseContentLine,
    _parseIcalDate,
    _parseIcalTimestamp,
} = require('../js/ical-parser.js');

let pass = 0;
let fail = 0;

function assertEq(label, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        pass++;
        console.log(`  PASS  ${label}`);
    } else {
        fail++;
        console.log(`  FAIL  ${label}`);
        console.log(`        expected: ${e}`);
        console.log(`        actual:   ${a}`);
    }
}

function section(name) {
    console.log(`\n[${name}]`);
}

// --------------------------------------------------
section('1. Line unfolding');

const folded = 'SUMMARY:Long guest\r\n  name continues\r\n\there and more\r\nDTSTART:20250105';
const unfolded = _unfoldLines(folded);
assertEq(
    'RFC 5545 continuation lines are merged',
    unfolded,
    ['SUMMARY:Long guest name continueshere and more', 'DTSTART:20250105']
);

// --------------------------------------------------
section('2. Content line parsing');

assertEq(
    'plain property',
    _parseContentLine('SUMMARY:Hello world'),
    { name: 'SUMMARY', params: {}, value: 'Hello world' }
);

assertEq(
    'property with single param',
    _parseContentLine('DTSTART;VALUE=DATE:20250105'),
    { name: 'DTSTART', params: { VALUE: 'DATE' }, value: '20250105' }
);

assertEq(
    'property with TZID param',
    _parseContentLine('DTSTART;TZID=Asia/Kolkata:20250105T100000'),
    { name: 'DTSTART', params: { TZID: 'Asia/Kolkata' }, value: '20250105T100000' }
);

assertEq(
    'value containing a colon (URL)',
    _parseContentLine('DESCRIPTION:Reservation URL: https://airbnb.com/hosting/res/HMN2PPSCME'),
    { name: 'DESCRIPTION', params: {}, value: 'Reservation URL: https://airbnb.com/hosting/res/HMN2PPSCME' }
);

// --------------------------------------------------
section('3. Date parsing');

assertEq('date-only YYYYMMDD', _parseIcalDate('20250105', {}), '2025-01-05');
assertEq(
    'UTC midnight → IST Jan 5',
    _parseIcalDate('20250104T183000Z', {}),
    '2025-01-05' // 6:30pm UTC Jan 4 = 12:00am IST Jan 5
);
assertEq(
    'floating local time (no Z, no TZID)',
    _parseIcalDate('20250105T100000', {}),
    '2025-01-05'
);
assertEq(
    'TZID=Asia/Kolkata local',
    _parseIcalDate('20250105T100000', { TZID: 'Asia/Kolkata' }),
    '2025-01-05'
);
assertEq('garbage input', _parseIcalDate('nope', {}), null);

// --------------------------------------------------
section('4. LAST-MODIFIED timestamp');

assertEq(
    'UTC LAST-MODIFIED → ISO',
    _parseIcalTimestamp('20250103T120000Z'),
    '2025-01-03T12:00:00.000Z'
);

// --------------------------------------------------
section('5. Full VCALENDAR — single Airbnb-style reservation');

const airbnbFeed = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20250105',
    'DTEND;VALUE=DATE:20250108',
    'SUMMARY:Airbnb (Not available)',
    'UID:airbnb-abcdef1234567890abcdef1234567890-res-very-long@airbnb.com',
    'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMN2PPSCME',
    'LAST-MODIFIED:20250103T120000Z',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
].join('\r\n');

const r1 = parseICS(airbnbFeed);
assertEq('no errors', r1.errors, []);
assertEq('one event', r1.events.length, 1);
if (r1.events[0]) {
    assertEq('full UID preserved (no truncation)', r1.events[0].uid, 'airbnb-abcdef1234567890abcdef1234567890-res-very-long@airbnb.com');
    assertEq('dtstart', r1.events[0].dtstart, '2025-01-05');
    assertEq('dtend', r1.events[0].dtend, '2025-01-08');
    assertEq('summary', r1.events[0].summary, 'Airbnb (Not available)');
    assertEq('lastModified', r1.events[0].lastModified, '2025-01-03T12:00:00.000Z');
    assertEq('classification', r1.events[0].classification, 'booked');
}

// --------------------------------------------------
section('6. Owner block classification via DESCRIPTION');

const ownerBlockFeed = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20250201',
    'DTEND;VALUE=DATE:20250205',
    'SUMMARY:Airbnb (Not available)',
    'UID:owner-block-1@airbnb.com',
    'DESCRIPTION:This block was created for the host. Blocked out dates.',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

const r2 = parseICS(ownerBlockFeed);
assertEq('owner block classified as blocked (via DESCRIPTION)', r2.events[0]?.classification, 'blocked');

// --------------------------------------------------
section('7. Multi-event feed with literal "BEGIN:VEVENT" inside DESCRIPTION');

const trickyFeed = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20250301',
    'DTEND;VALUE=DATE:20250303',
    'SUMMARY:Trip 1',
    'UID:trip-1@airbnb.com',
    'DESCRIPTION:Contains the text BEGIN:VEVENT inside it\\, harmless',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20250310',
    'DTEND;VALUE=DATE:20250312',
    'SUMMARY:Trip 2',
    'UID:trip-2@airbnb.com',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20250320',
    'DTEND;VALUE=DATE:20250322',
    'SUMMARY:Trip 3',
    'UID:trip-3@airbnb.com',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

const r3 = parseICS(trickyFeed);
assertEq('tricky feed: 3 events parsed despite literal BEGIN:VEVENT in text', r3.events.length, 3);
assertEq('tricky feed: no errors', r3.errors, []);
if (r3.events.length === 3) {
    assertEq('trip-1 summary', r3.events[0].summary, 'Trip 1');
    assertEq('trip-2 summary', r3.events[1].summary, 'Trip 2');
    assertEq('trip-3 summary', r3.events[2].summary, 'Trip 3');
}

// --------------------------------------------------
section('8. Line-folded SUMMARY across multiple lines');

const foldedSummary = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20250401',
    'DTEND;VALUE=DATE:20250403',
    'SUMMARY:This is a very long guest name that Airbnb',
    ' happened to split across multiple lines for no good reason',
    'UID:long-summary@airbnb.com',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

const r4 = parseICS(foldedSummary);
assertEq(
    'folded SUMMARY reassembled',
    r4.events[0]?.summary,
    'This is a very long guest name that Airbnbhappened to split across multiple lines for no good reason'
);

// --------------------------------------------------
section('9. Missing VCALENDAR returns error');

const r5 = parseICS('just some random text');
assertEq('error reported', r5.errors.length, 1);
assertEq('no events', r5.events.length, 0);

// --------------------------------------------------
section('10. Text escaping (\\, \\; \\n)');

const escapedFeed = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20250501',
    'DTEND;VALUE=DATE:20250502',
    'SUMMARY:Smith\\, John',
    'DESCRIPTION:Line 1\\nLine 2',
    'UID:esc-1@test',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

const r6 = parseICS(escapedFeed);
assertEq('escaped comma in SUMMARY', r6.events[0]?.summary, 'Smith, John');
assertEq('escaped newline in DESCRIPTION', r6.events[0]?.description, 'Line 1\nLine 2');

// --------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
