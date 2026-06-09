# Rhythm — setup guide

A daily cycle / training / nutrition tracker. Your data lives in **your own Google Sheet**;
the app reads and writes it through a tiny Google Apps Script, and keeps an offline copy in
your browser so it loads instantly and still works without signal.

There are two things to set up:
- **A. The Google Sheet backend** (~10 min, one time)
- **B. Hosting the app** on Vercel (~5–10 min, one time)

You can do them in either order, but the app needs the Sheet URL at the end.

---

## A. Google Sheet backend

1. **Make a Sheet.** Go to https://sheets.google.com and create a blank spreadsheet.
   Name it anything (e.g. "Rhythm"). Don't add headers — the script does that for you.

2. **Open the script editor.** In the Sheet: **Extensions → Apps Script**.

3. **Paste the code.** Delete whatever's in the editor, then open
   `google-apps-script/Code.gs` from this project, copy ALL of it, paste it in, and click
   the **Save** icon (💾).

4. **Deploy as a Web App.** Click **Deploy → New deployment**.
   - Click the gear next to "Select type" → choose **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**.

5. **Authorize.** Google will ask for permission.
   - Click **Authorize access**, pick your account.
   - You'll likely see "Google hasn't verified this app." That's expected for your own
     script. Click **Advanced → Go to (your project name) → Allow.**

6. **Copy the URL.** After deploying you'll get a **Web app URL** ending in `/exec`.
   Copy it — you'll paste it into the app in step B7. (You can find it again anytime via
   **Deploy → Manage deployments**.)

   > Optional privacy step: anyone with this URL can read/write the Sheet. To lock it down,
   > set `var TOKEN = 'some-secret';` near the top of `Code.gs`, redeploy, and enter the same
   > secret in the app's settings.

---

## B. Host the app on Vercel

You need the project on the web. The no-terminal route is easiest.

### Option 1 — GitHub + Vercel (no terminal)
1. Create a free account at https://github.com and https://vercel.com (you can log in to
   Vercel with GitHub).
2. On GitHub, create a new repository (e.g. `rhythm-app`).
3. Upload this whole folder to the repo (**Add file → Upload files**, drag everything in
   — but **not** the `node_modules` or `dist` folders if present).
4. In Vercel: **Add New → Project → Import** your `rhythm-app` repo.
5. Vercel auto-detects Vite. Leave the defaults and click **Deploy**.
6. After ~1 minute you get a live URL like `https://rhythm-app-xxxx.vercel.app`.
7. Open it, tap the **gear icon** (top right), paste your Web App URL (and token if you set
   one), and tap **Save & sync**. Done — the dot turns green ("Synced").

### Option 2 — Command line
```bash
# one-time: install Node.js from https://nodejs.org, then:
npm i -g vercel

cd rhythm-app
npm install
npm run build      # optional local check
vercel             # follow the prompts; accept defaults
```
Then open the URL it prints and do step B7 above.

### Run it locally first (optional)
```bash
cd rhythm-app
npm install
npm run dev        # opens http://localhost:5173
```

---

## C. Make it feel like an app
On your phone, open the deployed URL and **Add to Home Screen**:
- **iPhone (Safari):** Share button → Add to Home Screen.
- **Android (Chrome):** ⋮ menu → Add to Home screen / Install app.

It'll open full-screen with its own icon.

---

## How the data flows
- Every day you log is saved to your browser instantly **and** pushed to the Sheet (one row
  per date — editing a day updates its existing row).
- On open, the app pulls the latest from the Sheet so any device stays current.
- No Sheet connected? It still works fully, just stored on that device only. The gear menu
  also has a **Download CSV** button anytime.

## The Sheet columns
`Date, Flow, Energy, Mood, Sleep, Worked out, Mode, Class, Self types, Duration, New high,
Treat, Cravings, Caffeine, Caffeine servings, Alcohol, Drinks, Symptoms, Cycle day, Phase, Notes`

You can chart or pivot this however you like in Sheets — just don't rename column headers or
the "Log" tab, since the app matches on those.

## Note
Cycle phase and next-period estimates are based on the days you log and assume a roughly
typical cycle. They're for spotting your own patterns — not medical advice, and not a
contraception method.
