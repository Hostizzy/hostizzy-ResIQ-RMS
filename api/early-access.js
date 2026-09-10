/**
 * Vercel Serverless Function — how many founding places are left.
 *
 *   GET  →  { limit, taken, remaining, open }
 *
 * The landing page promises the first property free permanently, for the
 * first N owners. A scarcity claim nobody can verify reads as decoration, so
 * this counts the real thing: approved host accounts.
 *
 * Returns counts only — no names, no emails, nothing that identifies anyone.
 * Public and unauthenticated by necessity: it renders before signup.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   EARLY_ACCESS_LIMIT  (optional, defaults to 10)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIMIT = Number(process.env.EARLY_ACCESS_LIMIT || 10);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Short cache: the number changes rarely, and a stale-by-a-minute count is
    // far better than hammering the database from every page load.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        // Fail open rather than closed — a broken count must not make the page
        // claim the offer is gone.
        return res.status(200).json({ limit: LIMIT, taken: null, remaining: null, open: true });
    }

    try {
        // Approved hosts only. Pending signups have not been accepted yet, and
        // managed owners are Hostizzy's own properties, not founding members.
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/property_owners`
            + `?select=id&status=eq.approved&is_external=is.true&limit=1`,
            {
                headers: {
                    apikey: SUPABASE_SERVICE_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                    Prefer: 'count=exact',
                },
            }
        );
        if (!r.ok) throw new Error(`Supabase ${r.status}`);

        // PostgREST reports the total in Content-Range as "0-0/37".
        const range = r.headers.get('content-range') || '';
        const taken = Number((range.split('/')[1] || '').trim());
        if (!Number.isFinite(taken)) throw new Error('No count returned');

        const remaining = Math.max(0, LIMIT - taken);
        return res.status(200).json({ limit: LIMIT, taken, remaining, open: remaining > 0 });
    } catch (e) {
        console.error('[early-access] count failed:', e.message);
        return res.status(200).json({ limit: LIMIT, taken: null, remaining: null, open: true });
    }
}
