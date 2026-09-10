/**
 * Vercel Serverless Function — RAG assistant (OpenAI + Supabase).
 *
 * The Flutter app sends a natural-language question + short history. This
 * endpoint:
 *   1. Verifies the caller's Firebase ID token.
 *   2. Resolves their scope (staff = all; owner = properties.owner_id).
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
// Frontier default; override on Vercel with OPENAI_MODEL (e.g. gpt-5.4, gpt-5.5).
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

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
    `team_members?email=eq.${encodeURIComponent(email)}&select=*&limit=1`
  );
  if (staff.length) {
    return { type: 'staff', name: staff[0].name, role: staff[0].role, propertyIds: null };
  }
  const owner = await sb(
    `property_owners?email=eq.${encodeURIComponent(email)}&select=*&limit=1`
  );
  if (owner.length) {
    // Scope comes from properties.owner_id, the same source auth-exchange puts
    // in the JWT and every jwt_* RLS policy reads. property_owners.property_ids
    // was a denormalised copy that had drifted — reading it here meant the
    // assistant answered from a different set of properties than the app showed.
    const props = await sb(
      `properties?owner_id=eq.${encodeURIComponent(owner[0].id)}&select=id`
    );
    return {
      type: 'owner',
      name: owner[0].name,
      profile: owner[0],
      propertyIds: props.map((p) => p.id),
    };
  }
  return { type: 'unknown', propertyIds: [] };
}

/**
 * Retrieve the real, scoped records the assistant grounds its answer on.
 *
 * IMPORTANT: we fetch with `select=*` (not hand-picked column lists). PostgREST
 * 400s the ENTIRE query if any single named column doesn't exist, and sb()
 * swallows that into []. The app itself reads with `.select()` (all columns) and
 * tolerates absent columns via null — so `*` here keeps us schema-proof and
 * matches what the app actually sees. The full rows are used for exact
 * aggregation; only trimmed fields are sent to the model (see handler).
 */
async function retrieve(scope) {
  const scoped = scope.propertyIds; // null = all
  const inProps = scoped && scoped.length
    ? `&property_id=in.(${scoped.join(',')})`
    : '';
  const inIds = scoped && scoped.length
    ? `&id=in.(${scoped.join(',')})`
    : '';

  const properties = await sb(`properties?select=*${inIds}&order=name`);

  // Fetch a wide window so server-side totals are accurate (only a trimmed
  // subset is later put in the prompt).
  const reservations = await sb(
    `reservations?select=*${inProps}&order=check_in.desc&limit=2000`
  );

  let payments = await sb(
    `payments?select=*&order=payment_date.desc&limit=400`
  );
  if (scoped && scoped.length) {
    const ids = new Set(reservations.map((r) => r.booking_id));
    payments = payments.filter((p) => ids.has(p.booking_id));
  }

  const expenses = await sb(
    `property_expenses?select=*${inProps}&order=expense_date.desc&limit=2000`
  );

  const availability = await sb(
    `synced_availability?select=*${inProps}&order=blocked_date.asc&limit=300`
  );

  return { properties, reservations, payments, expenses, availability };
}

/** Add N days to a 'YYYY-MM-DD' string (UTC), returning 'YYYY-MM-DD'. */
function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const _num = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Compute EXACT aggregates in code (not by the LLM) so any total/count/sum the
 * user asks for is correct. Cancelled bookings are excluded from financials.
 */
function computeMetrics(data, today) {
  const month = today.slice(0, 7); // 'YYYY-MM'
  const lastMonth = addDays(month + '-01', -1).slice(0, 7);
  const next7 = addDays(today, 7);
  const r = data.reservations || [];
  const exp = data.expenses || [];

  let totalValue = 0,
    totalCollected = 0,
    totalOutstanding = 0,
    hostizzyRevenue = 0,
    hostPayout = 0;
  let kycPending = 0,
    checkInsToday = 0,
    checkOutsToday = 0,
    inHouse = 0,
    arrivalsNext7 = 0;
  let monthBookings = 0,
    monthValue = 0,
    monthNights = 0,
    lastMonthValue = 0;
  const byStatus = {};
  const countBySource = {};
  const revenueByProperty = {};
  const revenueBySource = {};
  const pending = [];

  for (const b of r) {
    const tot = _num(b.total_amount);
    const paid = _num(b.paid_amount);
    const ota = _num(b.ota_service_fee);
    const src = b.booking_source || 'unknown';
    const status = String(b.status || '').toLowerCase();
    const cancelled = status === 'cancelled' || status === 'canceled';
    // OTA-aware receivable/balance — mirrors the app's Reservation model.
    const isOta = src !== 'DIRECT' && ota > 0;
    const receivable = isOta ? tot - ota : tot;
    const balance = receivable - paid;

    byStatus[status || 'unknown'] = (byStatus[status || 'unknown'] || 0) + 1;
    countBySource[src] = (countBySource[src] || 0) + 1;

    if (!cancelled) {
      totalValue += tot;
      totalCollected += paid;
      if (balance > 0) {
        totalOutstanding += balance;
        pending.push({
          guest: b.guest_name || '—',
          property: b.property_name || '—',
          balance: Math.round(balance),
        });
      }
      hostizzyRevenue += _num(b.hostizzy_revenue);
      hostPayout += _num(b.host_payout);
      const prop = b.property_name || 'unknown';
      revenueByProperty[prop] = (revenueByProperty[prop] || 0) + tot;
      revenueBySource[src] = (revenueBySource[src] || 0) + tot;
    }

    const kyc = String(b.kyc_status || '').toLowerCase();
    if (kyc && !['completed', 'done', 'verified', 'approved'].includes(kyc)) {
      kycPending++;
    }
    if (b.check_in === today) checkInsToday++;
    if (b.check_out === today) checkOutsToday++;
    if (b.check_in && b.check_out && b.check_in <= today && today < b.check_out) {
      inHouse++;
    }
    if (b.check_in && b.check_in > today && b.check_in <= next7) arrivalsNext7++;
    const ciMonth = String(b.check_in || '').slice(0, 7);
    if (!cancelled && ciMonth === month) {
      monthBookings++;
      monthValue += tot;
      monthNights += _num(b.nights);
    }
    if (!cancelled && ciMonth === lastMonth) lastMonthValue += tot;
  }

  let totalExpenses = 0;
  const expensesByCategory = {};
  for (const e of exp) {
    const a = _num(e.amount);
    totalExpenses += a;
    const c = e.category || 'other';
    expensesByCategory[c] = (expensesByCategory[c] || 0) + a;
  }

  const round = (n) => Math.round(n);
  // Sort + round a {key:number} map, keeping the biggest `cap` entries.
  const sortMap = (m, cap = 50) =>
    Object.fromEntries(
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, cap)
        .map(([k, v]) => [k, round(v)])
    );
  const revByProp = sortMap(revenueByProperty);
  const topProp = Object.entries(revByProp)[0];
  pending.sort((a, b) => b.balance - a.balance);

  return {
    note:
      `EXACT precomputed figures from ${r.length} bookings and ${exp.length} ` +
      `expenses. Use these for any total / count / sum / revenue-by-X / ` +
      `outstanding / occupancy question instead of re-summing the raw lists.`,
    counts: { properties: (data.properties || []).length, bookings: r.length },
    financials: {
      totalBookingValue: round(totalValue),
      totalCollected: round(totalCollected),
      totalOutstanding: round(totalOutstanding),
      hostizzyRevenue: round(hostizzyRevenue),
      hostPayout: round(hostPayout),
      totalExpenses: round(totalExpenses),
      netAfterExpenses: round(hostizzyRevenue - totalExpenses),
    },
    today: { date: today, checkInsToday, checkOutsToday, inHouse, arrivalsNext7 },
    thisMonth: {
      month,
      bookings: monthBookings,
      value: round(monthValue),
      nightsBooked: monthNights,
    },
    lastMonth: { month: lastMonth, value: round(lastMonthValue) },
    kycPending,
    bookingsByStatus: byStatus,
    bookingsBySource: countBySource,
    revenueByProperty: revByProp,
    revenueBySource: sortMap(revenueBySource),
    expensesByCategory,
    topPropertyByValue: topProp
      ? { name: topProp[0], value: topProp[1] }
      : null,
    topPendingBookings: pending.slice(0, 10),
  };
}

// Actions Rezi can propose. The APP executes them under the user's own RLS
// session after a confirm tap — this endpoint never writes to the DB.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_reservation',
      description: 'Create a new booking/reservation from the user request.',
      parameters: {
        type: 'object',
        properties: {
          property_name: { type: 'string' },
          guest_name: { type: 'string' },
          guest_phone: { type: 'string' },
          check_in: { type: 'string', description: 'YYYY-MM-DD' },
          check_out: { type: 'string', description: 'YYYY-MM-DD' },
          adults: { type: 'integer' },
          kids: { type: 'integer' },
          stay_amount: { type: 'number' },
          advance: { type: 'number' },
          source: {
            type: 'string',
            description: 'DIRECT, AIRBNB, MMT/GOIBIBO, BOOKING.COM or AGODA',
          },
        },
        required: ['guest_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_payment',
      description: 'Record a payment received against an existing booking.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'string' },
          guest_name: { type: 'string' },
          amount: { type: 'number' },
          method: { type: 'string', description: 'upi, cash, bank, card' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_whatsapp',
      description: 'Open WhatsApp to message a guest.',
      parameters: {
        type: 'object',
        properties: {
          guest_name: { type: 'string' },
          phone: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Open a screen in the app.',
      parameters: {
        type: 'object',
        properties: {
          screen: {
            type: 'string',
            description:
              'one of: dashboard, today, reservations, payments, business, properties, guests, expenses, enquiries, settlements, intelligence',
          },
        },
        required: ['screen'],
      },
    },
  },
];

/** A friendly confirmation line when the model proposes an action. */
function actionConfirm(type, a) {
  switch (type) {
    case 'create_reservation':
      return `Create a booking${a.guest_name ? ' for ' + a.guest_name : ''}` +
        `${a.property_name ? ' at ' + a.property_name : ''}` +
        `${a.check_in ? ' (' + a.check_in + (a.check_out ? ' → ' + a.check_out : '') + ')' : ''}? ` +
        'Tap below to review & save.';
    case 'record_payment':
      return `Record a payment of ₹${a.amount}${a.guest_name ? ' from ' + a.guest_name : ''}? Tap below to confirm.`;
    case 'send_whatsapp':
      return `Message ${a.guest_name || a.phone || 'the guest'} on WhatsApp? Tap below to open.`;
    case 'navigate':
      return `Opening ${a.screen}…`;
    default:
      return 'Tap below to continue.';
  }
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

    // Exact, server-computed aggregates (the LLM must not re-add records itself).
    const metrics = computeMetrics(data, istNow);

    // Trim the (wide) raw rows to compact, useful fields for the prompt — the
    // full rows already fed the exact METRICS above, so the model only needs
    // enough detail to answer about specific bookings/guests/dates.
    const trimRes = (data.reservations || []).slice(0, 150).map((b) => ({
      booking_id: b.booking_id,
      property: b.property_name,
      guest: b.guest_name,
      phone: b.guest_phone,
      check_in: b.check_in,
      check_out: b.check_out,
      nights: b.nights,
      status: b.status,
      source: b.booking_source,
      total: b.total_amount,
      paid: b.paid_amount,
      payment_status: b.payment_status,
      kyc: b.kyc_status,
    }));
    const trimPay = (data.payments || []).slice(0, 120).map((p) => ({
      booking_id: p.booking_id,
      amount: p.amount,
      method: p.payment_method,
      to: p.payment_recipient,
      date: p.payment_date,
    }));
    const trimExp = (data.expenses || []).slice(0, 100).map((e) => ({
      property: e.property_name,
      amount: e.amount,
      category: e.category,
      date: e.expense_date,
      note: e.description,
    }));
    const properties = (data.properties || []).map((p) => ({
      name: p.name,
      location: p.location,
      type: p.type,
      capacity: p.capacity,
    }));

    const system =
      "You are Rezi, the friendly AI assistant inside ResIQ — a vacation-rental property-management app. " +
      "Answer the user's question using ONLY the JSON in DATA below — it is the user's real, live records " +
      "(properties/listings, reservations/bookings, payments, expenses, host profile, availability) plus a METRICS object. " +
      'RULES: (1) Use ONLY this data — never use outside or general knowledge. ' +
      '(2) For any total, count, sum, revenue, outstanding, occupancy, breakdown, or "how much / how many / by property / by channel" question, READ the answer from METRICS (it has exact figures incl. revenueByProperty, revenueBySource, topPendingBookings, today, thisMonth). Do NOT re-sum the raw lists — they are trimmed and would undercount. ' +
      '(3) Use the detailed reservations/payments/expenses lists only for specific bookings, guests, or dates. ' +
      "(4) Only say you don't have the information if it is genuinely absent from BOTH metrics and the lists. A value of 0 (e.g. 0 check-ins today) IS an answer — state it plainly; never guess or invent data. " +
      '(5) Be concise and specific; use ₹ for money and the exact names from the data. ' +
      `(6) Today is ${istNow} (IST). ` +
      `(7) The user is a ${scope.type}${scope.name ? ' named ' + scope.name : ''}; only their scoped data is provided. ` +
      '(8) You can also DO things: when the user clearly asks to create a booking, record a payment, message a guest, or open a screen, call the matching tool (create_reservation / record_payment / send_whatsapp / navigate) with the details you can extract — the app will ask the user to confirm, so do not ask for confirmation yourself. For everything else, answer from DATA.';

    const dataBlock = 'DATA:\n' + JSON.stringify({
      today: istNow,
      user: { type: scope.type, name: scope.name || null },
      hostProfile: scope.profile || null,
      metrics,
      properties,
      reservations: trimRes,
      payments: trimPay,
      expenses: trimExp,
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

    const callOpenAI = (body) =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

    const baseBody = {
      model: OPENAI_MODEL,
      messages,
      temperature: 0.2,
      // Newer (gpt-5.x) models require max_completion_tokens; gpt-4o accepts it too.
      max_completion_tokens: 700,
      tools: TOOLS,
      tool_choice: 'auto',
    };

    let oai = await callOpenAI(baseBody);
    if (!oai.ok) {
      const errText = await oai.text();
      // Some models only allow the default temperature — retry once without it.
      if (oai.status === 400 && /temperature/i.test(errText)) {
        const { temperature, ...noTemp } = baseBody;
        oai = await callOpenAI(noTemp);
      }
      if (!oai.ok) {
        const finalErr = oai.ok ? '' : await oai.text().catch(() => errText);
        console.error('[ai-chat] OpenAI error:', oai.status, finalErr || errText);
        return res.status(502).json({ error: 'AI service error' });
      }
    }
    const out = await oai.json();
    const msg = out.choices?.[0]?.message;

    // The model proposed an action → return it for the app to confirm + execute.
    const toolCall = msg?.tool_calls?.[0];
    if (toolCall) {
      let args = {};
      try {
        args = JSON.parse(toolCall.function?.arguments || '{}');
      } catch (_) {
        args = {};
      }
      const type = toolCall.function?.name;
      const answer = (msg.content && msg.content.trim()) || actionConfirm(type, args);
      return res.status(200).json({ answer, action: { type, args } });
    }

    const answer = msg?.content?.trim() || "I couldn't generate an answer.";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error('[ai-chat] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
