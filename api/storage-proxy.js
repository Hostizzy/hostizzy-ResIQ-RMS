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
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const ALLOWED_BUCKETS = ['guest-id-documents'];

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ data: null, error: { message: 'Method not allowed' } });
    }

    const { action, bucket, path, expiresIn, fileBase64, contentType, upsert } = req.body;

    // Validate bucket
    if (!ALLOWED_BUCKETS.includes(bucket)) {
        return res.status(200).json({ data: null, error: { message: 'Bucket not allowed' } });
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
