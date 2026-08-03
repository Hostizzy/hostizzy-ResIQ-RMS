process.env.SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
process.env.FIREBASE_API_KEY = 'fk';
process.env.SIGNUP_NOTIFY_EMAIL = 'ops@hostizzy.com';

let OWNER = null, STAFF = [], sent = [], patched = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('property_owners') && (init.method || 'GET') === 'GET')
    return new Response(JSON.stringify(OWNER ? [OWNER] : []), { status: 200 });
  if (u.includes('property_owners') && init.method === 'PATCH') {
    patched.push(JSON.parse(init.body)); return new Response('', { status: 204 });
  }
  if (u.includes('team_members'))
    return new Response(JSON.stringify(STAFF), { status: 200 });
  if (u.includes('identitytoolkit'))
    return new Response(JSON.stringify({ users: [{ email: 'admin@hostizzy.com' }] }), { status: 200 });
  if (u.includes('gmail_tokens') || u.includes('rest/v1/'))
    return new Response(JSON.stringify([]), { status: 200 });   // no Gmail connected
  return new Response('{}', { status: 200 });
};

const { default: handler } = await import(new URL('../api/owner-notify.js', import.meta.url));

function mkRes() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k,v) => { r.headers[k]=v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
const call = async (body, headers = {}) => {
  const res = mkRes();
  await handler({ method:'POST', headers, body }, res);
  return res;
};

let fails = 0;
const t = (label, cond) => { if (!cond) fails++; console.log(`${cond?'✓':'✗ FAIL'}  ${label}`); };

// ── signup guards ──
OWNER = { id:'o1', name:'A', email:'a@x.com', status:'approved', signup_notified_at:null };
t('signup refuses when the owner is not pending',
  (await call({action:'signup', ownerId:'o1'})).body?.reason === 'not-pending');

OWNER = { id:'o1', name:'A', email:'a@x.com', status:'pending', signup_notified_at:'2026-01-01' };
t('signup refuses a second time (no inbox flooding)',
  (await call({action:'signup', ownerId:'o1'})).body?.reason === 'already-notified');

OWNER = null;
t('unknown owner → 404', (await call({action:'signup', ownerId:'nope'})).code === 404);

// ── approved guards ──
OWNER = { id:'o1', name:'A', email:'a@x.com', status:'approved', approved_notified_at:null };
t('approved without a token → 401', (await call({action:'approved', ownerId:'o1'})).code === 401);

STAFF = [];   // caller is not staff
t('approved by a non-staff caller → 403',
  (await call({action:'approved', ownerId:'o1'}, {authorization:'Bearer x'})).code === 403);

STAFF = [{ role:'admin' }];
OWNER = { id:'o1', name:'A', email:'a@x.com', status:'pending', approved_notified_at:null };
t('approved refuses if the owner is not actually approved',
  (await call({action:'approved', ownerId:'o1'}, {authorization:'Bearer x'})).code === 409);

// ── misc ──
t('unknown action → 400', (await call({action:'nonsense', ownerId:'o1'})).code === 400);
t('missing ownerId → 400', (await call({action:'signup'})).code === 400);

// ── no Gmail connected must not look like signup failed ──
STAFF = [{ role:'admin' }];
OWNER = { id:'o1', name:'A', email:'a@x.com', status:'pending', signup_notified_at:null };
const r = await call({action:'signup', ownerId:'o1'});
t('no Gmail connected → 200 with a reason, not an error', r.code === 200 && r.body?.sent === false);
t('nothing marked as notified when nothing was sent', patched.length === 0);

globalThis.fetch = realFetch;
console.log(fails ? `\n${fails} FAILED` : '\nall guard assertions passed');
process.exit(fails ? 1 : 0);
