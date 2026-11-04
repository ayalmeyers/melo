# Taking Melo live

Everything in this repo is built and tested. What's left are the steps that need your accounts, payment and signature. Do them in this order; the whole thing takes about an afternoon, plus Apple's review (usually 1 to 3 days).

| Piece | Service | Cost |
|---|---|---|
| Database, sign-in, realtime chat | Supabase | Free tier to start |
| Website | Vercel | Free (Hobby) |
| iPhone builds and submission | Expo (EAS) | Free tier: 15 iOS builds/month |
| App Store listing | Apple Developer Program | $99/year |

---

## 1. Supabase (about 15 minutes)

1. Create an account at supabase.com and a new project named **melo**. Save the database password somewhere safe.
2. Install the CLI (`brew install supabase/tap/supabase`), then from the repo root:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF     # the ref is in the project URL
   supabase db push                                 # applies supabase/migrations
   psql "$(supabase db url)" -f supabase/seed.sql   # or paste seed.sql into the SQL editor
   ```
   If `supabase db url` isn't available in your CLI version, copy the connection string from **Project Settings → Database** and use it in place of `$(supabase db url)`.
3. **Authentication → Providers → Email**: enabled, "Confirm email" on.
4. **Authentication → Email Templates → Magic Link**: the apps sign in with a 6-digit code. Replace the body with:
   ```html
   <h2>Your Melo code</h2>
   <p style="font-size:32px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
   <p>It expires in an hour. If you didn't ask for it, ignore this email.</p>
   ```
   Do the same for the **Confirm signup** template.
5. **Authentication → URL Configuration**: Site URL `https://melo.vercel.app` (or your final domain). Add `melo://**` to Redirect URLs.
6. **Authentication → SMTP**: Supabase's built-in email is rate-limited to a handful per hour. Before launch, connect a sender (Resend, Postmark or SES) so codes arrive reliably.
7. **Project Settings → API**: copy the **Project URL** and the **anon public** key. You need both below.
8. After you sign up in the app for the first time, make yourself an admin (to resolve forecasts and moderate) in the SQL editor:
   ```sql
   update profiles set is_admin = true where handle = 'YOUR_HANDLE';
   ```

## 2. Website on Vercel (about 10 minutes)

1. vercel.com → **Add New → Project** → import `ayalmeyers/melo`.
2. **Root Directory**: `apps/web`. Framework: Next.js (detected). Leave build settings on their defaults.
3. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL from step 1.7
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key from step 1.7
   - `NEXT_PUBLIC_SITE_URL` = `https://melo.vercel.app` (or whatever Vercel assigns; update it if the name is taken)
   - `NEXT_PUBLIC_SUPPORT_EMAIL` = the address people should write to (Apple requires a working support contact)
4. Deploy. Every push to `main` redeploys automatically.
5. If Vercel gave you a different address than `melo.vercel.app`, update it in three places: `NEXT_PUBLIC_SITE_URL`, Supabase Site URL, and `EXPO_PUBLIC_WEB_URL` in `apps/mobile/eas.json`.

Check: open the site, sign in with your email, finish onboarding, post a take.

## 3. Apple Developer Program (you, 1 to 2 days)

1. Enroll at developer.apple.com/programs ($99/year). Enrolling as an individual is fastest. Enrolling as a company shows the company as the seller and needs a D-U-N-S number.
2. Once approved, in App Store Connect → **Apps → +** → New App:
   - Platform iOS, name **Melo** (pick an alternative like "Melo: Music Diary" if the name is taken)
   - Bundle ID: `com.meyerslink.melo` (create it under Certificates, Identifiers & Profiles if it isn't in the list, or let EAS create it in step 4)
   - SKU: `melo-ios`
3. Copy the app's **Apple ID** (a number under App Information) into `apps/mobile/eas.json` → `submit.production.ios.ascAppId`.

## 4. Build and submit the iPhone app (about 30 minutes, plus build time)

```bash
cd apps/mobile
npm i -g eas-cli          # or use npx eas-cli@latest for each command
eas login                 # create a free account at expo.dev first
eas init                  # links the project and writes its id into app.json

# Server settings baked into the build
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY --visibility plaintext

eas build --platform ios --profile production   # EAS asks to sign in to Apple and handles certificates
eas submit --platform ios --profile production --latest
```

The build lands in **TestFlight** within about 15 minutes of submitting. Install TestFlight on your iPhone, test it yourself, then submit for review.

To try it before the Apple account exists: `npx expo start` in `apps/mobile` with a `.env.local` copied from `.env.example`, then open it in the iOS Simulator (Mac) or scan the QR code with a development build.

## 5. App Store listing (about 1 hour)

In App Store Connect, fill in:

- **Privacy Policy URL**: `https://melo.vercel.app/privacy`
- **Support URL**: `https://melo.vercel.app/support`
- **Category**: Music (primary), Social Networking (secondary)
- **Age rating**: answer the questionnaire honestly. User-generated content and unrestricted chat usually lead to 12+ or higher.
- **App Privacy** ("nutrition label"). Data collected and linked to the user, none of it used for tracking:
  - Contact Info → Email Address (App Functionality)
  - User Content → Posts, comments, messages, wiki edits (App Functionality)
  - Identifiers → User ID (App Functionality)
  - Usage Data → none collected beyond what the person posts
- **Screenshots**: 6.9-inch iPhone (1320 × 2868) is required. Take them in the iOS Simulator (iPhone 17 Pro Max) with real content: Home feed, an album page, a forecast, a profile, a chat.
- **Review notes**: give Apple a way in. Create a reviewer account and write:
  > Sign in uses a 6-digit email code. Test account: review@YOURDOMAIN, the code is in the inbox at [shared inbox link], or contact us and we'll provide a code. Report and block are under the ··· menu on every post, comment, profile, and on a long press of a chat message. Account deletion is in Settings.

  Apple can't receive your email codes. The usual fix is a demo account whose inbox you share, or a fixed code. Supabase supports test phone numbers for SMS only, so for email use a dedicated inbox.

### Sign-in during testing

Sign-in is email and password while testing. In Supabase, Authentication → Sign In / Providers → Email: turn **Confirm email** off. Before launch, connect custom SMTP and switch back to email codes or turn confirmation on.

### What's already in the code for review

- Account deletion inside the app (Settings → Delete account), guideline 5.1.1(v)
- Terms acceptance at signup with a no-tolerance clause, plus report, block and filtering of blocked users on all user content, guideline 1.2
- A working support page and privacy policy (`apps/web/src/app/support`, `privacy`). Have counsel review both before launch.
- No tracking SDKs, no third-party ads, encryption export answer set to "no non-exempt encryption"

## 6. Before you invite anyone

- [ ] Moderation: at least one admin, and you check `select * from reports order by created_at desc` daily. Apple expects reports handled within 24 hours.
- [ ] Custom SMTP connected (step 1.6)
- [ ] Supabase **Point-in-Time Recovery** or daily backups on (paid tier) once real people are posting
- [ ] Custom domain (optional): add it in Vercel, then update the three URLs from step 2.5

## Running it locally

```bash
npm install            # needs Node 22.13+ (nodejs.org LTS)
cp apps/web/.env.example apps/web/.env.local       # fill in Supabase values
cp apps/mobile/.env.example apps/mobile/.env.local
npm run web        # http://localhost:3000
npm run ios        # Expo dev server
npm test           # core unit tests + database tests (needs Postgres on PGHOST/PGPORT)
```

## Applying database updates

New features sometimes add a file to `supabase/migrations/`. Apply each new file once, in date order: open it on GitHub, copy all of it, paste into Supabase → SQL Editor → New query, and Run. (With the Supabase CLI linked, `supabase db push` does the same.)

| File | Adds |
|---|---|
| `20261104000001_apple_catalog.sql` | Adding albums and podcasts from Apple, real artwork, artist pages for any artist |
| `20261104000002_moderation_notifications.sql` | Notifications, push tokens, moderation queue, bans |
| `20261105000001_images.sql` | Artist photos (Wikimedia Commons) and genre mosaics |
| `20261105000002_history_charts.sql` | Spotify / Apple Music history import, weekly charts |
| `20261105000003_taste_lists.sql` | Taste match, people who hear like you, lists |

Each batch is also bundled into one paste-in file in `supabase/updates/` (`2026-11-04.sql`, `2026-11-05.sql`).

`supabase/setup.sql` always contains everything, for a brand-new project.

## Push notifications (optional until launch)

The app registers each phone for push and the database writes a notification row for replies, likes, follows, messages and resolved forecasts. One small function turns those rows into phone notifications:

```bash
npm i -g supabase            # or brew install supabase/tap/supabase
supabase login
supabase link --project-ref bjgahyslmlmnjsqopans
supabase secrets set PUSH_WEBHOOK_SECRET=$(openssl rand -hex 24)   # note the value it prints with: supabase secrets list
supabase functions deploy push --no-verify-jwt
```

Then in Supabase → Database → Webhooks → Create a new hook:
- Table `notifications`, event **Insert**
- Type **Supabase Edge Functions**, function `push`, method POST
- HTTP header `x-melo-secret` = the same secret

Push works in Expo Go on iPhone for testing. Store builds need an Apple push key, which `eas build` sets up when asked.

## Email: confirmations and password resets (before inviting anyone)

Supabase's built-in email sends only a few messages an hour and can't use custom templates. Connect a real sender:

1. **Resend** (free up to 3,000 emails a month): sign up at resend.com → Domains → Add domain. Use a domain you control, for example `mail.meyerslink.com` (or Melo's own domain once you buy it). Add the DNS records Resend shows at your domain registrar and wait for "Verified".
2. Resend → API Keys → Create (sending access). Copy it.
3. Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP:
   - Sender email `hello@mail.meyerslink.com`, sender name `Melo`
   - Host `smtp.resend.com`, port `465`, username `resend`, password = the API key
4. Supabase → Authentication → Emails → Templates: paste `supabase/templates/confirm-signup.html` into **Confirm signup** and `supabase/templates/reset-password.html` into **Reset password** (subjects are in the first line of each file).
5. Supabase → Authentication → URL Configuration: Site URL = your website (e.g. `https://melo.vercel.app`); Redirect URLs add `https://melo.vercel.app/**`.
6. Supabase → Authentication → Sign In / Providers → Email: turn **Confirm email** back on.

What people see: new accounts get a "Confirm your email" message before they can sign in; "Forgot password?" on the website and in the app sends a reset link that opens the website to choose a new password; Settings has "Change password" on both.
