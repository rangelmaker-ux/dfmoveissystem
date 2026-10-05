-- Additive pilot only. Existing business tables, users and storage objects are untouched.
CREATE TABLE public.drive_pilot_connections (
  owner_auth_id UUID PRIMARY KEY,
  google_email TEXT NOT NULL CHECK (google_email = 'rangelmaker@gmail.com'),
  encrypted_refresh_token TEXT NOT NULL,
  root_folder_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.drive_pilot_files (
  id UUID PRIMARY KEY,
  owner_auth_id UUID NOT NULL,
  project_id UUID NOT NULL,
  drive_file_id TEXT NOT NULL UNIQUE,
  folder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  source_path TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready')),
  md5_checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_auth_id, source_path)
);
CREATE INDEX drive_pilot_files_project_idx ON public.drive_pilot_files(owner_auth_id, project_id);
ALTER TABLE public.drive_pilot_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_pilot_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drive_pilot_connections, public.drive_pilot_files FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.drive_pilot_connections, public.drive_pilot_files TO service_role;
COMMENT ON TABLE public.drive_pilot_connections IS 'Server-only encrypted Google connection for the hidden administrator pilot.';
COMMENT ON TABLE public.drive_pilot_files IS 'Server-only Drive references. No automatic deletion of Supabase originals.';
