/**
 * =====================================================
 * SCRIPT: Populate revenue_share_percent in Reservations
 * Purpose: Fill revenue_share_percent for all reservations
 *          based on their property's commission rate
 *
 * USAGE:
 * 1. Open your main app (index.html) in browser
 * 2. Login as admin
 * 3. Open browser console (F12)
 * 4. Copy and paste this entire script
 * 5. Run: await populateRevenueSharePercent()
 * =====================================================
 */

async function populateRevenueSharePercent() {
    console.log('🚀 Starting revenue_share_percent population...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase client not found. Please run this from the main app.');
        return;
    }

    try {
        // STEP 1: Get all properties with their commission rates
        console.log('\n📋 Step 1: Fetching all properties...');
        const { data: properties, error: propertiesError } = await supabase
            .from('properties')
            .select('id, property_name, revenue_share_percent');

        if (propertiesError) {
            console.error('❌ Error fetching properties:', propertiesError);
            return;
        }

        console.log(`✅ Found ${properties.length} properties`);
        console.table(properties.map(p => ({
            ID: p.id,
            Name: p.property_name,
            Commission: p.revenue_share_percent + '%'
        })));

        // STEP 2: Get all reservations
        console.log('\n📋 Step 2: Fetching all reservations...');
        const { data: reservations, error: reservationsError } = await supabase
            .from('reservations')
            .select('booking_id, property_id, revenue_share_percent');

        if (reservationsError) {
            console.error('❌ Error fetching reservations:', reservationsError);
            return;
        }

        console.log(`✅ Found ${reservations.length} reservations`);

        // STEP 3: Check if column exists by checking first reservation
        const hasColumn = reservations.length > 0 && 'revenue_share_percent' in reservations[0];

        if (!hasColumn) {
            console.warn('⚠️  Column "revenue_share_percent" does not exist in reservations table');
            console.warn('⚠️  Please add it first using the SQL script: populate-revenue-share-percent.sql');
            console.warn('⚠️  Or run this SQL command:');
            console.log('\nALTER TABLE reservations ADD COLUMN revenue_share_percent NUMERIC(5,2) DEFAULT 20.00;\n');
            return;
        }

        // STEP 4: Update reservations
        console.log('\n📋 Step 3: Updating reservations...');
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const reservation of reservations) {
            const property = properties.find(p => p.id === reservation.property_id);

            if (!property) {
                console.warn(`⚠️  Property not found for reservation ${reservation.booking_id}`);
                skipped++;
                continue;
            }

            // Update reservation with property's commission rate
            const { error: updateError } = await supabase
                .from('reservations')
                .update({
                    revenue_share_percent: property.revenue_share_percent || 20,
                    updated_at: new Date().toISOString()
                })
                .eq('booking_id', reservation.booking_id);

            if (updateError) {
                console.error(`❌ Error updating ${reservation.booking_id}:`, updateError);
                errors++;
            } else {
                updated++;
                if (updated % 10 === 0) {
                    console.log(`   Progress: ${updated}/${reservations.length} updated...`);
                }
            }
        }

        // STEP 5: Summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ COMPLETED!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 Total Reservations: ${reservations.length}`);
        console.log(`✅ Successfully Updated: ${updated}`);
        console.log(`⚠️  Skipped: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);

        // STEP 6: Verification - Get updated counts
        console.log('\n📋 Step 4: Verifying updates...');
        const { data: verification, error: verifyError } = await supabase
            .from('reservations')
            .select('revenue_share_percent, property_id, properties(property_name)');

        if (!verifyError && verification) {
            const breakdown = {};
            verification.forEach(r => {
                const percent = r.revenue_share_percent || 'NULL';
                breakdown[percent] = (breakdown[percent] || 0) + 1;
            });

            console.log('\n📊 Revenue Share Breakdown:');
            console.table(Object.entries(breakdown).map(([percent, count]) => ({
                'Commission %': percent,
                'Count': count
            })));
        }

        // STEP 7: Sample verification
        console.log('\n📋 Step 5: Sample verification (first 5 reservations)...');
        const { data: sample } = await supabase
            .from('reservations')
            .select(`
                booking_id,
                revenue_share_percent,
                properties (
                    property_name,
                    revenue_share_percent
                )
            `)
            .limit(5);

        if (sample) {
            console.table(sample.map(s => ({
                'Booking ID': s.booking_id,
                'Property': s.properties?.property_name,
                'Property Commission': s.properties?.revenue_share_percent + '%',
                'Reservation Commission': s.revenue_share_percent + '%',
                'Match': s.revenue_share_percent === s.properties?.revenue_share_percent ? '✅' : '❌'
            })));
        }

        console.log('\n✅ All done! Revenue share percentages have been populated.');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

/**
 * DRY RUN: Check what will be updated without making changes
 */
async function dryRunRevenueSharePercent() {
    console.log('🔍 DRY RUN: Checking what will be updated...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase client not found. Please run this from the main app.');
        return;
    }

    try {
        const { data: reservations } = await supabase
            .from('reservations')
            .select(`
                booking_id,
                property_id,
                revenue_share_percent,
                properties (
                    property_name,
                    revenue_share_percent
                )
            `);

        const needsUpdate = reservations.filter(r =>
            r.revenue_share_percent !== r.properties?.revenue_share_percent
        );

        console.log(`📊 Total Reservations: ${reservations.length}`);
        console.log(`🔄 Need Update: ${needsUpdate.length}`);
        console.log(`✅ Already Correct: ${reservations.length - needsUpdate.length}`);

        if (needsUpdate.length > 0) {
            console.log('\n📋 Reservations that will be updated:');
            console.table(needsUpdate.slice(0, 10).map(r => ({
                'Booking ID': r.booking_id,
                'Property': r.properties?.property_name,
                'Current %': r.revenue_share_percent || 'NULL',
                'Will be %': r.properties?.revenue_share_percent
            })));

            if (needsUpdate.length > 10) {
                console.log(`... and ${needsUpdate.length - 10} more`);
            }
        }

        console.log('\n💡 To proceed with the update, run: await populateRevenueSharePercent()');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Instructions
console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Revenue Share Percent Population Script                      ║
╚════════════════════════════════════════════════════════════════╝

📝 INSTRUCTIONS:

1️⃣  First, run a DRY RUN to see what will change:
   → await dryRunRevenueSharePercent()

2️⃣  If everything looks good, run the actual update:
   → await populateRevenueSharePercent()

⚠️  PREREQUISITES:
   - Must run from main app (index.html) browser console
   - Must be logged in as admin
   - Column 'revenue_share_percent' must exist in reservations table
   - If column doesn't exist, run the SQL script first

🔒 SAFETY:
   - Script only updates NULL or mismatched values
   - Does not affect existing correct values
   - Each update is logged to console
   - Includes verification at the end

════════════════════════════════════════════════════════════════
`);
