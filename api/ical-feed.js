/**
 * Vercel Serverless Function — outbound iCal feed (the "two-way" half of sync).
 *
 * ResIQ already READS channel calendars. This publishes one, so Airbnb,
 * Booking.com and VRBO can subscribe and stop selling dates you've filled
 * elsewhere.
 *
 *   GET /api/ical-feed?t=<token>   →   text/calendar
 *
 * The token IS the auth. There is no session here: the URL is pasted into a
 * third party's settings and fetched by their servers, so it must be
 * unguessable and revocable, and it must never expose guest data.
 *
 * Parent/child rule (mixed selling)
 * ---------------------------------
 * A property may be sold whole AND by room. The feed has to reflect that or it
 * will oversell:
 *
 *   property feed  → every booking on the property (whole-property bookings
 *                    AND every room booking), because if any room is occupied
 *                    the whole place cannot be sold.
 *   room feed      → that room's bookings PLUS whole-property bookings,
 *                    because booking the whole place occupies every room.
 *
 * Loop prevention
 * ---------------
 * ResIQ imports channel calendars, so a booking that arrived from Airbnb would
 * otherwise go straight back out to Airbnb under a new UID, and Airbnb would
 * add a phantom block on top of its own reservation. Because the import stores
 * the original UID in reservations.ical_uid, we echo that UID back out. The
 * channel recognises its own event and dedupes instead of duplicating.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    return r.json();
}

/** 'YYYY-MM-DD' → 'YYYYMMDD' for a VALUE=DATE property. */
function toIcalDate(d) {
    if (!d) return null;
    const s = String(d).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s.replace(/-/g, '');
}

/** RFC 5545 escaping for text values. */
function esc(text) {
    return String(text == null ? '' : text)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 requires lines be folded at 75 octets, continued with a leading
 * space. Some channel parsers are strict about this, so fold on bytes rather
 * than characters — a multi-byte character split across the boundary would
 * corrupt the value.
 */
function fold(line) {
    const bytes = Buffer.from(line, 'utf8');
    if (bytes.length <= 75) return line;

    const parts = [];
    let start = 0;
    let limit = 75;
    while (start < bytes.length) {
        let end = Math.min(start + limit, bytes.length);
        // Don't split a multi-byte sequence: back off to a lead byte.
        while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
        parts.push(bytes.slice(start, end).toString('utf8'));
        start = end;
        limit = 74; // continuation lines carry a leading space
    }
    return parts.join('\r\n ');
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Method not allowed');
    }

    const token = (req.query.t || '').toString().trim();
    if (!token || token.length < 16) {
        return res.status(404).send('Not found');
    }

    try {
        // Resolve the token. Try rooms first — a room token is the more
        // specific match, and the two sets never overlap.
        let scope = null;

        const roomRows = await sb(
            `rooms?ical_feed_token=eq.${encodeURIComponent(token)}&select=id,name,property_id&limit=1`
        );
        if (roomRows.length) {
            scope = { kind: 'room', room: roomRows[0], propertyId: roomRows[0].property_id };
        } else {
            const propRows = await sb(
                `properties?ical_feed_token=eq.${encodeURIComponent(token)}&select=id,name&limit=1`
            );
            if (propRows.length) {
                scope = { kind: 'property', property: propRows[0], propertyId: propRows[0].id };
            }
        }

        // Unknown token looks identical to a missing page — don't confirm that
        // a token exists but is wrong.
        if (!scope) return res.status(404).send('Not found');

        const rows = await sb(
            `reservations?property_id=eq.${scope.propertyId}` +
            `&select=id,booking_id,check_in,check_out,status,room_id,ical_uid` +
            `&order=check_in.asc&limit=2000`
        );

        const relevant = rows.filter(r => {
            if (!r.check_in || !r.check_out) return false;
            if (String(r.status || '').toLowerCase() === 'cancelled') return false;
            if (scope.kind === 'property') return true;      // any booking blocks the whole place
            return r.room_id == null || String(r.room_id) === String(scope.room.id);
        });

        const calName = scope.kind === 'room'
            ? `ResIQ — ${scope.room.name}`
            : `ResIQ — ${scope.property.name}`;

        const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Hostizzy//ResIQ//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            fold(`X-WR-CALNAME:${esc(calName)}`),
        ];

        for (const r of relevant) {
            const start = toIcalDate(r.check_in);
            const end = toIcalDate(r.check_out);
            if (!start || !end || end <= start) continue;   // skip malformed / zero-night rows

            // Echo the channel's own UID back so it dedupes rather than
            // creating a phantom block over its own reservation.
            const uid = r.ical_uid
                ? r.ical_uid
                : `resiq-${r.id}@resiq.hostizzy.com`;

            lines.push(
                'BEGIN:VEVENT',
                fold(`UID:${esc(uid)}`),
                `DTSTAMP:${stamp}`,
                // DTEND is exclusive for VALUE=DATE, so checkout day stays sellable.
                `DTSTART;VALUE=DATE:${start}`,
                `DTEND;VALUE=DATE:${end}`,
                // Deliberately no guest name, phone or amount. This URL lives
                // inside a third party's system.
                'SUMMARY:Reserved',
                'TRANSP:OPAQUE',
                'STATUS:CONFIRMED',
                'END:VEVENT'
            );
        }

        lines.push('END:VCALENDAR');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="resiq.ics"');
        // Channels poll every few hours; a short cache protects us from a
        // misconfigured client hammering the endpoint.
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
        res.setHeader('X-Robots-Tag', 'noindex');
        return res.status(200).send(lines.join('\r\n') + '\r\n');

    } catch (err) {
        console.error('[ical-feed]', err.message);
        return res.status(500).send('Feed temporarily unavailable');
    }
}
