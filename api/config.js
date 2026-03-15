/**
 * Vercel Serverless Function to serve backend configuration
 * Auth: Firebase | Database: Supabase (PostgreSQL)
 *
 * Returns only public-safe configuration values (anon keys, project IDs).
 * Never expose service role keys or admin secrets through this endpoint.
 */

export default function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Return configuration from environment variables
  // All values here are public-safe (anon key with RLS, Firebase web config)
  const config = {
    // Supabase (Database — public anon key, secured via Row Level Security)
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    // Firebase (Authentication — web config keys are public by design)
    firebaseApiKey: process.env.FIREBASE_API_KEY || '',
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || 'resiq-by-hostizzy.firebaseapp.com',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'resiq-by-hostizzy',
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'resiq-by-hostizzy.firebasestorage.app',
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    firebaseAppId: process.env.FIREBASE_APP_ID || '',
    // Gmail OAuth (Client ID is public by design — secret stays server-side)
    gmailClientId: process.env.GMAIL_CLIENT_ID || ''
  };

  res.status(200).json(config);
}
