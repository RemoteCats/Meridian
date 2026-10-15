# Backend setup: what you need

Everything the site needs from you, in the order it is needed, with what
happens if you stop at each step. Two accounts, nine values, two SQL files.
Budget about forty minutes, most of it waiting for a DNS record.

Run `npm run check:backend` at any point. It reads your `.env` the way the
server does, checks the project, the tables, the admin account, anonymous
sign-ins and the sending domain, and prints what is still missing with the
exact thing to do about it. Nothing below has to be remembered.

---

## The short list

| # | What | Where it comes from | Without it |
| - | ---- | ------------------- | ---------- |
| 1 | A Supabase project | [supabase.com](https://supabase.com) — free tier is enough | Enquiries, applications and chat are written to local files that do not survive a deploy |
| 2 | `SUPABASE_URL` | Supabase → Project Settings → Data API | — |
| 3 | `SUPABASE_ANON_KEY` | same page (anon / publishable key) | `/admin` reports the backend as not connected; chat falls back to the server |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API keys | Nothing can be written to the database |
| 5 | The two migrations run | `supabase/migrations/0001_init.sql`, then `0002_email.sql` | Every insert is rejected |
| 6 | One admin login | Supabase → Authentication → Users, then `supabase/grant-admin.sql` | Nobody can sign in to `/admin` |
| 7 | Anonymous sign-ins on | Supabase → Authentication → Sign In / Providers | Optional. Chat still works, one hop further away |
| 8 | A Resend account and `RESEND_API_KEY` | [resend.com](https://resend.com) | Optional. Enquiries are still stored and still shown on `/admin`; no email is sent |
| 9 | A verified sending domain | Resend → Domains (one DNS record set) | Every send returns 403 |
| 10 | `FORM_TO`, `FORM_FROM` | your own addresses | Notifications have nowhere to go, or no sender |
| 11 | `MAILBOX_ADDRESS`, `RESEND_WEBHOOK_SECRET` | Resend → Webhooks | Optional. The studio inbox on `/admin` stays empty |

Nothing here is secret except items 4, 8 and 11. The anon key is public by
design: row level security protects the data, not the secrecy of that key.

---

## 1. Supabase

1. Create a project. Any region close to your visitors; note the database
   password somewhere safe, though the site never uses it.
2. **Project Settings → Data API** gives you the project URL.
   **Project Settings → API keys** gives you the anon (or publishable) key and
   the `service_role` key.
3. **SQL Editor → New query**: paste `supabase/migrations/0001_init.sql`, run
   it, then do the same with `0002_email.sql`. They are idempotent — running
   either one twice is harmless.
4. **Authentication → Users → Add user**, with *Auto Confirm User* ticked.
   This is the login you will use on `/admin`.
5. Open `supabase/grant-admin.sql`, change the one marked line to that
   address, and run the whole file in the SQL Editor. It refuses rather than
   half-works if the user does not exist yet.
6. **Authentication → Sign In / Providers → Anonymous sign-ins**: turn on.
   This lets the chat widget talk to the database directly, so a visitor sees
   a reply without reloading. Leave it off and the chat routes through the
   server instead; everything still works and is still stored.

## 2. Resend (optional, but this is how you hear about an enquiry)

1. Create an account and add your domain under **Domains**. Resend gives you
   DNS records; add them at your registrar and wait for the status to go
   green. Sending from an unverified domain returns 403.
2. **API Keys → Create** gives you `RESEND_API_KEY`.
3. Set `FORM_TO` to wherever enquiries should land and `FORM_FROM` to an
   address on the verified domain, as `Meridian Website <website@meridianconstructionltd.com>`.
4. To receive mail as well, point an address at Resend, set
   `MAILBOX_ADDRESS`, add a webhook under **Webhooks** pointing at
   `https://meridianconstructionltd.com/api/inbound/resend`, and copy its `whsec_` signing
   secret into `RESEND_WEBHOOK_SECRET`. Without that secret the endpoint
   refuses every request rather than trusting an unsigned post.
5. `FORWARD_TO` keeps a copy of inbound mail somewhere else. It **must** be a
   mailbox on another domain: pointing it at one of this site's own addresses
   loops mail back into the webhook until the sending quota is gone. The
   check and the webhook both refuse that case.

## 3. Put the values in

Locally, `.env` in the project root — `cp .env.example .env` and fill it in.
The server reads it on start; anything already exported in your shell wins.

```bash
SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

RESEND_API_KEY="re_..."
FORM_TO="studio@meridianconstructionltd.com"
FORM_FROM="Meridian Website <website@meridianconstructionltd.com>"
MAILBOX_ADDRESS="Meridian Constructions <studio@meridianconstructionltd.com>"
RESEND_WEBHOOK_SECRET="whsec_..."
FORWARD_TO=""
STUDIO_NAME="Meridian Constructions"
```

`.env` is git-ignored. Keep it that way: the service role key bypasses every
row level security policy in the project.

On Vercel the same values go in **Settings → Environment Variables**, for
Production *and* Preview. If you connect Vercel's Supabase integration it
injects the three Supabase values under its own names, all of which this
server already accepts — connect it and skip them here.

Nothing needs a `VITE_` or `NEXT_PUBLIC_` prefix. The browser is handed the
URL and anon key at runtime from `/api/public-config`, so a key rotation does
not need a rebuild, and no secret is ever baked into a page.

## Where mail shows up in /admin

The desk has two places mail can land, and they fill from different things.
Most "Resend says it sent, the dashboard shows nothing" comes down to looking
at the wrong one.

| Tab | Fills from | Needs |
| --- | ---------- | ----- |
| **Enquiries** | the contact and careers forms on the site | the database. Resend is not involved — an enquiry is stored whether or not any mail is sent |
| **Email** | mail *received* at `MAILBOX_ADDRESS` and posted to `/api/inbound/resend` | `MAILBOX_ADDRESS`, `RESEND_WEBHOOK_SECRET`, the webhook pointed at your deployed domain, and `0002_email.sql` run |

Notifications the site *sends* — the "New enquiry from…" mail that goes to
`FORM_TO` — are outbound. They appear in your own inbox and in Resend's
Emails log. They are never filed into the Email tab, because nothing received
them: that tab is the studio mailbox, not a sent-items folder.

So if Resend shows mail going out and the Email tab is empty, that is the
system working. If mail is being *received* and the tab is still empty, it is
one of four things, and each one says so:

1. **The webhook is not set up, or its URL is wrong.** Resend's webhook log
   shows no delivery, or a 404.
2. **`RESEND_WEBHOOK_SECRET` is missing or stale.** Every post is refused
   with 401 and `reason` in the body — unsigned requests are never trusted.
   Resend's webhook log shows the 401.
3. **`0002_email.sql` was never run**, or the deployment has no service role
   key. The message is accepted and acknowledged, so Resend reports success,
   and the response body carries `"filed": false` with a `fileError` saying
   which. `GET /api/health?probe=1` warns about the same thing.
4. **`MAILBOX_ADDRESS` does not match who the mail was addressed to.** The
   response says `"ignored": "not_for_mailbox"`.

`GET /api/health?probe=1` on the deployed site answers all of this in one
request: whether Resend accepts the key, which domains are verified, whether
`FORM_FROM` is on one of them, and whether the two email tables are there.

## 4. Check it

```bash
npm run check:backend                  # from a terminal, before or after deploying
npm run check:backend -- --send-test   # and actually send one, to FORM_TO
```

`--send-test` is the one step that proves mail leaves: it posts a real email
through Resend and prints either the message id or Resend's own refusal,
verbatim. A 403 there is almost always the sending domain.

and, against a running server:

```bash
curl -s localhost:3000/api/health?probe=1 | jq
```

`status: "ok"` with an empty `warnings` array means the server can see
everything it needs. `storage: "supabase"` means it is writing to the
database rather than to local files.

Then, end to end: send an enquiry from `/contact`, open `/admin`, sign in
with the admin login, and check the enquiry is there. Start a chat from the
widget on another browser and answer it from `/admin` — the visitor's window
should show the reply without a reload.

---

## What runs without any of this

The whole public site. Pages, projects, services, careers, the image
library, the forms and the chat widget are all static or server-rendered, and
with nothing configured the backend writes to `./data/` and logs the mail it
would have sent. That is the right way to work locally; it is not a way to
run in production, because Vercel's filesystem is not durable between
requests.

For the deploy itself, and for the per-step screenshots, see
[DEPLOYMENT.md](DEPLOYMENT.md).
