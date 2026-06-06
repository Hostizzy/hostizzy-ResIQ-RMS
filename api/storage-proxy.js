/**
 * Vercel Serverless Function — Supabase Storage Proxy
 *
 * Proxies storage operations (signed URLs, file uploads) through Vercel
 * to avoid ISP blocking of direct browser-to-Supabase connections.
 *
 * Actions:
 *   POST { action: "signed-url", bucket, path, expiresIn }
 *   POST { action: "upload", bucket, path, fileBase64, contentType, upsert }
 */

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb'
        }
    }
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Use service role key to bypass RLS — access control is enforced by ALLOWED_BUCKETS
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const ALLOWED_BUCKETS = ['guest-id-documents', 'expense-receipts'];

// Guest KYC uploads don't require Firebase auth (guests use booking code flow).
const GUEST_BUCKETS = ['guest-id-documents'];

const ALLOWED_ORIGINS = [
    'https://resiq.hostizzy.com',
    'http://localhost:3000',
    'http://localhost:8000'
];

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function verifyFirebaseToken(idToken) {
    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    if (!firebaseApiKey) throw new Error('Firebase API key not configured');
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    if (!response.ok) throw new Error('Invalid Firebase token');
    const data = await response.json();
    if (!data.users || data.users.length === 0) throw new Error('No user found');
    return data.users[0].localId;
}

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ data: null, error: { message: 'Method not allowed' } });
    }

    const { action, bucket, path, expiresIn, fileBase64, contentType, upsert } = req.body;

    // Validate bucket
    if (!ALLOWED_BUCKETS.includes(bucket)) {
        return res.status(200).json({ data: null, error: { message: 'Bucket not allowed' } });
    }

    // Require Firebase auth for non-guest buckets
    if (!GUEST_BUCKETS.includes(bucket)) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ data: null, error: { message: 'Authentication required' } });
        }
        try {
            await verifyFirebaseToken(authHeader.split('Bearer ')[1]);
        } catch (err) {
            return res.status(401).json({ data: null, error: { message: 'Invalid token: ' + err.message } });
        }
    }

    const authHeaders = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    };

    try {
        if (action === 'signed-url') {
            // Create a signed URL for downloading
            const response = await fetch(
                `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`,
                {
                    method: 'POST',
                    headers: { ...authHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ expiresIn: expiresIn || 3600 })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                return res.status(200).json({ data: null, error: result });
            }

            // Supabase returns { signedURL: "/object/sign/..." } — prepend the base URL
            const signedUrl = result.signedURL
                ? `${SUPABASE_URL}/storage/v1${result.signedURL}`
                : null;

            return res.status(200).json({
                data: { signedUrl },
                error: null
            });

        } else if (action === 'upload') {
            // Decode base64 file and upload to Supabase Storage
            const fileBuffer = Buffer.from(fileBase64, 'base64');

            const uploadHeaders = {
                ...authHeaders,
                'Content-Type': contentType || 'application/octet-stream'
            };
            if (upsert) {
                uploadHeaders['x-upsert'] = 'true';
            }

            const response = await fetch(
                `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
                {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: fileBuffer
                }
            );

            const result = await response.json();

            if (!response.ok) {
                return res.status(200).json({ data: null, error: result });
            }

            return res.status(200).json({
                data: { path: result.Key || path },
                error: null
            });

        } else {
            return res.status(200).json({ data: null, error: { message: 'Unknown action' } });
        }

    } catch (err) {
        return res.status(200).json({ data: null, error: { message: err.message } });
    }
}
