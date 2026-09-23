# Bloom Trail

A private medical journey tracker: calendar, appointments, a symptom/condition
timeline, a care team roster, recurring reminders, and billing — with two
optional AI features (plain-language explanations of results, and a gentle
reflection on how an appointment went) and a shared PIN so it works the same
way from any of your devices.

## What this is

- **Next.js** app (App Router), deployed on **Vercel**
- **Postgres** (via Vercel's Storage tab, powered by Neon) for the actual data,
  so it's the same on your phone, laptop, or anywhere else you sign in
- A single shared **PIN** unlocks the whole app — no accounts, no emails
- The AI buttons call **your own Anthropic API key** from the server, never
  from the browser

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
| `BLOOM_TRAIL_PIN` | Any PIN you want, e.g. `847213` |
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
redeploys automatically). Visit your new `.vercel.app` URL, enter the PIN you
set in step 4, and you're in.

## Using it day to day

- Open the same URL on any device, enter the same PIN, and you'll see the
  same data — appointments, care team, everything.
- Use the **profile switcher** in the top-right of the header to add a
  separate profile for someone else's journey (a parent's, a child's) — each
  profile's data is completely separate.
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
  login/page.js           PIN entry screen
  api/
    auth/login/route.js   Checks the PIN, issues a session cookie
    auth/logout/route.js  Clears the session cookie
    data/profiles/        List/create/rename/delete profiles; get/save data
    ai/explain/route.js   Server-side call to Claude for document explanations
    ai/reflect/route.js   Server-side call to Claude for appointment reflections
components/
  BloomTrailApp.js        All the UI and client-side logic
lib/
  auth.js                 PIN checking + signed session tokens (Edge-safe)
  db.js                   Postgres queries (via Neon's serverless driver)
middleware.js              Gates every page/route behind a valid session
scripts/
  init-db.mjs             One-time table creation script
```

## Notes on privacy

- Nothing is stored anywhere except your own Postgres database, which only
  you (via Vercel) control.
- The PIN gate is meant to keep casual/opportunistic access out — it is not
  bank-grade security. Don't reuse a PIN you use elsewhere, and don't share
  the URL publicly.
- The Explain/Reflect buttons send only the specific text you put in that
  field to Anthropic's API when you press them — nothing else on the page is
  sent, and nothing is sent unless you press those buttons.
