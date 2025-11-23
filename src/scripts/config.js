/**
 * Configuration - Supabase setup and constants
 */

import { createClient } from '@supabase/supabase-js'

// Supabase Configuration from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in .env file')
    console.error('Please copy .env.example to .env and fill in your values')
    throw new Error('Missing Supabase configuration')
}

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Make available globally for legacy code compatibility
window.supabase = { createClient }
window.supabaseClient = supabase

console.log('✅ Supabase client initialized:', SUPABASE_URL)

// Booking Type Constants
export const BOOKING_TYPES = {
    'STAYCATION': { label: 'Staycation', icon: '🏖️' },
    'WEDDING': { label: 'Wedding', icon: '💒' },
    'BIRTHDAY': { label: 'Birthday Party', icon: '🎂' },
    'CORPORATE_EVENT': { label: 'Corporate Event', icon: '🏢' },
    'CORPORATE_STAY': { label: 'Corporate Stay', icon: '💼' },
    'SHOOT': { label: 'Shoot', icon: '📸' }
}

// Target occupancy nights per property per year
export const TARGET_OCCUPANCY_NIGHTS = 200

// Database constants
export const DB_NAME = 'HostizzyOfflineDB'
export const DB_VERSION = 1
