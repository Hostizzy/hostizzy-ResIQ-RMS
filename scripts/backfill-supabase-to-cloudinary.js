/**
 * Supabase Storage → Cloudinary Migration Script
 *
 * One-shot backfill: reads every row in guest_documents and property_expenses,
 * downloads any Supabase Storage assets, re-uploads them to Cloudinary with
 * the correct folder / delivery type / tags, then rewrites the DB columns.
 *
 * Prerequisites:
 *   npm install @supabase/supabase-js cloudinary
 *
 * Environment variables (all required):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY          (service role — bypasses RLS)
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Optional:
 *   DRY_RUN=1                     (list what would be migrated, do not write)
 *   ONLY=guest-ids|expenses       (limit to one bucket)
 *
 * Idempotency:
 *   Rows whose stored URL already looks like a Cloudinary reference
 *   (`cloudinary:` prefix or `res.cloudinary.com` in the URL) are skipped.
 *
 * Run:
 *   node scripts/backfill-supabase-to-cloudinary.js
 */

const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;

// ── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const CLOUD_NAME    = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUD_KEY     = process.env.CLOUDINARY_API_KEY;
const CLOUD_SECRET  = process.env.CLOUDINARY_API_SECRET;
const DRY_RUN       = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const ONLY          = (process.env.ONLY || '').toLowerCase();

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}
if (!CLOUD_NAME || !CLOUD_KEY || !CLOUD_SECRET) {
    console.error('Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: CLOUD_KEY,
    api_secret: CLOUD_SECRET,
    secure: true
});

const GUEST_BUCKET   = 'guest-id-documents';
const EXPENSE_BUCKET = 'expense-receipts';

// ── Helpers ────────────────────────────────────────────────────────────────

function isAlreadyCloudinary(val) {
    if (!val || typeof val !== 'string') return false;
    return val.startsWith('cloudinary:') || val.includes('res.cloudinary.com');
}

async function downloadFromSupabase(bucket, path) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) throw new Error(`Supabase download failed (${bucket}/${path}): ${error.message}`);
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function uploadToCloudinary(buffer, { publicId, type, tags }) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                type,
                tags,
                overwrite: true,
                resource_type: 'image'
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
        stream.end(buffer);
    });
}

function buildGuestIdPublicId(doc, field) {
    const prop = doc.property_id || 'unknown-property';
    const bid = doc.booking_id || 'unknown-booking';
    const seq = doc.guest_sequence || 1;
    return `guest-ids/property-${prop}/guest-${bid}-${seq}/${field}-migrated`;
}

function buildExpensePublicId(expense) {
    const prop = expense.property_id || 'unknown';
    const eid = expense.id || `exp-${Date.now()}`;
    return `expenses/property-${prop}/expense-${eid}-migrated`;
}

// ── Guest documents ────────────────────────────────────────────────────────

async function migrateGuestDocuments() {
    console.log('\n=== Migrating guest_documents ===');
    const { data: rows, error } = await supabase
        .from('guest_documents')
        .select('id, booking_id, property_id, guest_sequence, document_front_url, document_back_url, selfie_url');
    if (error) {
        console.error('Failed to read guest_documents:', error.message);
        return;
    }

    // Many rows don't have property_id in the guest_documents table directly — look it up
    // via reservations if needed.
    const { data: reservations } = await supabase
        .from('reservations')
        .select('booking_id, property_id');
    const bookingToProperty = new Map((reservations || []).map(r => [r.booking_id, r.property_id]));

    let migrated = 0, skipped = 0, failed = 0;

    for (const row of rows) {
        // Patch property_id from reservations if missing
        if (!row.property_id && row.booking_id) {
            row.property_id = bookingToProperty.get(row.booking_id) || null;
        }

        const fields = [
            { col: 'document_front_url', field: 'front' },
            { col: 'document_back_url', field: 'back' },
            { col: 'selfie_url', field: 'selfie' }
        ];

        const updates = {};
        for (const { col, field } of fields) {
            const val = row[col];
            if (!val) continue;
            if (isAlreadyCloudinary(val)) {
                skipped++;
                continue;
            }

            try {
                console.log(`  [guest_docs id=${row.id}] ${col}: ${val}`);
                if (DRY_RUN) {
                    migrated++;
                    continue;
                }
                const buffer = await downloadFromSupabase(GUEST_BUCKET, val);
                const publicId = buildGuestIdPublicId(row, field);
                const result = await uploadToCloudinary(buffer, {
                    publicId,
                    type: 'authenticated',
                    tags: 'guest-id,migrated'
                });
                updates[col] = `cloudinary:authenticated/${result.public_id}`;
                migrated++;
            } catch (err) {
                console.error(`    FAILED: ${err.message}`);
                failed++;
            }
        }

        if (!DRY_RUN && Object.keys(updates).length > 0) {
            const { error: updErr } = await supabase
                .from('guest_documents')
                .update(updates)
                .eq('id', row.id);
            if (updErr) {
                console.error(`    DB update failed for id=${row.id}: ${updErr.message}`);
                failed++;
            }
        }
    }

    console.log(`guest_documents: migrated=${migrated} skipped=${skipped} failed=${failed}`);
}

// ── Expense receipts ───────────────────────────────────────────────────────

async function migrateExpenseReceipts() {
    console.log('\n=== Migrating property_expenses.receipt_url ===');
    const { data: rows, error } = await supabase
        .from('property_expenses')
        .select('id, property_id, receipt_url');
    if (error) {
        console.error('Failed to read property_expenses:', error.message);
        return;
    }

    let migrated = 0, skipped = 0, failed = 0;

    for (const row of rows) {
        const val = row.receipt_url;
        if (!val) continue;
        if (isAlreadyCloudinary(val)) {
            skipped++;
            continue;
        }

        try {
            console.log(`  [expense id=${row.id}] receipt_url: ${val}`);

            // Two legacy shapes we need to handle:
            //   1. storage path: `property-123/1700000000000.jpg`
            //   2. baked signed URL: `https://xxx.supabase.co/storage/v1/object/sign/expense-receipts/...`
            let buffer;
            if (val.startsWith('http')) {
                // Try the baked URL directly (it may have expired, but some are year-long)
                const r = await fetch(val);
                if (!r.ok) throw new Error(`HTTP ${r.status} from baked URL`);
                buffer = Buffer.from(await r.arrayBuffer());
            } else {
                buffer = await downloadFromSupabase(EXPENSE_BUCKET, val);
            }

            if (DRY_RUN) {
                migrated++;
                continue;
            }

            const publicId = buildExpensePublicId(row);
            const result = await uploadToCloudinary(buffer, {
                publicId,
                type: 'upload',
                tags: 'expense,migrated'
            });

            const { error: updErr } = await supabase
                .from('property_expenses')
                .update({ receipt_url: result.secure_url })
                .eq('id', row.id);
            if (updErr) throw new Error(`DB update: ${updErr.message}`);

            migrated++;
        } catch (err) {
            console.error(`    FAILED: ${err.message}`);
            failed++;
        }
    }

    console.log(`property_expenses: migrated=${migrated} skipped=${skipped} failed=${failed}`);
}

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
    console.log(`Cloudinary backfill — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Cloud: ${CLOUD_NAME}`);
    console.log(`Supabase: ${SUPABASE_URL}`);
    if (ONLY) console.log(`ONLY: ${ONLY}`);

    try {
        if (!ONLY || ONLY === 'guest-ids') {
            await migrateGuestDocuments();
        }
        if (!ONLY || ONLY === 'expenses') {
            await migrateExpenseReceipts();
        }
        console.log('\nDone.');
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
})();
