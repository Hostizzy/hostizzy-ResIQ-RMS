# Android / Flutter app — required updates

Backend changes landed on `claude/review-app-improvements-3dS1J`. This is what
the Flutter app needs to do about them.

The Flutter app talks to Postgres directly through `supabase_flutter` using the
JWT from `/api/auth-exchange`, so it does **not** go through `/api/db-proxy`.
That means schema and RLS changes reach it immediately — including the ones that
can now reject a write.

---

## TL;DR — what breaks if you do nothing

| Change | Effect on the app today |
|---|---|
| Double-booking trigger | **Saving a clashing reservation now throws.** Without handling, the user sees a generic failure or a crash instead of a usable message. |
| `reservations.room_id` | Bookings save with `room_id` NULL, i.e. "whole property". Correct for whole-place properties, wrong for a homestay sold by room. |
| `push-fcm` action rename | If the app calls `action: "send"`, it now 400s. Verify before shipping. |

Item 1 is the urgent one. The other two degrade quietly; that one surfaces to
users as a broken save.

---

## 1. Handle the double-booking rejection — required

There was previously **no** overlap check anywhere. There is now, enforced in the
database so every client obeys it.

The rule:

```
whole-property booking  conflicts with  every room, and every other whole booking
room booking            conflicts with  the same room, and any whole booking
room A                  does NOT conflict with  room B
```

Dates are half-open `[check_in, check_out)`, so one guest's checkout day is the
next guest's check-in day — back-to-back bookings are fine.

The trigger raises SQLSTATE **`23P01`** (`exclusion_violation`) with a message
already written for a human:

> Those dates are already taken. Ravi Menon has the Garden Room from 12 Jul to 15 Jul.

Surface that message as-is. Don't wrap it in "Error:" or replace it with
something generic — it names the guest, the room and the dates, which is exactly
what the person needs to resolve it.

```dart
try {
  await supabase.from('reservations').insert(payload);
} on PostgrestException catch (e) {
  if (e.code == '23P01') {
    // Already user-facing. Show it verbatim.
    showMessage(e.message, severity: Severity.warning);
    return;
  }
  rethrow;
}
```

Same handling on update — the trigger fires on `INSERT` and on `UPDATE` of
`check_in`, `check_out`, `room_id`, `property_id` or `status`.

**Please verify** that `supabase_flutter` maps the SQLSTATE onto
`PostgrestException.code` in the version you're on. If it doesn't, fall back to
matching the message, which starts with a stable prefix:

```dart
final isClash = e.code == '23P01' || e.message.startsWith('Those dates are already taken');
```

### Two exemptions, so you don't chase phantom bugs

- **Cancelled bookings never conflict.** Setting `status = 'cancelled'` always
  succeeds.
- **OTA-sourced rows are exempt.** Anything with `ical_uid` set skips the check.
  A channel calendar is a statement of fact; refusing an Airbnb booking would put
  the app out of step with reality and silently break sync. If the app writes
  imported bookings, keep populating `ical_uid` or it will start hitting the
  guard.

---

## 2. Rooms — required if you support homestays

New optional `rooms` table. A property with no rooms is sold whole, exactly as
before, so **existing behaviour is unchanged** until an owner adds rooms.

```sql
rooms (
  id BIGSERIAL, property_id INT, name TEXT, capacity INT,
  base_rate NUMERIC, sort_order INT, is_active BOOLEAN,
  ical_url TEXT, ical_feed_token TEXT
)
```

And one new column on reservations:

```
reservations.room_id  BIGINT NULL
    NULL      → books the WHOLE property
    <room id> → books that room only
```

Every existing row is NULL, which already means whole property. No backfill.

### What the app needs

1. Add `roomId` to the Reservation model, nullable, and send it on create/update.
2. In the booking form, load rooms for the selected property. **Hide the picker
   entirely when there are none** — most properties are whole-place and shouldn't
   see the field.

```dart
final rooms = await supabase
    .from('rooms')
    .select()
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .order('sort_order');

// rooms.isEmpty → whole-place property, no picker
```

3. Show which room a booking is on wherever bookings are listed. A NULL `room_id`
   on a property that *has* rooms means "the whole place", not "unassigned" —
   label it accordingly or it reads as a data error.

### Tenant isolation — you get this for free, the web app doesn't

Worth understanding, because the two clients have **opposite** security models
and it's an easy thing to get wrong later.

| | How it reaches Postgres | What enforces isolation |
|---|---|---|
| **Flutter app** | `supabase_flutter` with the user's JWT from `/api/auth-exchange` | **RLS**, enforced by Postgres |
| **Web app** | `/api/db-proxy` using the **service-role key** | Hand-written scoping in `js/db.js` — RLS is bypassed |

The `rooms` policies read your existing claims:

```sql
user_type IN ('admin','staff')
OR EXISTS (SELECT 1 FROM properties p
            WHERE p.id = rooms.property_id
              AND p.owner_id::text = <owner_id claim>)
```

`auth-exchange` already puts `user_type` and `owner_id` in the token, so **an
owner can only ever see and write rooms under their own properties, and you need
no client-side filtering to achieve it.** Query `rooms` freely.

Two things follow from this:

- **Don't replicate the web app's filtering.** `js/db.js` restricts `rooms` by
  `_ownerPropertyIds` only because the proxy bypasses RLS. Copying that into Dart
  would be redundant, and a second copy of an authorisation rule is a liability —
  it drifts.
- **If you ever add a server endpoint that uses the service-role key**, you
  inherit the web app's problem: RLS stops applying and you must scope by hand.
  This exact trap produced a cross-tenant leak in the web app (one owner's
  browser received every other owner's rooms) — fixed in
  `test/rooms-scoping.test.js`, worth reading as a cautionary example.

Please verify rather than trust the above: sign in as two different owner
accounts and confirm each sees only their own rooms. If RLS is somehow not
applying, that's a much bigger problem than rooms and worth knowing immediately.

### Availability helper

Rather than reimplementing the parent/child rule, call the function that already
encodes it:

```dart
final rows = await supabase.rpc('resiq_availability', params: {
  'p_property_id': propertyId,
  'p_check_in':   '2026-07-12',
  'p_check_out':  '2026-07-15',
});
// [{room_id: null, room_name: 'Whole property', is_available: true},
//  {room_id: 10,   room_name: 'Garden Room',    is_available: false}, ...]
```

Filter to `is_available == true` to populate the picker. This keeps one
definition of the rule; duplicating it in Dart is how the two drift apart.

---

## 3. Push notifications — check for a breaking change

`/api/push-fcm` was rewritten. Actions are now:

| Action | Auth | Body |
|---|---|---|
| `register` | `Bearer <firebase id token>` | `{ token, platform?, deviceInfo? }` |
| `unregister` | `Bearer <firebase id token>` | `{ token }` |
| `broadcast` | `Bearer <CRON_SECRET>` | `{ title, body, route?, data?, role? }` |

**The old `send` action no longer exists.** No web code called it, but if the
Flutter app did, it now returns 400. Please check.

Two things to add if they aren't there already:

```dart
// On login, and on every token refresh
FirebaseMessaging.instance.onTokenRefresh.listen(registerFcmToken);

// On logout — otherwise the device keeps receiving the previous user's pushes
await http.post(uri, body: jsonEncode({'action': 'unregister', 'token': fcmToken}));
```

Registration now also stores the caller's role, so broadcasts can target staff or
owners separately. Nothing to do for that beyond registering.

`sql/fcm-tokens-table.sql` must be applied — it adds `role`, `device_info` and
`last_used_at`.

---

## 4. Optional — channel calendar feeds

Each property and each room can publish an iCal feed that Airbnb and Booking.com
subscribe to:

```
GET https://resiq.hostizzy.com/api/ical-feed?t=<token>
```

Tokens live on `properties.ical_feed_token` and `rooms.ical_feed_token`, minted
on demand. If you want this in the app, generate a token, build the URL and offer
copy/share. The web app does this under Property → Rooms → Channel sync.

Worth setting expectations in the UI: channels poll every few hours, so this
reduces double bookings rather than eliminating them, and only Airbnb,
Booking.com and VRBO import iCal — MakeMyTrip and Goibibo remain one-way.

---

## 5. Deployment order

The database changes are backward compatible, so the sequence is forgiving —
but the conflict guard goes live the moment its migration runs, for **all**
clients including app versions already in the wild.

1. `sql/round5-ical-schema.sql` — prerequisite, likely already applied
2. `sql/rooms-and-conflict-guard.sql` — rooms + the guard ← *guard becomes live here*
3. `sql/ical-feed-tokens.sql` — only if you want channel feeds
4. `sql/fcm-tokens-table.sql` — safe to re-run
5. Deploy web
6. Ship the app update

Between steps 2 and 6, older app builds will hit the guard without handling it
and show a generic error on clashing saves. If that gap is long, consider
shipping the error handling (section 1) ahead of the rooms work.

### Before step 2, clear existing overlaps

The trigger only fires on new writes, so bookings that already overlap sit there
silently — until someone edits one and gets rejected, which looks like a bug.

```sql
SELECT a.property_id, a.booking_id, a.guest_name, b.booking_id, b.guest_name,
       a.check_in, a.check_out
  FROM reservations a
  JOIN reservations b ON a.property_id = b.property_id AND a.id < b.id
   AND daterange(a.check_in::date, a.check_out::date, '[)')
    && daterange(b.check_in::date, b.check_out::date, '[)')
 WHERE COALESCE(a.status,'') <> 'cancelled'
   AND COALESCE(b.status,'') <> 'cancelled'
   AND (a.room_id IS NULL OR b.room_id IS NULL OR a.room_id = b.room_id);
```

---

## 6. Test checklist

Conflict guard:

- [ ] Two overlapping bookings on a whole-place property → second rejected, message names the first guest
- [ ] Back-to-back bookings (checkout 15th, check-in 15th) → **both succeed**
- [ ] Cancelling one of a clashing pair → succeeds
- [ ] Editing a booking's dates onto an occupied range → rejected
- [ ] A booking with `ical_uid` set that overlaps → **accepted** (exempt by design)

Tenant isolation (do this first — it validates RLS, not just rooms):

- [ ] Sign in as owner A, note the rooms visible
- [ ] Sign in as owner B → sees only their own rooms, none of A's
- [ ] Attempt to read a room belonging to A while signed in as B → returns nothing
- [ ] Attempt to write a room onto A's property while signed in as B → rejected

Rooms:

- [ ] Property with no rooms → picker hidden, saves with `room_id` NULL, behaves as before
- [ ] Two rooms, book room A → room B still bookable for the same dates
- [ ] Book the whole property → both rooms blocked
- [ ] Book any room → whole-property option blocked
- [ ] Booking list shows room name, and NULL reads as "Whole property" not "none"

Push:

- [ ] Register on login, re-register on token refresh
- [ ] Unregister on logout, and confirm pushes stop
- [ ] No call anywhere to the removed `send` action

---

## Reference

| Path | What |
|---|---|
| `sql/rooms-and-conflict-guard.sql` | Rooms table, `room_id`, trigger, `resiq_availability()` |
| `sql/ical-feed-tokens.sql` | `properties.ical_feed_token` |
| `api/ical-feed.js` | Outbound calendar feed |
| `api/push-fcm.js` | register / unregister / broadcast |
| `test/ical-feed.test.js` | Feed format, round-tripped through the app's own parser |
| `js/properties.js` | Rooms manager — reference for the equivalent Flutter screen |
| `test/rooms-scoping.test.js` | Why the web app scopes rooms by hand, and what it guards against |

Questions: whoever picks this up should read the header comment in
`sql/rooms-and-conflict-guard.sql` first. The reasoning behind the model and the
two trigger exemptions is written out there.


---

# Round 2 — changes since the above

Everything above still stands. These are additional, and several are things
that will silently show a user the wrong number rather than throw.

## Already live in production — check these first

**1. `anon` can no longer read anything.** Every table carried a legacy
`USING (true)` policy for `{anon}`/`{public}`; those are dropped and
`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon` has been run.

You are unaffected **if and only if** every Supabase call happens after
`/api/auth-exchange` has returned a JWT. `supabase_flutter` sends
`apikey: <anon key>` plus `Authorization: Bearer <jwt>`, and PostgREST takes
the session role from the JWT — so an authenticated call still acts as
`authenticated`. Any call made *before* the exchange, or after the token
expires, now returns `permission denied` instead of data.

Do one login-to-first-screen pass and confirm nothing queries early. This is
the most likely thing to break.

**2. Token expiry now fails loudly.** The JWT is 1 hour. An expired token
used to fall back to anon and still return rows. It doesn't any more.

## Booking status values

The app writes exactly these:

    confirmed · pending · checked-in · checked-out · cancelled

Hyphens. There is no `checked_in` and no `completed`. If the Flutter app has
`['confirmed', 'checked_in', 'completed']` anywhere — that was the web app's
owner-earnings filter — it matches only bookings that have not started, and
any payout figure derived from it reads zero.

One exception: `payout_requests.status` genuinely does include `completed`.
Different table, different lifecycle, leave it alone.

## Owner → property linkage

`properties.owner_id` is the single source of truth. It is what
`auth-exchange` puts in the JWT and what all 37 `jwt_*` RLS policies read.

`property_owners.property_ids` is a deprecated mirror that had drifted badly
— for a long time it was the *only* thing written, so owners appeared to
have properties in the staff table and saw nothing anywhere else. Do not
read it.

`reservations.owner_id` exists as a column and is **never populated**. Do not
filter on it; resolve through `property_id`.

## account_type

Values are `'managed'` and `'host'`. If anything sends `'independent'`, that
was an old web-form vocabulary and no longer matches.

Read `account_type` with a fallback to `is_external` for older rows.
`is_external` is deprecated and trigger-synced.

## Adding an owner creates a Firebase login

Team → Add Owner now creates the Firebase account as well as the row.
Authentication is Firebase-only — `property_owners.password` is never
compared to anything and now stores a placeholder. If the app has an
add-owner or add-caretaker flow, it must create the Firebase identity too or
the person cannot sign in.

## Design system

The web app moved onto the marketing site's palette and type:

| | |
|---|---|
| Structure | navy `#1B3A5C` |
| Accent | amber `#F0932B` — dark text on it, never white (2.4:1) |
| Data/system | cyan `#17A2C4` |
| Grounds | cool mist `#F7F9FB` / `#EDF2F6`, never cream |
| Type | Archivo (display) · IBM Plex Sans (body) · IBM Plex Mono (figures, tabular) |

Teal `#0891b2` is gone entirely. Worth matching before the next Play Store
screenshots, or the app and the site will look like different products.

## Known bug, not yet fixed

Property occupancy is computed as `nights / 365` with no room awareness. On a
four-room homestay that reports ~99% when the real figure is ~25%. If the app
shows occupancy anywhere, it almost certainly has the same bug. The correct
denominator is `365 × room_count`, and a whole-property booking counts as
`nights × room_count`.

## Unsettled — do not build against these yet

- **The money model** for online reservations. Guest-paid and owner payout
  differ by GST registration, and the web app currently has three conflicting
  payout formulas. Being resolved.
- **Inbound per-room iCal.** `rooms.ical_url` exists as a stub; nothing reads
  or writes it and `synced_availability` has no `room_id`. Outbound per-room
  feeds *are* built and working.

---

# Round 3 — tenant boundary, now enforced in the database

Rounds 1 and 2 still stand. Everything below is **already applied to the
production database**, so it is live for the app right now, whether or not the
app has shipped anything.

The theme: Hostizzy staff and self-signup hosts used to see each other's data.
That is closed — on tables, on views, and on the three policies that were still
`USING (true)`. The app is the path where RLS is the only defence, so these
changes land on you directly.

## 1. Re-login is required — read this first

`resiq_is_super_admin()` used to read `user_type = 'admin'`, and
`/api/auth-exchange` derives `user_type` from the team member's **role**:

    userType = profile.role === 'admin' ? 'admin' : 'staff'

So every `role='admin'` team member was treated as a super admin and could read
every host's data. Super admin is now a separate flag —
`team_members.is_super_admin` — and the helper reads a new JWT claim instead.

**A JWT minted before this has no `is_super_admin` claim and now resolves to
`false`.** That is deliberate fail-closed behaviour, but it means:

- Anyone signed in on an old token silently loses super-admin reach.
- The fix is to sign out and back in; `auth-exchange` mints the claim now.
- If a support screen suddenly looks empty, this is why. It is not a bug.

New claims, top level and inside `app_metadata`:

    { "user_type": "staff", "is_super_admin": true, "owner_id": null, ... }

If the app caches the decoded JWT anywhere, invalidate that cache on this
release.

## 2. Row counts will legitimately drop

These policies now call `resiq_is_super_admin()` and scope by tenant:

    reservations · properties · payments · property_owners
    enquiries · communications · revenue_targets

For ordinary staff, "everything" now means **Hostizzy's own book** — properties
that are unowned or belong to a managed owner. A self-signup host's bookings,
guests and payments are gone from those queries.

If the app has a staff or admin screen that showed all reservations, it now
shows fewer, and that is correct. Do not "fix" it by widening a query.

`enquiries`, `communications` and `revenue_targets` were `USING (true)` until
now — any logged-in user read every tenant's rows. If the app reads them,
expect counts to fall.

**`revenue_targets` is Hostizzy-internal.** A host or owner now gets **zero
rows, not an error**. If the app renders a target with no null-guard, it will
show 0 or divide by zero rather than throw.

## 3. Unassigned records belong to Hostizzy

Two cases that are deliberately *not* orphaned into invisibility:

- an `enquiries` row with `property_id IS NULL` — an unassigned lead off the
  marketing site
- a `communications` row whose `booking_id` matches no reservation

Both stay visible to Hostizzy staff and are hidden from hosts. If the app has
an inbox, this is the rule it should mirror.

## 4. Views no longer bypass RLS

`payment_summary`, `daily_collections`, `revenue_report` and
`reservation_document_status` ran with their **owner's** rights, so RLS on the
base tables did nothing. A logged-in host could read the whole database through
them — 1134 rows of `payment_summary`, 1098 of `reservation_document_status`.

All four now have `security_invoker = on` and return only the caller's tenant.

Two consequences if the app touches them:

- Any total built from these views changes. It was wrong before, not now.
- A `security_invoker` view needs the **caller** to hold `SELECT` on the base
  tables. If a future grant is tightened, these fail closed with a permission
  error rather than returning rows — so handle the error path.

## 5. `property_ids` is now consistent — still do not read it

The deprecated `property_owners.property_ids` mirror has been backfilled, so it
currently agrees with `properties.owner_id`.

This is a trap, not a green light. It agrees *today*; nothing guarantees it
tomorrow, and three owners were silently broken by exactly this drift. Resolve
through `properties.owner_id`, as Round 2 said.

## 6. Verifying your side

`sql/verify.sql` is the standing harness — run it after any schema change. The
relevant lines for the app:

    RLS  · super admin helper reads the flag, not the role
    RLS  · the booking-existence helper is SECURITY DEFINER
    RLS  · reservations policy applies the host boundary
    RLS  · no unscoped authenticated policies
    HOST JWT · sees exactly their own properties / reservations / team members
    VIEWS · view <name> does not bypass RLS

The `HOST JWT` block simulates exactly what `auth-exchange` mints for a host,
so it tests your path, not the web app's.

## Still unsettled — unchanged from Round 2

- **The money model** for online reservations. Still three conflicting payout
  formulas. Do not build against it.
- **Inbound per-room iCal.** Still a stub.
- **Occupancy is still `nights / 365`**, room-blind. The calendar and
  reservation list are room-aware; the occupancy metric is not.
