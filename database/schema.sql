-- Run in the Supabase SQL Editor for a NEW Supabase project.
-- Tables use the public schema, but no Data API access is granted.
-- If upgrading an existing populated installation, perform a separate data migration.
BEGIN;
CREATE TABLE IF NOT EXISTS nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_submission_id UUID NOT NULL UNIQUE,
  reference VARCHAR(30) NOT NULL UNIQUE,
  institution_name VARCHAR(200) NOT NULL,
  institution_type VARCHAR(80) NOT NULL,
  institution_state VARCHAR(80) NOT NULL,
  institution_zone VARCHAR(80) NOT NULL,
  institution_email VARCHAR(254) NOT NULL,
  focal_person JSONB NOT NULL,
  nominating_officer JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS beneficiaries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nomination_id UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 16),
  full_name VARCHAR(150) NOT NULL,
  staff_id VARCHAR(80) NOT NULL,
  department VARCHAR(150) NOT NULL,
  designation VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  whatsapp VARCHAR(24) NOT NULL,
  UNIQUE (nomination_id, position)
);
CREATE TABLE IF NOT EXISTS nomination_letters (
  nomination_id UUID PRIMARY KEY REFERENCES nominations(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  storage_path TEXT NOT NULL UNIQUE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nominations_submitted_at ON nominations (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_nomination ON beneficiaries (nomination_id,position);
-- No public Data API access to private nomination data.
ALTER TABLE public.nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomination_letters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nominations, public.beneficiaries, public.nomination_letters FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.beneficiaries_id_seq FROM anon, authenticated;
-- Do not create public RLS policies for these tables; only trusted Next.js server
-- connects using DATABASE_URL. Supabase Storage must also be a PRIVATE bucket.
COMMIT;
