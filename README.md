# Attesta — certificate and ID card generator with QR verification

Design certificates and ID cards (from templates or your own artwork), issue one or thousands from CSV, and give every one a signed, permanent verification page.

Built with Next.js 16, TypeScript, Tailwind CSS 4, Drizzle ORM and Postgres. Ready for Vercel.

---

## Deploy to Vercel (about 15 minutes)

### 1. Put the code on GitHub
Create a new **private** repository and push this folder to it:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/attesta.git
git push -u origin main
```

### 2. Import it into Vercel
1. Go to vercel.com → **Add New… → Project** → import the repository.
2. Framework preset: **Next.js** (detected automatically). Leave build settings as they are —
   `package.json` has a `vercel-build` script that runs database migrations and then builds.
3. **Don’t deploy yet** — first add the database and environment variables below.
   (If it already deployed and failed, that’s fine; redeploy after step 4.)

### 3. Add the database
In the Vercel project: **Storage → Create Database → Neon (Postgres)** → connect it to the project.
This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.

Any Postgres works (Supabase, Railway, your own server) — just set `DATABASE_URL` yourself.
With a transaction pooler (Supabase port 6543, PgBouncer), also set `DATABASE_URL_UNPOOLED` to the direct URL.

### 4. Add environment variables
On your own computer, inside this folder:

```bash
npm install
npm run keys:generate
```

It prints four lines. In Vercel → **Settings → Environment Variables**, add each of them, plus:

| Name | Value |
|---|---|
| `SIGNING_KEY_ID`, `SIGNING_PRIVATE_KEY`, `SIGNING_PUBLIC_KEY`, `SECRET_SALT` | from `npm run keys:generate` |
| `APP_URL` | `https://your-domain.com` (or `https://your-project.vercel.app` for now) |
| `CRON_SECRET` | any long random text |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional, see “Email” below |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional, see “Sign in with Google” below |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_LIVE` | optional, see “Online payment (SSLCommerz)” below |

> **Keep `SIGNING_PRIVATE_KEY` secret and backed up.** If it is lost, new certificates can still be issued with a new key,
> but if the *public* key is lost, older certificates can no longer show “signature confirmed”.
> Store all four values in a password manager.

> **Set `APP_URL` to your final domain before issuing real certificates.** QR codes printed on certificates contain this address.

### 5. Deploy
**Deployments → Redeploy**. The build log should show `Migrations applied.`

Then open `https://your-domain.com/api/health`. It should answer `{"ok":true,"checks":{"database":"ok","signing":"ok"}}`.
The `signing` check catches the most common setup mistake — a public key pasted in that does not belong to the private key —
which would otherwise make every certificate you issue show “could not be confirmed”. Point an uptime monitor at the same address.

### 6. Make yourself admin
Register an account on the live site, then on your computer run (use the database URL from Vercel):

```bash
DATABASE_URL="postgres://..." npm run admin:promote -- you@example.com
```

Sign out and back in — you’ll land on `/admin`.

### 7. Your own domain
Vercel → **Settings → Domains** → add it and follow the DNS instructions. Then update `APP_URL` and redeploy.

---

## Before going live — edit these

**`src/lib/site.ts`**
- `packages` — prices and certificate counts
- `paymentMethods` — your bKash / Nagad numbers and bank details (the bank details are still placeholders)
- `onlinePaymentMethods` — what your SSLCommerz store accepts, if you use it (card, bKash, Nagad, Rocket, internet banking)
- `site.name`, `supportEmail`, `operatedFrom` — “Attesta” is a placeholder brand name; rename it here
- `limits` — guest 2, free 5 per month, bulk max 5000 rows

**`src/app/(site)/privacy/page.tsx` and `terms/page.tsx`** — starting drafts; have a lawyer review them.

**What the site leaves out on purpose**
- Testimonials, customer logos and usage numbers: there are none yet, and invented ones would undercut a product whose
  whole point is trust. Add real ones, with permission, to the landing page once you have them.
- Analytics: none is installed. If you add one, say so on the privacy page and allow its domain in the content security
  policy in `next.config.ts`.

## Email
Without email configured, new accounts are active immediately and reset links only appear in the Vercel function logs.
For production, create a free account at resend.com, verify your domain, and set `RESEND_API_KEY` and `EMAIL_FROM`.
Accounts then need to confirm their email before issuing, which stops throwaway sign-ups from farming free certificates.

## Sign in with Google
Optional. With `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set, the sign-in and sign-up pages offer **Continue with Google**;
without them the button does not appear.

1. In the [Google Cloud console](https://console.cloud.google.com/), open **Google Auth platform**. Give the app its name and a
   support email, and publish it: while it is in testing, only the test users listed there can sign in.
2. Under **Clients**, choose **Create client**, application type **Web application**. Under **Authorized redirect URIs** add your
   `APP_URL` followed by `/api/auth/google/callback`, for example `https://your-domain.com/api/auth/google/callback`. It must match
   exactly, or Google refuses with `redirect_uri_mismatch`. For local development add `http://localhost:3000/api/auth/google/callback` too.
3. Put the client ID and client secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and redeploy.

The app asks Google only for the person's name and email address (`openid email profile`).
- Someone new gets an account straight away, with the address already confirmed and no password. **Account settings** can email
  them a link to add a password.
- Someone who already has an account with the same address is signed in to it, and it is linked to their Google account from then on.
  If that address was never confirmed, the account's password is removed and its other sessions are ended: whoever chose that password
  never proved they own the address.
- When a sign-in fails, the sign-in page says why. Problems with the setup, such as a wrong secret or a redirect address Google does
  not know, also appear in the function logs as `Google sign-in failed: …`.

## Ads (AdSense)
Set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXX` and redeploy. Ads show on the certificate-type pages
(`/certificate-maker/...`) only, below the article. The landing, pricing and verification pages stay ad-free: they are where
visitors decide to sign up or pay, and an ad there competes with that. Replace the placeholder slot ID (`1000000002`) in
`src/app/(site)/certificate-maker/[slug]/page.tsx` with a slot ID from your AdSense account; `<AdSlot>` can be added to other
pages the same way.
The content security policy opens up for Google’s ad domains automatically when this variable is set.

---

## From visitor to customer
- Anyone can use the editor without an account and make `limits.guestLifetime` certificates, marked as unregistered.
  Pressing **Save**, or reaching that limit, leads to sign-up, and the design comes along: the editor keeps it in the browser,
  images included, puts it back when they return, and uploads the images to the new account (`src/components/editor/draft.ts`).
- A new account’s dashboard lists what is left to set up: confirm the email address, add the organisation, upload a signature
  or logo, issue the first certificate. The list goes once everything on it is done.
- When the month’s free certificates run out, the dashboard offers a package and says when more arrive. The bulk page shows
  the packages to accounts without credits, and every “Buy” link opens billing with that package already chosen.
- Every valid verification page invites its recipient to add the certificate to LinkedIn or share it, and shows other visitors
  how to issue certificates of their own. Recipients sharing their certificates is how most new issuers will find the site.

## How payments work
Customers buy a package on **Packages and billing**, in one of two ways:

- **Online**, once SSLCommerz is set up (below): by card, bKash, Nagad, Rocket or internet banking on SSLCommerz’s payment page.
  The credits are added as soon as SSLCommerz confirms the payment, with nothing for you to do.
- **Sending the money themselves**, by bKash, Nagad or bank transfer, then submitting the transaction ID. You check it against your
  statement in **Admin → Payments** and press **Confirm**, and the credits are added instantly.

Each transaction ID can only be submitted once, and a payment can only be confirmed once.

## Online payment (SSLCommerz)
Optional. With `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD` set, the billing page offers **Pay online** first and sending
money yourself second, and the public pages say that card payment is accepted.

1. Register a sandbox store at [developer.sslcommerz.com/registration](https://developer.sslcommerz.com/registration/). The store ID
   and store password arrive by email.
2. Set both variables, in Vercel and in `.env.local`, and redeploy. Pages built ahead of time (home, pricing, privacy, terms) read them
   when the site is built, so always redeploy after changing them. Try a payment with the sandbox’s test cards and wallets, which
   take no real money.
3. In the SSLCommerz merchant panel, set the IPN address to `<APP_URL>/api/billing/sslcommerz/ipn`. The app also sends it with every
   checkout.
4. For real payments, apply to SSLCommerz for a live store. Then replace the two values with the live ones, set `SSLCOMMERZ_LIVE=true`
   and redeploy.

How it stays right:
- Nothing posted back to the site is trusted. The customer’s return from the payment page and SSLCommerz’s server-to-server notice
  (IPN) only say which checkout to look at; the app then asks SSLCommerz’s validation API, and adds credits only for a payment it calls
  valid, for that checkout, for the full amount.
- The return and the notice often arrive together. The credits are added once, whichever comes first, and a payment SSLCommerz
  confirms always wins over an earlier “failed” or “cancelled”.
- A payment SSLCommerz rates risky is not credited by itself: it waits in **Admin → Payments**. Look it up in your SSLCommerz panel
  before confirming it, and refund it there if you reject it.
- If SSLCommerz can’t be reached when the customer comes back, their billing page says the payment is waiting. The notice, which
  SSLCommerz sends again until it is acknowledged, settles it, and the daily cleanup job asks SSLCommerz about any checkout still
  unfinished after a day before closing it.
- Credits are digital, so customers aren’t asked for an address. SSLCommerz requires one, so checkouts say “Not collected”.
- Locally, the sandbox can send the customer back to `http://localhost:3000`, but its notices can’t reach your computer, so there the
  return alone settles each payment.

## ID cards
The editor makes ID cards as well as certificates: choose an ID card template (club member, staff, student, a Bangla member card),
a blank card, or an ID card size under **Page**. Cards are the standard 85.6 × 54 mm (ISO/IEC 7810 ID-1, “CR80”), landscape or
portrait, and work like certificates: each has a serial, a QR code, a signed verification page, and can be revoked.

- **Photos.** A *Photo* element is a frame filled with each person’s photo from a field of type *Photo*. When issuing one card, the
  photo is chosen in the editor. When issuing from a CSV, the photos (or a ZIP of them) are added on the bulk page and matched to rows
  by file name: a column holds each photo’s file name, or the files are named after a column such as the member ID (`1001.jpg`).
  Folders, the extension and capitals are ignored. Rows naming a photo that wasn’t added are flagged before anything is issued, and
  every photo is opened before any card is registered.
- **Photos are never uploaded.** They are placed in the browser, turned the right way up (phones save photos sideways with an
  orientation tag), shrunk to about 400 dpi for their frame and embedded as JPEG. The server keeps only each photo’s file name, so
  a later download from the dashboard can ask for the photos again and match them.
- **Valid until.** A field of type *Valid until* takes dates as people write them (`31/12/2027`, `2027-12-31`, `31 December 2027`,
  `December 2027`, Bangla digits and month names) and prints them in one form. The date is part of the signed record; after the end
  of that day (Bangladesh time) the verification page says the card has expired.
- **Printing.** Bulk downloads, and single cards, come as A4 sheets — 10 landscape or 9 portrait cards a page, edge to edge, with cut
  marks — or as card-size pages for PVC card printers. Print at actual size.
- **Defaults.** ID card templates show the holder’s full name on the verification page and keep it out of search engines; both can be
  changed per template. Each card uses one credit, like a certificate.

## How verification works
- Every certificate gets a random serial like `ATT-7K2Q-9M4D-X1TB` (60 random bits, never sequential).
- The server signs a canonical record (serial, issuer, recipient, public fields, date, design hash) with Ed25519 and stores the signature.
- `/verify/SERIAL` re-checks the signature on every view. If anyone edits the database record, the page says the record can’t be confirmed.
- Revoked certificates keep their page, showing the date and reason, and are removed from search engines.
- Recipient names show as “First L.” by default; issuers can choose full or hidden per template.
- **Verified organisation**: the issuer adds a DNS TXT record proving domain control, then an admin approves it.

## Your records
**Certificates → Export all as CSV** downloads every certificate you have issued (serial, verification link, recipient, date, status,
revocation reason, batch). Search first and it exports just those results; on **All batches** each batch can be exported with its own
fields as extra columns. The file opens correctly in Excel, Bangla names included, and cannot run a spreadsheet formula.

## How PDFs are made
PDFs are built **in the user’s browser**, not on the server. This keeps Bangla conjuncts correct (server PDF libraries break them),
makes the preview identical to the output, and lets 5,000-row batches run without serverless time limits or server cost.
The server only registers certificates (100 per request) and enforces quotas.
Borders, lines, seals and QR codes are vector; text is rendered at ~288 dpi, and at ~576 dpi on small pages such as ID cards.

## Security summary
- Passwords: scrypt (N=32768) with per-user salt. Sessions: random tokens, stored hashed, httpOnly + SameSite cookies.
- Email-confirmation and password-reset links are single-use and spent atomically, so one link cannot be replayed by parallel requests.
  Resetting or changing a password signs out every other device, and **Account settings** can do that on demand.
- CSRF: every state-changing request must come from the site’s own origin.
- Google sign-in: the authorisation code flow with PKCE, a state value and a nonce, kept in a signed cookie that lasts ten minutes and
  is used once. The ID token's issuer, audience, expiry, nonce and confirmed address are checked before anyone is signed in.
- Online payments: credits only for what SSLCommerz’s validation API confirms (status, transaction, amount), added once in a
  transaction however many notices arrive. The store password is used only on the server, and card details never reach the site.
- Rate limits (stored in Postgres): login, register, password reset, issuing, uploads, reports, checkouts.
- Quotas are enforced in a database transaction with a row lock, so parallel requests can’t exceed them.
- Uploads: content-sniffed (PNG/JPEG/WebP only), re-encoded with sharp to strip metadata, 4 MB limit. Signatures are private to their owner.
- Headers: strict CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- IP addresses are stored only as keyed hashes.

---

## Run locally

Needs Node 20.9 or newer to run, 22.12 or newer for the tests (`.nvmrc` pins 22), and a Postgres database.

```bash
npm install
cp .env.example .env.local        # then set DATABASE_URL in it
npm run -s keys:generate >> .env.local
npm run db:migrate
npm run dev                       # http://localhost:3000
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build / server |
| `npm run typecheck` | TypeScript check |
| `npm test` | unit and database tests (see “Testing”) |
| `npm run test:e2e` | end-to-end tests against a built copy of the app |
| `npm run db:generate` | create a new migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run keys:generate` | new signing keys |
| `npm run admin:promote -- email` | make an account admin |
| `npm run previews` | redraw the template pictures in `public/previews/` (needs `npm run dev` running, and Playwright) |

The template pictures on the public pages are images made by the real certificate renderer, so they cost visitors no
JavaScript. After changing a template in `src/lib/presets.ts`, run `npm run previews` while the development server is up and
commit the new files; a unit test fails if a template has no picture or a picture of the wrong shape.

If `npm run dev` reloads the page over and over after upgrading Next.js, stop it, delete `.next/dev`, and start it again.

## Testing
Tests that touch the database delete and insert rows, so they use their own database and refuse to run against one
whose name does not contain `test`:

```bash
createdb attesta_test
export TEST_DATABASE_URL=postgres://user:password@127.0.0.1:5432/attesta_test

npm test               # unit tests, and tests against the real database (skipped without TEST_DATABASE_URL)
npm run build
npm run test:e2e       # starts the built app, with stand-ins for the mail provider, Google and SSLCommerz, and drives it over HTTP
```

`npm test` covers the signing and serial rules, design and CSV handling, password hashing, image re-encoding, redirects,
one-time links, rate limits and the CSV export. `npm run test:e2e` covers what a person does: sign up (with a password or with Google), confirm by email, issue,
verify, revoke, reset a password, export, pay (online, including forged and repeated notices, or by transaction ID), issue ID
cards (with photos, valid-until dates and expiry), the admin screens, and what search engines are told. It refuses to run if the build is
older than the source. GitHub Actions runs the type check, both suites and the build on every pull request and every push to `main`
(`.github/workflows/ci.yml`).

## Project map
```
src/app/(site)/        public pages: landing, templates, certificate-maker (use cases), verify, pricing, legal
src/app/preview/       development-only pages that scripts/render-previews.mjs photographs
src/app/(auth)/        sign in, register, password reset, email confirmation
src/app/create/        the certificate editor
src/app/app/           user panel: certificates, batches, bulk, templates, library, organisation, billing, settings
src/app/admin/         admin panel
src/app/api/           all server endpoints
src/components/editor/ editor, canvas renderer, PDF builder, A4 card sheets, photos
src/components/bulk/   CSV bulk issuing
src/components/ui/     shared styles, and the in-page dialogs and toasts
src/lib/               database schema, auth, signing, quotas, presets, site config
src/lib/payments/      SSLCommerz checkout, validation and settlement
drizzle/               SQL migrations
tests/unit/            logic with no database
tests/integration/     logic against a real Postgres
tests/e2e/             the built app, over HTTP
```

## Scaling notes
- Images are stored in Postgres (simple, private). If storage grows past a few GB, move `assets.bytes` to Cloudflare R2 or S3.
- The rate limiter uses Postgres; at very high traffic, swap `src/lib/security/rate-limit.ts` for Upstash Redis.
- A daily Vercel Cron job (`vercel.json`) clears expired sessions, tokens and rate-limit rows.
