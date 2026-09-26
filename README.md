# Ella & Jackson · Household

A one-page household dashboard for a week at a time: dinners and chores side by side, the weekly budget, and full pages for the shopping list, recipes, cupboard, chores, budget and a month view. It is built from the Claude Design handoff in `project/Household v2.dc.html` (see `HANDOFF.md` and `chats/`).

Data is synced between devices through Supabase, and saves appear on the other person's phone within about a second. If Supabase isn't configured, the app still runs and saves on that one device.

## Run it locally

```sh
npm install
npm run dev        # http://localhost:5173
npm test
```

Without a `.env` file this runs in device-only mode with the sample data from the design.

## One-time setup for syncing

There are no logins. The link is the key: `https://…/#<household key>`. Anyone with the full link can open and edit the household, and without it the data can't be read or changed. Share the link only with each other, the same way you would a password.

### 1. Supabase

1. Open your Supabase project and go to **SQL Editor → New query**. Paste in `supabase/schema.sql` and click **Run**.
2. The result shows a `household_key`. Your link is the app's address, a `#`, then that key, for example:
   `https://<your-github-username>.github.io/<repo-name>/#42dfa78d…`
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

To change the key later (e.g. if the link gets shared by accident), run
`update public.household set secret = replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') returning secret;`
and use the new link. The old link stops working immediately.

### 2. Local `.env` (optional)

```sh
cp .env.example .env   # then paste the URL and anon key
```

Open `http://localhost:5173/#<household key>`.

### 3. Host it on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Secrets and variables → Actions → Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is fine to make public: it can't touch the data without the household key.
3. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Push to `main`, or run the **Deploy to GitHub Pages** workflow by hand.

On each phone, open the link once and optionally use **Share → Add to Home Screen**. The key is also remembered on that device, so the app still opens if a shortcut drops the `#…` part.

## Install it as a phone app

The site is an installable home-screen app (a progressive web app): it opens full screen with its own icon, works offline with your last-synced data, and updates itself whenever `main` is deployed.

- **iPhone (Safari):** open your household link → Share → **Add to Home Screen**. The first time the home-screen app opens it may ask for your household link (iPhones keep home-screen apps separate from Safari); paste it once.
- **Android (Chrome):** open your household link → ⋮ → **Install app** (or **Add to Home screen**).

Icons are in `public/icons/` (built from `public/icons/icon-full.svg`), the app name and colours are in `public/manifest.webmanifest`, and offline caching is `public/sw.js`.

## How syncing works

- The whole household is stored as one JSON document in a single row. The table has no public access rules; the app only reaches it through two database functions (`get_household`, `save_household`), and both require the household key.
- The first device to open the link fills the empty household with that device's saved data if there is any, otherwise the sample data.
- Each save only succeeds if nobody else has saved since. If someone has, the app loads their version and reapplies your changes on top, so edits made at the same moment on two phones are both kept (`src/lib/store.ts`).
- After saving, a device pings the other over Supabase Realtime, and the other reloads straight away. The app also refreshes when it comes back to the foreground.
- If a phone is offline, its changes are kept and sent once it reconnects. Changes are lost only if the app is closed before that happens.
- Shopping-list ticks are stored on each device, so ticking items off at the shops doesn't affect the other phone.

## Layout

```
src/
  App.tsx            reads the key from the link, sets up syncing
  Household.tsx      header, week navigation, page switching
  lib/model.ts       types, sample data, chore schedules, shopping list and budget maths
  lib/store.ts       sync (conflict-safe saves, offline retry)
  lib/supabase.ts    Supabase functions + realtime pings
  views/             week table, budget card, and each full page
  styles.css         design values from Household v2
supabase/schema.sql  table, key-checked functions
```
