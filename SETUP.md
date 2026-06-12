# Rhythm — setup guide

A daily cycle / training / nutrition tracker. Your data lives in **Supabase**
(a hosted Postgres database). Each person signs in with their own email and
password, and the database keeps every account's data completely private — you
only ever see your own. The app also keeps an offline copy in your browser so it
loads instantly and works without signal, then syncs when you're back online.

The app is already wired to a Supabase project (see `src/supabase.js`). For
day-to-day use there's nothing to configure — just open the hosted app and sign
up. The sections below cover hosting and the one-time Supabase settings.

---

## A. Use the app

1. Open the deployed URL (see section B).
2. Tap **Create an account** — any email + a password (6+ characters).
3. Start logging. Everything saves to your account and syncs to every device you
   sign in on.

To add another person (e.g. a family member): they open the **same URL** and
create **their own** account. Their data is isolated from yours automatically.

### Add to Home Screen (feels like a native app)
- **iPhone (Safari):** Share button → Add to Home Screen.
- **Android (Chrome):** ⋮ menu → Add to Home screen / Install app.

> After deploying a new version, delete the old home-screen icon and re-add it
> so the phone loads the latest build instead of a cached one.

---

## B. Host the app on Vercel

### Option 1 — GitHub + Vercel (no terminal)
1. Push this folder to a GitHub repo (don't commit `node_modules` or `dist`).
2. In Vercel: **Add New → Project → Import** your repo.
3. Vercel auto-detects Vite. Leave the defaults and click **Deploy**.
4. After ~1 minute you get a live URL like `https://rhythm-app-xxxx.vercel.app`.

### Option 2 — Command line
```bash
npm i -g vercel
cd rhythm-app
npm install
npm run build      # optional local check
vercel             # follow the prompts; accept defaults
```

### Run it locally first (optional)
```bash
cd rhythm-app
npm install
npm run dev        # opens http://localhost:5173
```

---

## C. Supabase backend (already set up)

The database table and security are already created. For reference, the setup was:

- **Table `entries`**: `(user_id, date, payload jsonb, updated_at)`, primary key
  `(user_id, date)`. The whole day's log is stored in `payload`.
- **Row Level Security** is enabled with policies so each user can only read and
  write rows where `user_id = auth.uid()`. The publishable key shipped in the
  app can therefore only ever touch the signed-in user's own data.

### Auth settings (in the Supabase dashboard)
- **Authentication → Sign In / Providers → Email**: the "Confirm email" toggle
  controls whether new users must click an email link before signing in. Turn it
  **off** for instant signup, **on** for stronger verification.

### Where to see your data
- **Table Editor → `entries`** — one row per logged day (schema must be `public`).
- **Authentication → Users** — the accounts that have signed up.

---

## How the data flows
- Every day you log is saved to your browser instantly **and** upserted to
  Supabase (one row per date — editing a day updates its existing row).
- On open, the app pulls your rows from Supabase and merges them with the local
  cache (local edits win), so data is never lost or clobbered.
- Offline? It still works fully from the local cache and syncs next time you're
  online. The gear menu also has a **Download CSV** button anytime.

## Note
Cycle phase and next-period estimates are based on the days you log and assume a
roughly typical cycle. They're for spotting your own patterns — not medical
advice, and not a contraception method.
