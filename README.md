# Bloom Trail

A private medical journey tracker: calendar, appointments, a symptom/condition
timeline, a care team roster, recurring reminders, and billing — with two
optional AI features (plain-language explanations of results, and a gentle
reflection on how an appointment went). Each person who uses it has their
own username and password, and never sees anyone else's data.

## What this is

- **Next.js** app (App Router), deployed on **Vercel**
- **Postgres** (via Vercel's Storage tab, powered by Neon) for the actual data
- **Per-person accounts** — each person creates their own username and
  password; every profile (journey) belongs to exactly one account, and the
  database enforces that no one can read or write another account's data
- The AI buttons call **your own Anthropic API key** from the server, never
  from the browser

## How accounts work

- The **first account ever created** (when the database has no users yet)
  can be made freely at `/signup` — this is how you bootstrap your own login.
- After that, new accounts need either **an invite link** or **an existing
  login**:
  - Click **"Invite someone"** in the header to generate a one-time link.
    It's valid for 7 days and stops working the moment someone signs up
    with it (or you revoke it early from the same panel). Send the link
    however you like — text, email, however you'd share any link.
  - Alternatively, if you're already logged in, submitting `/signup`
    yourself creates an account for someone else without needing a link —
    though the invite-link flow is usually simpler since it doesn't
    require you to stay logged in and do the typing for them.
- Usernames are **not case-sensitive** ("Alice" and "alice" are the same
  account) — passwords **are** case-sensitive, as normal.
- Each account can have more than one **profile** (e.g. your own journey and
  a parent's, if you're the one tracking both) via the "+" button — but a
  profile is only ever visible to the account that owns it. There's no way
  to share a single profile between two different logins.
- There's no email-based password reset built in. If someone forgets their
  password, an existing account holder would need to reset it directly in
  the database (see "Resetting a password" below) — or you can add an email
  provider yourself later if you want that flow.

## One-time setup

### 1. Push this to GitHub

Create a new repo and push this project's contents. If you're not sure how,
these commands from inside this project folder will do it (replace the URL
with your own empty GitHub repo):

```bash
git init
git add .
git commit -m "Initial Bloom Trail setup"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### 2. Import it into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo
   you just pushed.
2. Leave the build settings as default (Vercel auto-detects Next.js).
3. **Don't deploy yet** — first add the environment variables below, then
   deploy (or redeploy) once they're set.

### 3. Add a Postgres database

In your Vercel project: **Storage** tab → **Create Database** → **Postgres**
(this is powered by Neon under the hood). Once created and connected to your
project, Vercel automatically sets a `DATABASE_URL` environment variable for
you — you don't need to type this in yourself.

### 4. Set the remaining environment variables

In your Vercel project: **Settings** → **Environment Variables**, add:

| Name | Value |
|---|---|
| `BLOOM_TRAIL_SESSION_SECRET` | A long random string — generate one with `openssl rand -hex 32` in a terminal, or any password generator |
| `ANTHROPIC_API_KEY` | Your API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (only needed if you want the ✨ Explain / ✨ Reflect buttons to work) |

### 5. Initialize the database tables

After the database is connected and the app has deployed once, run this
once from your own computer (with the [Vercel CLI](https://vercel.com/docs/cli)
installed):

```bash
npm install
vercel link          # connects this folder to your Vercel project
vercel env pull .env.local   # copies DATABASE_URL etc. locally
npm run db:init
```

This creates the one table Bloom Trail needs. You only need to do this once.

### 6. Deploy

Back in the Vercel dashboard, trigger a deploy (or just push a commit — Vercel
redeploys automatically). Visit your new `.vercel.app` URL — you'll land on
`/signup` automatically the first time, since no accounts exist yet. Create
your own username and password there; you'll be logged straight in.

## Resetting a password

There's no self-service "forgot password" flow. If you need to reset
someone's password directly, run this from your own computer (with
`vercel env pull .env.local` already done):

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const hash = await bcrypt.hash('their-new-password', 10);
  await sql\`UPDATE users SET password_hash = \${hash} WHERE username = 'their-username';\`;
  console.log('Password updated.');
})();
"
```
(You may need `npm install dotenv` first if you don't already have it.)

## Using it day to day

- Log in with your own username and password from any device — you'll see
  the same data everywhere. Usernames aren't case-sensitive; passwords are.
- To let someone else use Bloom Trail with their own private data, click
  **"Invite someone"** in the header and share the generated link — no need
  to stay logged in while they sign up with it.
- Use the **profile switcher** (the dropdown, plus **+**) if you want to
  track more than one journey under your own account — e.g. your own and a
  parent's you're personally responsible for. This does NOT let anyone else
  see that profile; it's still private to your login.
- **Click any day on the calendar** to see everything tied to that date —
  appointments, reminders due, and timeline entries — including past days,
  so the calendar works as a real history, not just an upcoming list.
- Each appointment and reminder has a **📅 Add to Calendar** button that
  downloads a file your phone's calendar app can open directly, complete
  with a reminder alarm — this is what actually notifies you, since Bloom
  Trail itself only shows in-app reminders when you have the page open.
- The ✨ **Explain** button (inside an appointment, under "Documents from this
  visit") turns a pasted lab result or note into a plain-language summary.
  It's general information only, never medical advice.
- The ✨ **Reflect on this** button (under "How did it go?") reflects back
  the mood/sentiment in your own note about a visit.

## Local development

```bash
npm install
vercel env pull .env.local   # after step 3-4 above
npm run dev
```

Visit `http://localhost:3000`.

## Project structure

```
app/
  layout.js              Root layout
  page.js                Main page (renders the app once logged in)
  login/page.js           Username/password login screen
  signup/page.js          Create an account (bootstrap, or invite by an existing user)
  api/
    auth/login/route.js   Verifies username/password, issues a session cookie
    auth/signup/route.js  Creates an account (first one free, later ones invite-only)
    auth/logout/route.js  Clears the session cookie
    data/profiles/        List/create/rename/delete profiles; get/save data — all scoped to the logged-in user
    ai/explain/route.js   Server-side call to Claude for document explanations
    ai/reflect/route.js   Server-side call to Claude for appointment reflections
components/
  BloomTrailApp.js        All the UI and client-side logic
lib/
  auth.js                 Session tokens carrying which user is logged in (Edge-safe)
  db.js                   Postgres queries — users, and profiles scoped by user_id
middleware.js              Gates every page/route behind a valid session, forwards the user's id
scripts/
  init-db.mjs             One-time table creation (users + profiles), with migration for older installs
```

## Notes on privacy

- Nothing is stored anywhere except your own Postgres database, which only
  you (via Vercel) control.
- Password-based login is meant to keep each person's data genuinely
  separate from everyone else's — but this app has no rate-limiting or
  lockout on repeated failed logins, so use a real password, not something
  guessable, and don't share the URL publicly.
- The Explain/Reflect buttons send only the specific text you put in that
  field to Anthropic's API when you press them — nothing else on the page is
  sent, and nothing is sent unless you press those buttons.
