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

### 1. Supabase

1. Open your Supabase project and go to **SQL Editor → New query**. Paste in `supabase/schema.sql`, change the two example emails at the bottom to Ella's and Jackson's real addresses, and click **Run**.
   - To add or change someone later: `insert into public.household_members (email) values ('someone@example.com');`
2. Go to **Authentication → URL Configuration**:
   - Set **Site URL** to where the app will live, e.g. `https://<your-github-username>.github.io/<repo-name>/`.
   - Add the same URL under **Redirect URLs**. Also add `http://localhost:5173/` if you'll run it locally.
3. Optional, but useful if you add the app to your phone's home screen: go to **Authentication → Emails → Magic Link** and add `{{ .Token }}` to the template (e.g. `Or enter this code: {{ .Token }}`). You can then sign in by typing the 6-digit code instead of tapping the link, which avoids the link opening in a different browser.
4. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

Only the emails in `household_members` can read or change the household data; this is enforced by row-level security in the database. Once you've both signed in, you can also turn off new sign-ups under **Authentication → Sign In / Providers**.

### 2. Local `.env` (optional)

```sh
cp .env.example .env   # then paste the URL and anon key
```

### 3. Host it on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Secrets and variables → Actions → Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is meant to be public; the database rules above keep the data private.
3. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Push to `main`, or run the **Deploy to GitHub Pages** workflow by hand. The app will be published at the Pages URL.

On each phone, open the URL, sign in with your email, and optionally use **Share → Add to Home Screen**.

## How syncing works

- The whole household is stored as one JSON document in a single row (`household`, id `home`). The first person to sign in creates it; they start with that device's saved data if there is any, otherwise the sample data.
- Each save only succeeds if nobody else has saved since. If someone has, the app loads their version and reapplies your changes on top, so edits made at the same moment on two phones are both kept (`src/lib/store.ts`).
- Changes from the other device arrive live over Supabase Realtime. The app also refreshes when it comes back to the foreground.
- If a phone is offline, its changes are kept and sent once it reconnects. Changes are lost only if the app is closed before that happens.
- Shopping-list ticks are stored on each device, so ticking items off at the shops doesn't affect the other phone.

## Layout

```
src/
  App.tsx            sign-in gate, sets up syncing
  Household.tsx      header, week navigation, page switching
  lib/model.ts       types, sample data, chore schedules, shopping list and budget maths
  lib/store.ts       Supabase sync (conflict-safe saves, realtime, offline retry)
  views/             week table, budget card, and each full page
  styles.css         design values from Household v2
supabase/schema.sql  tables, access rules, realtime
```
