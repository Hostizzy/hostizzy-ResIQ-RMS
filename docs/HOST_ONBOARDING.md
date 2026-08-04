# Host onboarding

How a self-signup **Host** goes from the landing page to a working ResIQ
account with properties, rooms and calendar sync.

**Host** = someone who found ResIQ themselves and runs their own property.
**Managed Owner** = a Hostizzy-operated property; they use `/owner-portal` and
are created by the Hostizzy team, not by signing up.

This document has two halves: the steps a host takes, and the steps our team
takes. The account is unusable until both halves are done, because signup is
approval-gated.

---

## The path, end to end

| # | Who | Where | What happens |
|---|---|---|---|
| 1 | Host | `resiq.hostizzy.com/#signup` | Fills name, email, phone, password |
| 2 | System | — | Firebase account created; `property_owners` row inserted with `account_type='host'`, `status='pending'`, `is_active=false` |
| 3 | System | Email | Hostizzy team is notified that someone is waiting |
| 4 | **Hostizzy** | App → **Hosts** | Reviews and approves |
| 5 | System | Email | Host is told they're in |
| 6 | Host | `resiq.hostizzy.com/app` | Logs in |
| 7 | Host | **Properties → Add Property** | Adds their first property |
| 8 | Host | **Rooms** (optional) | Adds rooms if they sell by the room |
| 9 | Host | Property → **Settings** | Pastes their Airbnb/Booking.com calendar link |
| 10 | Host | **Team** (optional) | Adds a caretaker |

Between steps 2 and 5 the host cannot log in. If they try, they get the
"Account Pending" screen rather than a failed login — so the wait is explained,
not mysterious. A rejected host gets a distinct screen too.

---

# Part 1 — For the host

Everything below is written to be copied into a welcome email or help page.

## 1. Create your account

Go to **resiq.hostizzy.com** and click **Start free**. You need a name, an
email and a password of at least 8 characters. Phone is optional but worth
adding — it's how we reach you if something looks wrong with a booking.

No card. Your first property is free permanently.

## 2. Wait for approval

We check every signup by hand, usually the same day. You'll get an email the
moment your account is open. Until then, logging in shows an "Account Pending"
screen rather than an error.

## 3. Add your first property

Log in at **resiq.hostizzy.com/app**. Go to **Properties → Add Property**, or
tap the **Add Property** tile on the home screen.

| Field | Notes |
|---|---|
| **Property name** | Required. What you call it — "Sunbird Villa" |
| **Location** | Required. Town or area is enough — "Kasauli, HP" |
| **Type** | Villa, apartment, homestay or resort |
| **Capacity** | Total guests the place sleeps |
| **How do you rent this out?** | See below — this one matters |

**"How do you rent this out?"** is the question worth pausing on:

- **As one whole place** — one group books the entire property. Most villas.
- **Individual rooms** — you sell rooms separately to different guests.
  Homestays and guesthouses.

Pick *Individual rooms* and ResIQ takes you straight to the room setup screen
after saving. You can still sell the whole place to one group when someone
wants to book it all — that's handled, and it's common.

If you get this wrong, it isn't permanent. Open the property's **Settings** and
use **Manage rooms** to change it later.

## 4. Add your rooms (only if you sell by the room)

Each room needs a **name**, how many it **sleeps**, and a **rate per night**.
Add them one at a time — "Garden Room, sleeps 2, ₹3,500".

Once rooms exist, every booking asks which room it's for. Leaving that blank
means "the whole property", which blocks all rooms for those dates.

ResIQ refuses to save a booking that clashes with one already in the system —
same room, or a whole-property booking over a room booking, or the other way
round. You get a message naming the guest who already has those dates rather
than a silent overwrite.

## 5. Connect your Airbnb or Booking.com calendar

Two separate things, and you'll usually want both:

**Bringing bookings in.** Open the property → **Settings** → paste your
channel's iCal export link into **iCal Sync URL**. In Airbnb this is under
Calendar → Availability → Connect calendars → Export calendar.

**Sending your availability out.** Open **Rooms** for the property and expand
**Channel sync**. Copy the link shown there and paste it into the channel's
*Import calendar* setting.

Calendars refresh every few hours on the channel's schedule, not ours. This
cuts double bookings substantially; it can't eliminate them. Two guests booking
the same dates on two different channels within the same hour is a gap no iCal
sync closes, ours included.

## 6. Add a caretaker (optional)

**Team → Add Team Member.** Give them a name, email and password, pick
**Caretaker**, and share the login.

A caretaker sees only your properties — your bookings, guests and payments,
nothing from any other host. They can't add or remove other people.

## 7. Start taking bookings

Either import what's already on your channel calendar (step 5 pulls it in), or
just enter this week's guests by hand and go from there. Most people do the
second and let the sync catch up.

---

# Part 2 — For the Hostizzy team

## Approving a signup

Open the app → **Hosts** in the sidebar. New signups land in the **Waiting**
tab, and the sidebar carries a badge with the count.

Before approving, check:

- **The email is real and reachable.** The approval mail goes there, and it's
  the account's only recovery path.
- **They're an owner, not a property manager.** ResIQ is positioned for people
  with one or two properties of their own. A manager with a portfolio is a
  different product and shouldn't be approved here.
- **They aren't an existing Managed Owner.** A Hostizzy-operated owner who
  signs up on the landing page would end up with two accounts and split data.
  Reject and point them at `/owner-portal`.

Approving flips `status` to `approved` and `is_active` to `true`, and sends the
welcome email. Rejecting shows them the rejected screen on their next login
attempt.

## Where the notifications go

Both the "someone signed up" alert and the approval mail use the same address
as the daily summary, resolved in this order:

```
SIGNUP_NOTIFY_EMAIL → DAILY_SUMMARY_EMAIL → STAY_EMAIL_RECIPIENT → support@hostizzy.com
```

Set `SIGNUP_NOTIFY_EMAIL` only if signup alerts should go somewhere other than
the daily summary inbox.

## What a host can and can't reach

Hidden from hosts: **Managed Owners**, **Hosts**, **OTA Import**,
**Performance**. Everything else — Reservations, Payments, Guests, Documents,
Meals, Expenses, P&L, Enquiries, Properties, Team, Availability,
Communication, Settings — is visible and scoped to their own properties.

Scoping is enforced in `js/db.js`, which stamps every query with the caller's
`owner_id` / property IDs and denies by default before login completes.
`test/rooms-scoping.test.js` and `test/team-scoping.test.js` pin this down.

## Known gaps

- **The free-plan limit is not enforced.** `host_profiles.max_properties`
  defaults to 1, but nothing checks it — a host can add as many properties as
  they like today. Needs a check in `saveProperty()` before this can be sold as
  a paid tier.
- **Property IDs are allocated client-side** as `max(id)+1`. Concurrent creates
  now retry on the resulting key conflict rather than erroring, but the right
  fix is an identity column on `properties.id`.
- **Two-way sync and the WhatsApp inbox are not built.** Inbound iCal import
  and outbound feed are both live; they are two separate one-way links, not a
  synchronised pair. Don't describe it as two-way to a host.
- **Approval is manual and unbatched.** Fine at launch volume; it's the first
  thing to automate if signups pick up.

## Pending database migrations

These must be applied before host onboarding is fully functional:

```
sql/owner-notification-flags.sql          -- signup/approval email idempotency
sql/account-type-and-host-profiles.sql    -- account_type, host_profiles
```

Both are additive and safe to run at any time. `sql/rooms-and-conflict-guard.sql`
and `sql/ical-feed-tokens.sql` are already applied.
