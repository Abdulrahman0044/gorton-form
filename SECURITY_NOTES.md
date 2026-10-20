# Security notes — Supabase edition (2026-10-20)

## Preserved security measures
- Next.js 15.5.28 / React 19.1.10 pinned from previously security-reviewed edition.
- Multipart request 12 MiB hard cap, validated PDF/JPG/PNG/WebP signatures, maximum 10 MiB file, typed form validation, exactly 16 beneficiaries, unique staff numbers.
- Production upload scanner is fail-closed when `clamd` is absent, and `clamd` must be a private connection.
- Exact browser Origin enforcement, server-only administrator password/session secret, HTTP-only cookies, parameterized SQL, idempotency by client UUID, spreadsheet-injection-safe CSV export.

## Changes for Supabase
- SQL storage now contains file metadata and a generated private object path, not document `BYTEA`.
- Supabase Storage uses a server-only secret API key, a PRIVATE bucket, random object keys, and no unauthenticated policies.
- Tables are protected by RLS and explicit revocation of public API roles. The server connects via TLS with the Postgres pooler URI from Supabase Dashboard.
- Admin letter download verifies session before a privileged Storage download; no public file links are exposed.
- Failed DB writes attempt to remove uploaded objects. The database and object store are not atomically coupled; crash recovery/orphan reconciliation remains necessary.

## Limitations
- Static checks are **not** proof of malware-free files.
- No live Supabase project credentials, npm registry, production ClamAV signatures, or Windows Defender scanning service was available to test against.
- No full Next.js build, end-to-end Storage/SQL transaction, or true penetration test has been done.
- Per-process rate limits are not reliable across serverless instances. Deploy a shared limiter/WAF, administrator MFA, backup/retention policy, and production observability before public service.
- Device drafts are not cryptographically encrypted inside IndexedDB; users should avoid shared devices.
- If migration from an already populated PostgreSQL database is needed, `database/schema.sql` is for a fresh project, NOT an in-place `file_bytes` to `storage_path` data migration.

Keep Windows Defender enabled; if a ZIP is flagged, request and investigate the full threat name and filename rather than bypassing the warning.
