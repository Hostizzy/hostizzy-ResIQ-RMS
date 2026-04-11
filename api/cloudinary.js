/**
 * Vercel Serverless Function — Cloudinary Proxy
 *
 * Single endpoint routing by ?action=:
 *   - public-config        → returns { cloudName, apiKey } for browser use
 *   - sign-upload          → POST { kind, propertyId, ownerId?, guestId?, expenseId?, publicId? }
 *                            returns a signed upload payload. Authenticated resources
 *                            (type='authenticated') are used for guest IDs; 'upload'
 *                            (public CDN) for expense receipts.
 *   - sign-view            → POST { publicId, resourceType, deliveryType, format? }
 *                            returns a signed delivery URL (30 min) for authenticated resources.
 *   - delete-old-ids       → GET (Vercel Cron / CRON_SECRET protected)
 *                            deletes resources under guest-ids/ older than 90 days and
 *                            nulls the corresponding guest_documents URL columns.
 *
 * Env vars required:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *   CRON_SECRET  (for delete-old-ids — same secret used by /api/daily-summary)
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for the delete cron to null DB rows)
 */

import crypto from 'crypto';

const CLOUD_NAME    = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY       = process.env.CLOUDINARY_API_KEY;
const API_SECRET    = process.env.CLOUDINARY_API_SECRET;
const SUPABASE_URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GUEST_ID_RETENTION_DAYS = 90;

// Allowed resource kinds and their delivery settings
const KIND_CONFIG = {
    'guest-id': {
        folderPrefix: 'guest-ids',
        tags: 'guest-id',
        type: 'authenticated',          // requires signed URL to view
        resourceType: 'image'
    },
    'expense-receipt': {
        folderPrefix: 'expenses',
        tags: 'expense',
        type: 'upload',                 // public CDN URL
        resourceType: 'image'
    }
};

/**
 * Sign Cloudinary params per their spec:
 *   sort keys alphabetically, join as k=v&k=v, append api_secret, SHA-1 hex.
 * https://cloudinary.com/documentation/signatures
 */
function signParams(params) {
    const toSign = Object.keys(params)
        .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .sort()
        .map(k => `${k}=${params[k]}`)
        .join('&');
    return crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');
}

function jsonError(res, status, message) {
    return res.status(status).json({ data: null, error: { message } });
}

function getConfigErrors() {
    const missing = [];
    if (!CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!API_KEY) missing.push('CLOUDINARY_API_KEY');
    if (!API_SECRET) missing.push('CLOUDINARY_API_SECRET');
    return missing;
}

/**
 * Build a deterministic but unguessable public_id so uploads are idempotent per
 * (property, owner/expense, guestId, kind). Callers may pass an explicit publicId.
 */
function buildPublicId({ kind, propertyId, ownerId, guestId, expenseId, guestSequence, fieldName }) {
    const cfg = KIND_CONFIG[kind];
    const rand = crypto.randomBytes(6).toString('hex');
    if (kind === 'guest-id') {
        // guest-ids/property-<id>/guest-<bookingId>-<seq>/<field>-<rand>
        const scope = propertyId ? `property-${propertyId}` : 'unknown-property';
        const gid = guestId ? `guest-${guestId}-${guestSequence || 1}` : `guest-${rand}`;
        const field = fieldName || 'doc';
        return `${cfg.folderPrefix}/${scope}/${gid}/${field}-${rand}`;
    }
    // expense-receipt
    const scope = propertyId ? `property-${propertyId}` : (ownerId ? `owner-${ownerId}` : 'unknown');
    const eid = expenseId ? `expense-${expenseId}` : `expense-${rand}`;
    return `${cfg.folderPrefix}/${scope}/${eid}-${rand}`;
}

// ---------------------------------------------------------------
// Action: public-config
// ---------------------------------------------------------------
function handlePublicConfig(req, res) {
    const missing = getConfigErrors();
    if (missing.length) return jsonError(res, 500, `Cloudinary not configured: missing ${missing.join(', ')}`);
    return res.status(200).json({
        data: { cloudName: CLOUD_NAME, apiKey: API_KEY },
        error: null
    });
}

// ---------------------------------------------------------------
// Action: sign-upload
// ---------------------------------------------------------------
function handleSignUpload(req, res) {
    const missing = getConfigErrors();
    if (missing.length) return jsonError(res, 500, `Cloudinary not configured: missing ${missing.join(', ')}`);

    const { kind, propertyId, ownerId, guestId, guestSequence, expenseId, fieldName, publicId: explicitPublicId } = req.body || {};
    if (!kind || !KIND_CONFIG[kind]) {
        return jsonError(res, 400, `Invalid kind. Must be one of: ${Object.keys(KIND_CONFIG).join(', ')}`);
    }
    const cfg = KIND_CONFIG[kind];

    const public_id = explicitPublicId || buildPublicId({ kind, propertyId, ownerId, guestId, guestSequence, expenseId, fieldName });
    const timestamp = Math.floor(Date.now() / 1000);

    // Params that the client will POST to Cloudinary; every param included here
    // (except api_key, resource_type and file) must be in the signature.
    const signed = {
        public_id,
        tags: cfg.tags,
        timestamp,
        type: cfg.type,
        overwrite: 'true'
    };
    const signature = signParams(signed);

    return res.status(200).json({
        data: {
            cloudName: CLOUD_NAME,
            apiKey: API_KEY,
            resourceType: cfg.resourceType,
            uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${cfg.resourceType}/upload`,
            params: { ...signed, api_key: API_KEY, signature }
        },
        error: null
    });
}

// ---------------------------------------------------------------
// Action: sign-view
// ---------------------------------------------------------------
function handleSignView(req, res) {
    const missing = getConfigErrors();
    if (missing.length) return jsonError(res, 500, `Cloudinary not configured: missing ${missing.join(', ')}`);

    const { publicId, resourceType = 'image', deliveryType = 'authenticated', format = 'jpg' } = req.body || {};
    if (!publicId) return jsonError(res, 400, 'publicId is required');

    // Signed URL valid for 30 minutes
    const expiresAt = Math.floor(Date.now() / 1000) + 1800;

    // Cloudinary signed delivery URL format:
    //   https://res.cloudinary.com/<cloud>/<resource>/<type>/s--<sig>--/<public_id>.<fmt>
    // where sig = first 8 chars of SHA-1(public_id + api_secret) — but this is the
    // legacy form. We use the timestamp-based signed URL via the Admin utility:
    //   sign = SHA-1("public_id=<id>&timestamp=<t>" + api_secret)
    // This matches the documented pattern used by the SDKs.

    const toSign = {
        public_id: publicId,
        timestamp: expiresAt
    };
    const sig = signParams(toSign);

    // Build the URL. For `authenticated` delivery we include the signature as
    // ?api_key=...&timestamp=...&signature=... (query form), which Cloudinary
    // accepts and validates.
    const url = `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/${deliveryType}/${publicId}.${format}`
        + `?api_key=${API_KEY}&timestamp=${expiresAt}&signature=${sig}`;

    return res.status(200).json({
        data: { signedUrl: url, expiresAt },
        error: null
    });
}

// ---------------------------------------------------------------
// Action: delete-old-ids  (cron)
// ---------------------------------------------------------------
async function handleDeleteOldIds(req, res) {
    // Cron secret check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    const missing = getConfigErrors();
    if (missing.length) return jsonError(res, 500, `Cloudinary not configured: missing ${missing.join(', ')}`);
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return jsonError(res, 500, 'Supabase env not configured');
    }

    const cutoffMs = Date.now() - GUEST_ID_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();

    console.log(`[cloudinary-delete-old-ids] Deleting guest ID resources created before ${cutoffIso}`);

    // 1. List resources under guest-ids/ prefix (type=authenticated). Cloudinary
    //    pages at 500 per request; we loop over next_cursor until done and collect
    //    IDs older than the cutoff.
    const toDelete = [];
    let nextCursor = null;
    let loopGuard = 0;
    const listAuth = 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

    do {
        loopGuard++;
        if (loopGuard > 20) break; // safety: at most 10k resources per run
        const params = new URLSearchParams({
            type: 'authenticated',
            prefix: 'guest-ids/',
            max_results: '500'
        });
        if (nextCursor) params.set('next_cursor', nextCursor);

        const listResp = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image?${params.toString()}`,
            { headers: { Authorization: listAuth } }
        );
        if (!listResp.ok) {
            const t = await listResp.text();
            throw new Error(`Cloudinary list failed: ${t}`);
        }
        const listJson = await listResp.json();
        for (const r of (listJson.resources || [])) {
            if (!r.created_at) continue;
            if (new Date(r.created_at).getTime() < cutoffMs) {
                toDelete.push(r.public_id);
            }
        }
        nextCursor = listJson.next_cursor || null;
    } while (nextCursor);

    console.log(`[cloudinary-delete-old-ids] Found ${toDelete.length} expired guest ID resources`);

    // 2. Delete in batches of 100 (Admin API max per request)
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        const params = new URLSearchParams();
        batch.forEach(id => params.append('public_ids[]', id));
        params.set('type', 'authenticated');
        const delResp = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image?${params.toString()}`,
            { method: 'DELETE', headers: { Authorization: listAuth } }
        );
        if (!delResp.ok) {
            const t = await delResp.text();
            console.error(`Cloudinary delete batch failed: ${t}`);
            continue;
        }
        const delJson = await delResp.json();
        deleted += Object.keys(delJson.deleted || {}).length;
    }

    // 3. Null the DB columns for any guest_documents whose URL references a deleted public_id.
    //    We do this by matching on substring — guest_documents URLs include the public_id.
    let dbUpdatedRows = 0;
    for (const publicId of toDelete) {
        // Match any of the three URL columns that contain the public_id
        const like = `%${publicId}%`;
        for (const col of ['document_front_url', 'document_back_url', 'selfie_url']) {
            const url = `${SUPABASE_URL}/rest/v1/guest_documents?${col}=like.${encodeURIComponent(like)}&select=id`;
            const r = await fetch(url, {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            });
            if (!r.ok) continue;
            const rows = await r.json();
            for (const row of rows) {
                const patchUrl = `${SUPABASE_URL}/rest/v1/guest_documents?id=eq.${row.id}`;
                await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=minimal'
                    },
                    body: JSON.stringify({ [col]: null })
                });
                dbUpdatedRows++;
            }
        }
    }

    return res.status(200).json({
        data: {
            cutoff: cutoffIso,
            foundExpired: toDelete.length,
            cloudinaryDeleted: deleted,
            dbColumnsNulled: dbUpdatedRows
        },
        error: null
    });
}

// ---------------------------------------------------------------
// Router
// ---------------------------------------------------------------
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = (req.query?.action) || (req.body && req.body.action);

    try {
        if (action === 'public-config') return handlePublicConfig(req, res);
        if (action === 'sign-upload') {
            if (req.method !== 'POST') return jsonError(res, 405, 'POST required');
            return handleSignUpload(req, res);
        }
        if (action === 'sign-view') {
            if (req.method !== 'POST') return jsonError(res, 405, 'POST required');
            return handleSignView(req, res);
        }
        if (action === 'delete-old-ids') {
            if (req.method !== 'GET') return jsonError(res, 405, 'GET required');
            return await handleDeleteOldIds(req, res);
        }
        return jsonError(res, 400, `Unknown action: ${action}`);
    } catch (err) {
        console.error('[cloudinary]', err);
        return jsonError(res, 500, err.message || 'Cloudinary proxy error');
    }
}
