# Attesta — certificate generator with QR verification

Design certificates (from templates or your own artwork), issue one or thousands from CSV, and give every certificate a signed, permanent verification page.

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

> **Keep `SIGNING_PRIVATE_KEY` secret and backed up.** If it is lost, new certificates can still be issued with a new key,
> but if the *public* key is lost, older certificates can no longer show “signature confirmed”.
> Store all four values in a password manager.

> **Set `APP_URL` to your final domain before issuing real certificates.** QR codes printed on certificates contain this address.

### 5. Deploy
**Deployments → Redeploy**. The build log should show `Migrations applied.`

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
- `paymentMethods` — your bKash / Nagad numbers and bank details (currently placeholders `01XXXXXXXXX`)
- `site.name`, `supportEmail`, `operatedFrom` — “Attesta” is a placeholder brand name; rename it here
- `limits` — guest 2, free 5 per month, bulk max 5000 rows

**`src/app/(site)/privacy/page.tsx` and `terms/page.tsx`** — starting drafts; have a lawyer review them.

## Email
Without email configured, new accounts are active immediately and reset links only appear in the Vercel function logs.
For production, create a free account at resend.com, verify your domain, and set `RESEND_API_KEY` and `EMAIL_FROM`.
Accounts then need to confirm their email before issuing, which stops throwaway sign-ups from farming free certificates.

## Ads (AdSense)
Set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXX` and redeploy. Ads show on the landing page and certificate-type pages only.
Replace the placeholder slot IDs (`1000000001`, `1000000002`) in `src/app/(site)/page.tsx` and
`src/app/(site)/certificate-maker/[slug]/page.tsx` with slot IDs from your AdSense account.
The content security policy opens up for Google’s ad domains automatically when this variable is set.

---

## How payments work
1. A user picks a package on **Packages and billing**, pays by bKash / Nagad / bank, and submits the transaction ID.
2. You check it against your statement in **Admin → Payments** and press **Confirm**. Credits are added instantly.

Each transaction ID can only be submitted once, and a payment can only be confirmed once.
An automatic gateway (SSLCommerz, bKash PGW) can be added later in `src/app/api/billing/`.

## How verification works
- Every certificate gets a random serial like `ATT-7K2Q-9M4D-X1TB` (60 random bits, never sequential).
- The server signs a canonical record (serial, issuer, recipient, public fields, date, design hash) with Ed25519 and stores the signature.
- `/verify/SERIAL` re-checks the signature on every view. If anyone edits the database record, the page says the record can’t be confirmed.
- Revoked certificates keep their page, showing the date and reason, and are removed from search engines.
- Recipient names show as “First L.” by default; issuers can choose full or hidden per template.
- **Verified organisation**: the issuer adds a DNS TXT record proving domain control, then an admin approves it.

## How PDFs are made
PDFs are built **in the user’s browser**, not on the server. This keeps Bangla conjuncts correct (server PDF libraries break them),
makes the preview identical to the output, and lets 5,000-row batches run without serverless time limits or server cost.
The server only registers certificates (100 per request) and enforces quotas.
Borders, lines, seals and QR codes are vector; text is rendered at ~288 dpi.

## Security summary
- Passwords: scrypt (N=32768) with per-user salt. Sessions: random tokens, stored hashed, httpOnly + SameSite cookies.
- CSRF: every state-changing request must come from the site’s own origin.
- Rate limits (stored in Postgres): login, register, password reset, issuing, uploads, reports.
- Quotas are enforced in a database transaction with a row lock, so parallel requests can’t exceed them.
- Uploads: content-sniffed (PNG/JPEG/WebP only), re-encoded with sharp to strip metadata, 4 MB limit. Signatures are private to their owner.
- Headers: strict CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- IP addresses are stored only as keyed hashes.

---

## Run locally

```bash
npm install
cp .env.example .env.local        # fill in DATABASE_URL and the output of: npm run keys:generate
npm run db:migrate
npm run dev                       # http://localhost:3000
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build / server |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | create a new migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run keys:generate` | new signing keys |
| `npm run admin:promote -- email` | make an account admin |

## Project map
```
src/app/(site)/        public pages: landing, templates, certificate-maker/[slug], verify, pricing, legal
src/app/(auth)/        sign in, register, password reset, email confirmation
src/app/create/        the certificate editor
src/app/app/           user panel: certificates, bulk, templates, library, organisation, billing
src/app/admin/         admin panel
src/app/api/           all server endpoints
src/components/editor/ editor, canvas renderer, PDF builder
src/components/bulk/   CSV bulk issuing
src/lib/               database schema, auth, signing, quotas, presets, site config
drizzle/               SQL migrations
```

## Scaling notes
- Images are stored in Postgres (simple, private). If storage grows past a few GB, move `assets.bytes` to Cloudflare R2 or S3.
- The rate limiter uses Postgres; at very high traffic, swap `src/lib/security/rate-limit.ts` for Upstash Redis.
- A daily Vercel Cron job (`vercel.json`) clears expired sessions, tokens and rate-limit rows.
