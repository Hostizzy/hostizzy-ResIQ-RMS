/**
 * Firebase User Migration Script
 *
 * Reads staff (team_members) and owners (property_owners) from Supabase
 * and creates corresponding Firebase Auth accounts.
 *
 * Prerequisites:
 *   1. npm install firebase-admin @supabase/supabase-js
 *   2. Download Firebase service account key JSON from:
 *      Firebase Console > Project Settings > Service Accounts > Generate New Private Key
 *   3. Place the JSON file as ./firebase-service-account.json (or set FIREBASE_SA_PATH env var)
 *
 * Usage:
 *   node scripts/migrate-users-to-firebase.js
 *
 * Environment Variables (optional):
 *   SUPABASE_URL           - Supabase project URL
 *   SUPABASE_SERVICE_KEY   - Supabase service role key (NOT the anon key)
 *   FIREBASE_SA_PATH       - Path to Firebase service account JSON
 *   DEFAULT_PASSWORD       - Default password for migrated users (min 8 chars)
 */

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// ── Configuration ────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dxthxsguqrxpurorpokq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const FIREBASE_SA_PATH = process.env.FIREBASE_SA_PATH || './firebase-service-account.json';
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'ResIQ@2026';

// ── Initialize Services ──────────────────────────────────────────

if (!SUPABASE_KEY) {
    console.error('ERROR: Set SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY environment variable.');
    console.error('       Use the service role key from Supabase Dashboard > Settings > API.');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = require(FIREBASE_SA_PATH);
} catch (e) {
    console.error(`ERROR: Cannot load Firebase service account from ${FIREBASE_SA_PATH}`);
    console.error('       Download it from Firebase Console > Project Settings > Service Accounts.');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Migration Logic ──────────────────────────────────────────────

async function migrateUsers() {
    console.log('=== Firebase User Migration ===\n');

    // Fetch all staff
    const { data: staff, error: staffErr } = await supabase
        .from('team_members')
        .select('id, name, email, role, is_active');

    if (staffErr) {
        console.error('Failed to fetch team_members:', staffErr.message);
        return;
    }

    // Fetch all owners
    const { data: owners, error: ownersErr } = await supabase
        .from('property_owners')
        .select('id, name, email, is_active');

    if (ownersErr) {
        console.error('Failed to fetch property_owners:', ownersErr.message);
        return;
    }

    // Combine and deduplicate by email
    const allUsers = [];
    const seenEmails = new Set();

    for (const s of (staff || [])) {
        if (s.email && !seenEmails.has(s.email.toLowerCase())) {
            seenEmails.add(s.email.toLowerCase());
            allUsers.push({ email: s.email, name: s.name, role: 'staff', active: s.is_active });
        }
    }

    for (const o of (owners || [])) {
        if (o.email && !seenEmails.has(o.email.toLowerCase())) {
            seenEmails.add(o.email.toLowerCase());
            allUsers.push({ email: o.email, name: o.name, role: 'owner', active: o.is_active });
        }
    }

    console.log(`Found ${staff?.length || 0} staff + ${owners?.length || 0} owners = ${allUsers.length} unique users\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of allUsers) {
        try {
            // Check if user already exists in Firebase
            try {
                await admin.auth().getUserByEmail(user.email);
                console.log(`  SKIP: ${user.email} (already exists in Firebase)`);
                skipped++;
                continue;
            } catch (e) {
                if (e.code !== 'auth/user-not-found') throw e;
            }

            // Create Firebase user
            await admin.auth().createUser({
                email: user.email,
                password: DEFAULT_PASSWORD,
                displayName: user.name,
                emailVerified: true,
                disabled: !user.active
            });

            console.log(`  CREATE: ${user.email} (${user.role}) ${!user.active ? '[DISABLED]' : ''}`);
            created++;

        } catch (err) {
            console.error(`  ERROR: ${user.email} - ${err.message}`);
            errors++;
        }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`  Created: ${created}`);
    console.log(`  Skipped: ${skipped} (already existed)`);
    console.log(`  Errors:  ${errors}`);
    console.log(`  Total:   ${allUsers.length}`);

    if (created > 0) {
        console.log(`\nIMPORTANT: All new users were created with password "${DEFAULT_PASSWORD}"`);
        console.log('Tell your users to log in and use "Forgot Password" to set their own password.');
    }

    process.exit(0);
}

migrateUsers().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
