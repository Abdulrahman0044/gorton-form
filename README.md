# Gorton Capacity Building Nomination — Next.js + Supabase

The six-step nomination app is built with **Next.js (client + server)**, **Supabase-managed PostgreSQL** and **private Supabase Storage**. Drafts—including the uploaded letter—remain on the applicant's device with IndexedDB, so a form can be resumed on the *same browser and website address*. The app is an installable PWA after HTTPS deployment.

**No Hostinger database or self-managed PostgreSQL instance is required.** Supabase is the backend data/storage provider, **not** the host for the Next.js server. Deploy the Next.js app on a Node.js host (Docker, Railway, Render, Vercel, etc.). For production, a private ClamAV scanner must be reachable by the Next.js server or PDF/image uploads will be rejected.

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard and create a Supabase project in a suitable region. Save your database password securely.
2. In **SQL Editor**, paste `database/schema.sql` and run it. This creates `nominations`, `beneficiaries`, and `nomination_letters` tables. It turns on Row Level Security and revokes direct `anon`/`authenticated` access: the browser **does not talk directly** to these private tables.
3. In **Storage**, create a new bucket with EXACT name `nomination-letters`. Set it to **Private** (do NOT enable public access). Set **Max file size** to **10 MB**; restrict allowed types to `application/pdf`, `image/png`, `image/jpeg`, and `image/webp`. Do not grant the anonymous role any bucket/object policies.
4. In **Project Settings → API Keys**, get the **secret** key (`sb_secret_...`). Use it **only** as `SUPABASE_SECRET_KEY` in your server's environment. Never paste it into client-side code, chat messages, or Git. The project URL (`https://<ref>.supabase.co`) is `SUPABASE_URL`.
5. Select **Connect** in the Supabase Dashboard to get the **actual connection URL**. Do not guess the pooler hostname or compose it from your project reference. Copy the full pooler URL with its exact user, hostname, and port. Replace the database password placeholder; percent-encode special characters in the password. This is `DATABASE_URL`.

**Pooler selection:** Serverless hosting (e.g. Vercel) normally uses the **Transaction pooler, port 6543**, with `DB_POOL_SIZE=1`. A long-running container on an IPv4-only host can use the **Session pooler, port 5432**. On an IPv6-capable persistent server, direct PostgreSQL is an option. The project uses `pg` with unnamed parameterized statements; no named prepared statements are used (transaction mode does not support them). TLS certificate verification is enabled for remote PostgreSQL.

## 2. Configure Next.js locally

Node.js 20.9+ and npm are required.

```bash
npm install
cp .env.example .env.local
# edit .env.local with YOUR Supabase pooler URL, Supabase project URL, secret key,
# exact APP_ORIGIN, strong ADMIN_PASSWORD and SESSION_SECRET
npm run dev
```

Windows PowerShell uses `Copy-Item .env.example .env.local` instead of `cp`.

- Public form: `http://localhost:3000`
- Admin login: `http://localhost:3000/admin`
- Health probe: `http://localhost:3000/api/health`
- Local-only trial uploads can run without a scanner in `NODE_ENV=development` (this is NOT safe for public release).

The app checks that the browser submission's `Origin` header matches `APP_ORIGIN` exactly, so set it to `http://localhost:3000` for local tests.

## 3. Deploy the Next.js server

### Docker deployment (Next.js + private ClamAV; Supabase remote)

This project includes an optional `compose.yaml` running only **Next.js** and **ClamAV**. It no longer runs a PostgreSQL container. On a Linux machine with Docker:

```bash
cp .env.compose.example .env
# edit .env, keeping the database password/secret key outside Git
# Set APP_ORIGIN to your final https:// hostname
docker compose up -d --build
```

Run behind an HTTPS reverse proxy and configure it to overwrite (not pass through) `X-Real-IP`. The supplied Compose file binds Next.js to localhost on port 3000 and exposes neither ClamAV nor PostgreSQL to the internet. Ensure sufficient server RAM for ClamAV signature loading. ClamAV may take time to initialize.

### Vercel or another serverless host

You may deploy Next.js to Vercel and point `DATABASE_URL` at Supabase's **Transaction pooler**. Set the same secret environment variables in Vercel, plus `APP_ORIGIN` to your final HTTPS URL. **Important:** The application deliberately fails closed on production uploads if a reachable malware scanner is absent. The bundled ClamAV container is not automatically available in serverless hosting. Set up a secured private scanning service and configure `CLAMAV_HOST` / `CLAMAV_PORT`, or add a separate safe scanning integration before accepting real nominations. Do not disable this protection in production.

## 4. What goes where?

| Data | Stored in |
|---|---|
| Institution, focal person, officer, 16 beneficiaries | Supabase PostgreSQL private tables |
| Nomination letter (PDF / JPG / PNG / WebP, max 10 MB) | Supabase Storage private `nomination-letters` bucket |
| Letter path, MIME, filename, size | Supabase PostgreSQL `nomination_letters` table |
| Unfinished form, step number, uploaded letter | IndexedDB on the user's device (text fallback to localStorage) |
| Admin password and Supabase secrets | Next.js server environment (not browser) |

Upon successful submission, the draft and local letter are removed and a submission reference remains on the device. The admin API verifies the administrator session before fetching a private Storage object. A new random file path is created for each upload; original filenames never appear in the storage key.

The database transaction writes the institution, 16 beneficiaries, and file metadata together. The private Storage upload precedes the SQL transaction. A failed SQL transaction attempts to delete the newly uploaded file; however, PostgreSQL and object storage do **not** share a distributed transaction. Interrupted requests can leave orphan files, so add periodic orphan-file reconciliation and alerting for production scale.

## 5. Keep drafts on the device

- Autosave as information is entered, using browser IndexedDB. Letter files are stored as local blobs, not just filenames.
- A previously visited PWA can usually be reopened for offline editing if its assets were cached. Submitting requires internet access.
- **Same device, same browser profile, same domain** is required. Clearing website data, private mode, storage eviction, or changing domain/browser may remove drafts. Local data is not automatically synced to Supabase.
- Use private trusted devices. Draft staff information is not encrypted at rest beyond device/browser protections.

## 6. Production checklist

- [ ] Supabase schema runs successfully; all three tables have RLS enabled and no public access.
- [ ] The `nomination-letters` Storage bucket is PRIVATE, max 10 MB, MIME allowlist, no public policies.
- [ ] Server secrets are configured and NEVER prefixed `NEXT_PUBLIC_`.
- [ ] Exact HTTPS `APP_ORIGIN` is configured. Test `GET /api/health`.
- [ ] Real upload-scanning service is private, updated, and tested; clean files accepted, malware test signature rejected.
- [ ] Enter some data, close/reopen browser, and verify data/file restoration.
- [ ] Submit exactly 16 beneficiaries; verify PostgreSQL records and private letter download in `/admin`.
- [ ] Retry the same `clientSubmissionId` and verify same reference, not a duplicate.
- [ ] Run `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, and security review on the deployment machine.
- [ ] Configure backups, retention periods, a secure administrator account with MFA and reliable shared abuse-rate limiting.
- [ ] Verify the downloaded source ZIP with its SHA-256 checksum. Do not ignore an antivirus warning.

## 7. Status and security notes

This deliverable is **source code**, not a running deployment. Code-level syntax checks can be run in the packaging environment, but no credentials were provided for Supabase; the actual database queries, Storage upload/download, production ClamAV scanning, and full Next.js build have **not** been end-to-end verified. No malware-free certification or guarantee is claimed. See `SECURITY_NOTES.md`.

## Reference documentation

- Supabase connection methods: https://supabase.com/docs/guides/database/connecting-to-postgres
- Private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- New secret API keys: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- RLS and grants: https://supabase.com/docs/guides/database/postgres/row-level-security
