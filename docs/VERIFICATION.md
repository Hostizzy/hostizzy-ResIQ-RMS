# Verifying a change

Run these after anything that touches data access, auth, or the tenant
boundary. Two are automated and take seconds; the third is manual and only
needed when the UI changed.

They check **different layers and do not substitute for each other**. That's
the whole point of having three.

| | What it actually tests | When |
|---|---|---|
| `npm test` | Client-side scoping in `js/db.js` | Every change |
| `sql/verify.sql` | RLS, grants, the tenant boundary, data integrity | Every change touching the database or auth |
| `sql/create-test-host.sql` checklist | The two clients end to end | Before a release |

---

## 1. `npm test`

```
npm test
```

Node's built-in runner over `test/*.test.js`. Currently five files:

| File | Covers |
|---|---|
| `rooms-scoping.test.js` | A host can only reach their own properties' rooms |
| `team-scoping.test.js` | Caretaker read/write/delete, and the owner directory |
| `ical-feed.test.js` | The outbound feed, round-tripped through our own parser |
| `ical-parser.test.js` | Inbound OTA calendar parsing |
| `owner-notify.test.js` | Signup and approval notifications |

The scoping tests load the real `js/db.js` into a sandbox with a fake Supabase,
so they test the shipped code rather than a copy of its logic. If you add a
method to `db` that reads or writes tenant data, add a case there.

**These prove nothing about the database.** The web app reaches Postgres through
`/api/db-proxy` using the service-role key, which bypasses RLS entirely — so
`js/db.js` is the *only* thing scoping a web session. That makes these tests
important, and also makes them blind to everything in layer 2.

## 2. `sql/verify.sql`

Paste the whole file into the Supabase SQL editor and run it. One result set,
failures first.

Read-only: every role switch is undone, every simulated identity cleared,
nothing written but a temporary scratch table.

It checks:

- **RLS is enabled** on the core tables — a policy on a table without RLS does
  nothing at all
- **No unrestricted `anon`/`public` policies**. `{public}` in `pg_policies`
  means *every* role including anon, so a policy named "Authenticated users
  can…" with `roles={public}` is not authenticated-only
- **`anon` holds no table grants** — RLS sits on top of grants, and a missing
  grant is harder to undo by accident than a policy
- **What a stranger can actually read.** `SET LOCAL ROLE anon` puts the session
  in the position of someone who fetched the key from `/api/config` and is
  querying PostgREST directly. Non-zero counts here mean public exposure
- **Whether a host's JWT stays in its own tenant**, by reproducing the claims
  `/api/auth-exchange` mints. This is the Android app's path and the only one
  where RLS applies
- **No plaintext passwords** in `team_members` or `property_owners`
- **The `properties` id sequence is ahead of the data**, or inserts that omit
  `id` fail
- **No pre-existing double bookings** that the conflict trigger would now reject
- **Which migrations have been applied** — the closest thing to a
  `schema_migrations` table until there is one

`WARN` means it won't break today but is a real gap — currently the
`USING (true)` policies on `communications`, `enquiries` and `revenue_targets`,
which let any logged-in user read every tenant's rows.

`SKIP` usually means a table or a test host doesn't exist yet.

## 3. The manual checklist

`sql/create-test-host.sql` creates a loginable host with one room-based
property, and carries a checklist for both clients. Firebase holds the
credential, so there's a console step first — the file explains it.

Worth doing before a release, and any time the login flow, the sidebar, or the
property form changes.

**The two clients prove different things:**

- **Web app** → `js/db.js` scoping, over a service-role connection where RLS is
  bypassed
- **Android app** → the RLS policies, using the host's own JWT

A pass on one says nothing about the other. Neither exercises the `anon` path,
because neither uses the anon key — only `sql/verify.sql` covers that.

---

## Why layering it this way

Every scoping guarantee in the web app is JavaScript we wrote, running over a
connection that has full database access. That's a legitimate design — the
proxy exists because Indian ISPs block direct Supabase connections — but it
means the app being correct and the database being safe are independent facts.

Testing through the UI can only ever establish the first. Signing out and
seeing nothing, or logging in as an owner and seeing only your own data, tells
you our code is doing its job. It tells you nothing about what someone who
isn't running our code can reach.

Layer 2 is the one that answers that, and it's the one a UI test can never
replace.

## Not covered

- The build (`node scripts/build.js`) does not run tests. Nothing stops a
  failing suite from deploying.
- No CI. These are run by hand.
- Server endpoints under `api/` have no automated tests beyond
  `owner-notify.test.js`.
