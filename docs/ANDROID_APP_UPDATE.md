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

RLS on `rooms` inherits the parent property's owner via your existing JWT claims
(`user_type`, `owner_id`), so no auth work is needed.

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

Questions: whoever picks this up should read the header comment in
`sql/rooms-and-conflict-guard.sql` first. The reasoning behind the model and the
two trigger exemptions is written out there.
