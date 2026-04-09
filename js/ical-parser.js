// =====================================================
// iCal (RFC 5545) Parser — Hostizzy ResIQ RMS
// =====================================================
//
// Line-based RFC 5545 parser with:
//   - Proper line unfolding (continuation lines start with space/tab)
//   - Parameter-safe property extraction (DTSTART;TZID=...:value)
//   - UTC + local + TZID=Asia/Kolkata date handling
//   - LAST-MODIFIED support for change detection
//   - Description-aware booked/blocked classifier
//
// Replaces the regex-based splitter that used to live in js/properties.js
// (parseIcalData, extractIcalField, parseIcalDate, isBlockedEvent).
//
// Exposes:
//   parseICS(text)     → { events: [...], errors: [...] }
//   classifyEvent(evt) → 'booked' | 'blocked'
//
// All functions are pure — no DOM, no Supabase, no network. Safe to
// use from Node for testing.
// =====================================================

(function (global) {
    'use strict';

    // --------------------------------------------------
    // Line unfolding (RFC 5545 §3.1)
    //
    // A long content line may be folded as "\r\n " or "\r\n\t". The
    // continuation whitespace is dropped and the lines are concatenated.
    // --------------------------------------------------
    function unfoldLines(text) {
        // Normalise line endings, then walk line-by-line so we can
        // concatenate continuation lines onto the previous line.
        const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        const out = [];
        for (const line of raw) {
            if (line.length > 0 && (line[0] === ' ' || line[0] === '\t')) {
                if (out.length > 0) {
                    out[out.length - 1] += line.substring(1);
                }
                // A continuation with no prior line is malformed; drop it.
            } else {
                out.push(line);
            }
        }
        return out;
    }

    // --------------------------------------------------
    // Parse a single content line into { name, params, value }.
    //
    // Example inputs:
    //   SUMMARY:Hello world                → name=SUMMARY, params={}, value="Hello world"
    //   DTSTART;VALUE=DATE:20250105         → name=DTSTART, params={VALUE:"DATE"}, value="20250105"
    //   DTSTART;TZID=Asia/Kolkata:20250105T100000
    //                                       → name=DTSTART, params={TZID:"Asia/Kolkata"}, value="20250105T100000"
    //
    // The key trick: the FIRST unquoted colon separates the left-hand
    // (name+params) from the value. Inside params, values may be quoted
    // with double quotes to escape colons/semicolons.
    // --------------------------------------------------
    function parseContentLine(line) {
        let i = 0;
        let inQuotes = false;
        const n = line.length;
        while (i < n) {
            const ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ':' && !inQuotes) {
                break;
            }
            i++;
        }
        if (i >= n) return null; // no colon found — not a property line

        const lhs = line.substring(0, i);
        const value = line.substring(i + 1);

        // Split lhs on unquoted semicolons
        const lhsParts = [];
        let start = 0;
        let q = false;
        for (let j = 0; j < lhs.length; j++) {
            const c = lhs[j];
            if (c === '"') q = !q;
            else if (c === ';' && !q) {
                lhsParts.push(lhs.substring(start, j));
                start = j + 1;
            }
        }
        lhsParts.push(lhs.substring(start));

        const name = lhsParts[0].toUpperCase();
        const params = {};
        for (let j = 1; j < lhsParts.length; j++) {
            const eq = lhsParts[j].indexOf('=');
            if (eq > 0) {
                const pname = lhsParts[j].substring(0, eq).toUpperCase();
                let pval = lhsParts[j].substring(eq + 1);
                if (pval.startsWith('"') && pval.endsWith('"')) {
                    pval = pval.substring(1, pval.length - 1);
                }
                params[pname] = pval;
            }
        }
        return { name, params, value };
    }

    // --------------------------------------------------
    // Unescape an iCal TEXT value: \\ \, \; \n (and \N)
    // --------------------------------------------------
    function unescapeText(s) {
        if (!s) return '';
        return s
            .replace(/\\\\/g, '\u0000')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\[nN]/g, '\n')
            .replace(/\u0000/g, '\\');
    }

    // --------------------------------------------------
    // Parse an iCal date/datetime value into a canonical
    // "YYYY-MM-DD" string. Returns null on failure.
    //
    // Accepts:
    //   YYYYMMDD                   (date-only, VALUE=DATE)
    //   YYYYMMDDTHHMMSS            (floating local time)
    //   YYYYMMDDTHHMMSSZ           (UTC) → converted to IST (UTC+5:30) date
    //   with param TZID=Asia/Kolkata   → used as-is
    //   with other TZIDs           → treated as local date (documented limit)
    //
    // For Indian hospitality the check-in/check-out date is what matters;
    // hour-of-day is rarely meaningful. UTC→IST conversion only flips the
    // date around midnight UTC, which is the only case worth handling.
    // --------------------------------------------------
    function parseIcalDate(value, params) {
        if (!value) return null;
        const clean = value.trim();

        // Date-only: YYYYMMDD
        if (/^\d{8}$/.test(clean)) {
            return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
        }

        // Date-time: YYYYMMDDTHHMMSS[Z]
        const m = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
        if (m) {
            const [, year, month, day, hour, minute, second, z] = m;
            const isUTC = (z === 'Z');
            if (isUTC) {
                const utc = new Date(Date.UTC(
                    parseInt(year), parseInt(month) - 1, parseInt(day),
                    parseInt(hour), parseInt(minute), parseInt(second)
                ));
                // Shift to IST (UTC+5:30) so date boundaries match Indian property ops.
                utc.setUTCMinutes(utc.getUTCMinutes() + 330);
                const y = utc.getUTCFullYear();
                const mo = String(utc.getUTCMonth() + 1).padStart(2, '0');
                const d = String(utc.getUTCDate()).padStart(2, '0');
                return `${y}-${mo}-${d}`;
            }
            // Local or TZID — use the date as-is. Supporting arbitrary TZIDs
            // would require a full tz database; document the limitation.
            return `${year}-${month}-${day}`;
        }

        // Fallback: grab first 8 digits if present (lenient)
        const digits = clean.replace(/\D/g, '');
        if (digits.length >= 8) {
            return `${digits.substring(0, 8).substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
        }
        return null;
    }

    // --------------------------------------------------
    // Parse LAST-MODIFIED into an ISO timestamp string.
    // iCal LAST-MODIFIED is always UTC per RFC 5545 §3.8.7.3.
    // --------------------------------------------------
    function parseIcalTimestamp(value) {
        if (!value) return null;
        const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
        if (!m) return null;
        const [, y, mo, d, h, mi, s] = m;
        return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
    }

    // --------------------------------------------------
    // Event classifier: decide if this VEVENT is a real guest
    // booking, an owner/maintenance block, or unknown.
    //
    // IMPORTANT: Airbnb and Booking.com use "Not available" /
    // "Reserved" / "CLOSED" in SUMMARY for REAL guest reservations
    // (they don't share guest names for privacy). Those must
    // classify as 'booked', not 'blocked'.
    //
    // Only DESCRIPTION keywords can reliably flag a block because
    // Airbnb's own owner-block DESCRIPTION includes "blocked out"
    // or "blocked" while a real reservation DESCRIPTION contains
    // "Reservation URL" / "HMN...".
    // --------------------------------------------------
    function classifyEvent(event) {
        const summary = (event.summary || '').toUpperCase();
        const desc = (event.description || '').toUpperCase();

        // Explicit owner-action keywords (match either field)
        const explicitBlock = [
            'OWNER BLOCK',
            'OWNER STAY',
            'OWNER HOLD',
            'MAINTENANCE',
            'PROPERTY CLOSED',
            'BLOCKED OUT',
        ];
        for (const kw of explicitBlock) {
            if (summary.includes(kw) || desc.includes(kw)) return 'blocked';
        }

        // Airbnb-specific: real reservations always have a reservation URL
        // or an HM-prefixed confirmation code in the description.
        if (desc.includes('RESERVATION URL') || /\bHM[A-Z0-9]{8,}\b/.test(desc)) {
            return 'booked';
        }

        // Default: treat as booked. This matches Airbnb's privacy-mode
        // summaries ("Not available", "Reserved", "CLOSED - ...") which
        // are the norm for real guest stays.
        return 'booked';
    }

    // --------------------------------------------------
    // Top-level parser. Returns { events, errors }.
    //
    // `events` is a list of:
    //   {
    //     uid:           full UID string (never truncated)
    //     summary:       unescaped text
    //     description:   unescaped text
    //     dtstart:       "YYYY-MM-DD" (date only; iCal check-in)
    //     dtend:         "YYYY-MM-DD" (date only; iCal check-out, exclusive)
    //     lastModified:  ISO timestamp or null
    //     classification:'booked' | 'blocked'
    //   }
    // --------------------------------------------------
    function parseICS(text) {
        const errors = [];
        const events = [];

        if (typeof text !== 'string' || text.length === 0) {
            errors.push('Empty or non-string input');
            return { events, errors };
        }
        if (!text.includes('BEGIN:VCALENDAR')) {
            errors.push('Missing BEGIN:VCALENDAR');
            return { events, errors };
        }

        const lines = unfoldLines(text);

        let inEvent = false;
        let current = null;
        for (const line of lines) {
            if (line === 'BEGIN:VEVENT' || line === 'BEGIN:VEVENT\r') {
                inEvent = true;
                current = {
                    uid: null,
                    summary: '',
                    description: '',
                    dtstart: null,
                    dtend: null,
                    lastModified: null,
                };
                continue;
            }
            if (line === 'END:VEVENT' || line === 'END:VEVENT\r') {
                if (current && current.dtstart && current.dtend) {
                    if (!current.uid) {
                        // Synthesize a stable UID from the dates — collision-prone
                        // but better than dropping the event.
                        current.uid = `synthetic-${current.dtstart}-${current.dtend}`;
                    }
                    current.classification = classifyEvent(current);
                    events.push(current);
                } else if (current) {
                    errors.push(`VEVENT missing DTSTART/DTEND (uid=${current.uid || '?'})`);
                }
                inEvent = false;
                current = null;
                continue;
            }
            if (!inEvent || !current) continue;

            const parsed = parseContentLine(line);
            if (!parsed) continue;

            switch (parsed.name) {
                case 'UID':
                    current.uid = parsed.value.trim();
                    break;
                case 'SUMMARY':
                    current.summary = unescapeText(parsed.value);
                    break;
                case 'DESCRIPTION':
                    current.description = unescapeText(parsed.value);
                    break;
                case 'DTSTART':
                    current.dtstart = parseIcalDate(parsed.value, parsed.params);
                    break;
                case 'DTEND':
                    current.dtend = parseIcalDate(parsed.value, parsed.params);
                    break;
                case 'LAST-MODIFIED':
                    current.lastModified = parseIcalTimestamp(parsed.value);
                    break;
                default:
                    break;
            }
        }

        return { events, errors };
    }

    // --------------------------------------------------
    // Export — browser globals + CommonJS (for node tests)
    // --------------------------------------------------
    const api = {
        parseICS,
        classifyEvent,
        // Exported for tests only:
        _unfoldLines: unfoldLines,
        _parseContentLine: parseContentLine,
        _parseIcalDate: parseIcalDate,
        _parseIcalTimestamp: parseIcalTimestamp,
        _unescapeText: unescapeText,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    global.IcalParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
