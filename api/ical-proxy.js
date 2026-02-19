/**
 * Vercel Serverless Function - iCal Proxy
 *
 * Proxies iCal calendar feed requests to avoid CORS issues.
 * Used for syncing Airbnb/OTA calendar availability.
 *
 * Usage: GET /api/ical-proxy?url=<encoded_ical_url>
 */

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  // Validate URL parameter
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  // Decode and validate the URL
  let icalUrl;
  try {
    icalUrl = decodeURIComponent(url);
    new URL(icalUrl); // Validate it's a proper URL
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Security: Only allow iCal-related URLs (Airbnb, Booking.com, etc.)
  const allowedDomains = [
    'airbnb.com',
    'airbnb.co.in',
    'booking.com',
    'agoda.com',
    'vrbo.com',
    'homeaway.com',
    'makemytrip.com',
    'goibibo.com',
    'tripadvisor.com'
  ];

  const urlHost = new URL(icalUrl).hostname.toLowerCase();
  const isAllowed = allowedDomains.some(domain => urlHost.includes(domain));

  if (!isAllowed) {
    return res.status(403).json({
      error: 'Domain not allowed',
      allowed: allowedDomains
    });
  }

  // Normalize webcal:// to https://
  icalUrl = icalUrl.replace(/^webcal:/i, 'https:');

  try {
    // Fetch the iCal file
    const response = await fetch(icalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'ResIQ-Calendar-Sync/1.0',
        'Accept': 'text/calendar, text/plain, */*'
      },
      // Set timeout to 10 seconds
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch iCal: ${response.status} ${response.statusText}`
      });
    }

    // Get the iCal data
    const icalData = await response.text();

    // Validate it's an iCal file
    if (!icalData.includes('BEGIN:VCALENDAR')) {
      return res.status(400).json({
        error: 'Invalid iCal format: Missing VCALENDAR'
      });
    }

    // Return with proper CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes

    return res.status(200).send(icalData);

  } catch (error) {
    console.error('iCal proxy error:', error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timeout - iCal server took too long to respond'
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch iCal data',
      details: error.message
    });
  }
}
