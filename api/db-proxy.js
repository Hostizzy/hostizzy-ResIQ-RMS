/**
 * Vercel Serverless Function — Supabase Database Proxy
 *
 * Proxies all database operations through Vercel to avoid ISP blocking
 * of direct browser-to-Supabase connections (common in India).
 *
 * Architecture: Browser → Vercel API → Supabase PostgREST
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const ALLOWED_TABLES = [
    'reservations', 'properties', 'payments', 'team_members',
    'property_owners', 'payout_requests', 'guest_documents',
    'guest_meal_preferences', 'guest_portal_sessions',
    'synced_availability', 'settlement_status', 'property_expenses',
    'communications'
];

/**
 * Convert a filter descriptor to PostgREST query parameter format
 */
function applyFilter(params, filter) {
    const { method, args } = filter;
    switch (method) {
        case 'eq':  params.append(args[0], `eq.${args[1]}`); break;
        case 'neq': params.append(args[0], `neq.${args[1]}`); break;
        case 'gt':  params.append(args[0], `gt.${args[1]}`); break;
        case 'gte': params.append(args[0], `gte.${args[1]}`); break;
        case 'lt':  params.append(args[0], `lt.${args[1]}`); break;
        case 'lte': params.append(args[0], `lte.${args[1]}`); break;
        case 'like':  params.append(args[0], `like.${args[1]}`); break;
        case 'ilike': params.append(args[0], `ilike.${args[1]}`); break;
        case 'is':  params.append(args[0], `is.${args[1]}`); break;
        case 'in': {
            const vals = args[1].map(v => typeof v === 'string' ? `"${v}"` : v).join(',');
            params.append(args[0], `in.(${vals})`);
            break;
        }
        case 'or': params.append('or', `(${args[0]})`); break;
        case 'not': params.append(args[0], `not.${args[1]}.${args[2]}`); break;
        case 'contains': params.append(args[0], `cs.${JSON.stringify(args[1])}`); break;
    }
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ data: null, error: { message: 'Method not allowed' } });
    }

    const {
        table, operation, select = '*', data,
        filters = [], order = [], single, maybeSingle,
        limit, count, returning
    } = req.body;

    // Validate table
    if (!ALLOWED_TABLES.includes(table)) {
        return res.status(200).json({ data: null, error: { message: 'Access denied: table not allowed' } });
    }

    // Build query string
    const params = new URLSearchParams();
    params.set('select', select);

    for (const f of filters) {
        applyFilter(params, f);
    }

    if (order.length > 0) {
        params.set('order', order.map(o => {
            const dir = (o.options && o.options.ascending === false) ? 'desc' : 'asc';
            return `${o.column}.${dir}`;
        }).join(','));
    }

    if (limit) params.set('limit', String(limit));

    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;

    // Build headers
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };

    const prefer = [];
    if (returning && (operation === 'insert' || operation === 'update' || operation === 'upsert' || operation === 'delete')) {
        prefer.push('return=representation');
    }
    if (operation === 'upsert') {
        prefer.push('resolution=merge-duplicates');
    }
    if (count) {
        prefer.push(`count=${count}`);
    }
    if (prefer.length > 0) {
        headers['Prefer'] = prefer.join(',');
    }

    // single() uses PostgREST's Accept header to return object instead of array
    if (single && !maybeSingle) {
        headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    // Determine HTTP method
    let httpMethod, body;
    switch (operation) {
        case 'select':  httpMethod = 'GET'; break;
        case 'insert':  httpMethod = 'POST';  body = JSON.stringify(data); break;
        case 'update':  httpMethod = 'PATCH'; body = JSON.stringify(data); break;
        case 'delete':  httpMethod = 'DELETE'; break;
        case 'upsert':  httpMethod = 'POST';  body = JSON.stringify(data); break;
        default:
            return res.status(200).json({ data: null, error: { message: 'Invalid operation' } });
    }

    try {
        const response = await fetch(url, { method: httpMethod, headers, body });

        // Parse response body
        let responseData = null;
        const contentType = response.headers.get('content-type');
        const responseText = await response.text();
        if (responseText && contentType && contentType.includes('json')) {
            try { responseData = JSON.parse(responseText); } catch (e) { /* non-JSON */ }
        }

        if (!response.ok) {
            return res.status(200).json({
                data: null,
                error: responseData || { message: `PostgREST error: ${response.status}` }
            });
        }

        // Handle maybeSingle: return first item or null (no error for 0 rows)
        if (maybeSingle && Array.isArray(responseData)) {
            if (responseData.length === 0) responseData = null;
            else if (responseData.length === 1) responseData = responseData[0];
            // >1 rows: return as error
            else {
                return res.status(200).json({
                    data: null,
                    error: { message: 'Multiple rows returned for maybeSingle', code: 'PGRST116' }
                });
            }
        }

        // Extract count from content-range header
        let resultCount = null;
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
            const match = contentRange.match(/\/(\d+)/);
            if (match) resultCount = parseInt(match[1]);
        }

        return res.status(200).json({ data: responseData, error: null, count: resultCount });

    } catch (err) {
        return res.status(200).json({ data: null, error: { message: err.message } });
    }
}
