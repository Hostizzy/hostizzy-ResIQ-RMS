/**
 * Vercel Serverless Function — RAG assistant (OpenAI + Supabase).
 *
 * The Flutter app sends a natural-language question + short history. This
 * endpoint:
 *   1. Verifies the caller's Firebase ID token.
 *   2. Resolves their scope (staff = all; owner = their property_ids).
 *   3. RETRIEVES the user's REAL data from Supabase (service role, scoped):
 *      properties, reservations, payments, expenses, host/owner profile,
 *      and upcoming availability.
 *   4. AUGMENTED GENERATION: sends ONLY that data + the question to OpenAI
 *      with strict grounding — answer only from the data, never invent,
 *      no outside/internet knowledge (zero hallucination).
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_API_KEY
 *   OPENAI_API_KEY
 *   OPENAI_MODEL (optional, default 'gpt-4o-mini')
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const ALLOWED_ORIGINS = [
  'https://resiq.hostizzy.com',
  'http://localhost:3000',
  'http://localhost:8000',
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function verifyFirebaseToken(idToken) {
  const key = process.env.FIREBASE_API_KEY;
  if (!key) throw new Error('Firebase API key not configured');
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!r.ok) throw new Error('Invalid Firebase token');
  const d = await r.json();
  if (!d.users || !d.users.length) throw new Error('No user found');
  return { uid: d.users[0].localId, email: d.users[0].email };
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!r.ok) return [];
  return r.json();
}

/** Resolve who the caller is and which properties they may see. */
async function resolveScope(email) {
  const staff = await sb(
    `team_members?email=eq.${encodeURIComponent(email)}&select=id,name,role,is_active&limit=1`
  );
  if (staff.length) {
    return { type: 'staff', name: staff[0].name, role: staff[0].role, propertyIds: null };
  }
  const owner = await sb(
    `property_owners?email=eq.${encodeURIComponent(email)}&select=id,name,property_ids,commission_rate,bank_name,upi_id&limit=1`
  );
  if (owner.length) {
    return {
      type: 'owner',
      name: owner[0].name,
      profile: owner[0],
      propertyIds: Array.isArray(owner[0].property_ids) ? owner[0].property_ids : [],
    };
  }
  return { type: 'unknown', propertyIds: [] };
}

/** Retrieve the real, scoped records the assistant may ground its answer on. */
async function retrieve(scope) {
  const scoped = scope.propertyIds; // null = all
  const inProps = scoped && scoped.length
    ? `&property_id=in.(${scoped.join(',')})`
    : '';

  // Properties
  let properties = await sb(
    `properties?select=id,name,location,type,capacity,revenue_share_percent,is_managed,ical_url${
      scoped && scoped.length ? `&id=in.(${scoped.join(',')})` : ''
    }&order=name`
  );

  // Reservations (cap to keep the prompt bounded) — most recent first.
  const resCols =
    'booking_id,property_name,guest_name,guest_phone,check_in,check_out,nights,adults,kids,status,booking_source,booking_type,total_amount,paid_amount,payment_status,hostizzy_revenue,host_payout,kyc_status';
  let reservations = await sb(
    `reservations?select=${resCols}${inProps}&order=check_in.desc&limit=250`
  );

  // Payments (recent)
  let payments = await sb(
    `payments?select=booking_id,amount,payment_method,payment_recipient,payment_date&order=payment_date.desc&limit=200`
  );
  if (scoped && scoped.length) {
    const ids = new Set(reservations.map((r) => r.booking_id));
    payments = payments.filter((p) => ids.has(p.booking_id));
  }

  // Expenses (recent)
  let expenses = await sb(
    `property_expenses?select=property_name,property_id,amount,category,expense_date,description${inProps}&order=expense_date.desc&limit=120`
  );

  // Upcoming availability (iCal-synced blocked dates)
  let availability = await sb(
    `synced_availability?select=property_id,blocked_date,source,booking_summary${inProps}&order=blocked_date.asc&limit=200`
  );

  return { properties, reservations, payments, expenses, availability };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const auth = req.headers.authorization || '';
    const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Missing Authorization' });
    const caller = await verifyFirebaseToken(idToken);
    if (!caller.email) return res.status(403).json({ error: 'No email claim' });

    const { question, history = [] } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'Missing question' });
    }

    const scope = await resolveScope(caller.email);
    const data = await retrieve(scope);

    // Today's date in IST for relative questions.
    const istNow = new Date(Date.now() + 5.5 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    const system =
      "You are Rezi, the friendly AI assistant inside ResIQ — a vacation-rental property-management app. " +
      "Answer the user's question using ONLY the JSON in DATA below — it is the user's real, live records " +
      "(properties/listings, reservations/bookings, payments, expenses, host profile, availability). " +
      'RULES: (1) Use ONLY this data — never use outside or general knowledge. ' +
      "(2) If the answer is not present in the data, say you don't have that information — never guess or invent bookings, amounts, names, or dates. " +
      '(3) Be concise and specific; use ₹ for money and the exact names from the data. ' +
      `(4) Today is ${istNow} (IST). ` +
      `(5) The user is a ${scope.type}${scope.name ? ' named ' + scope.name : ''}; only their scoped data is provided.`;

    const dataBlock = 'DATA:\n' + JSON.stringify({
      today: istNow,
      user: { type: scope.type, name: scope.name || null },
      hostProfile: scope.profile || null,
      properties: data.properties,
      reservations: data.reservations,
      payments: data.payments,
      expenses: data.expenses,
      availability: data.availability,
    });

    const messages = [
      { role: 'system', content: system },
      { role: 'system', content: dataBlock },
      ...(Array.isArray(history)
        ? history.slice(-6).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: String(m.content || '').slice(0, 2000),
          }))
        : []),
      { role: 'user', content: String(question).slice(0, 2000) },
    ];

    const oai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    if (!oai.ok) {
      const errText = await oai.text();
      console.error('[ai-chat] OpenAI error:', oai.status, errText);
      return res.status(502).json({ error: 'AI service error' });
    }
    const out = await oai.json();
    const answer = out.choices?.[0]?.message?.content?.trim() ||
      "I couldn't generate an answer.";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error('[ai-chat] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
