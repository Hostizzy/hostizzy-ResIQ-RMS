/**
 * Vercel Serverless Function to serve Supabase configuration
 * This keeps secrets out of client-side code
 */

export default function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers to allow requests from your domain
  res.setHeader('Access-Control-Allow-Origin', '*'); // In production, replace with your domain
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

  // Return Supabase configuration from environment variables
  // These will be set in Vercel dashboard
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || 'https://dxthxsguqrxpurorpokq.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4dGh4c2d1cXJ4cHVyb3Jwb2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjc4MTMsImV4cCI6MjA3NTYwMzgxM30.JhGzqUolA-A_fGha-0DhHVl7p1vRq4CZcp5ttdVxjQg'
  };

  res.status(200).json(config);
}
