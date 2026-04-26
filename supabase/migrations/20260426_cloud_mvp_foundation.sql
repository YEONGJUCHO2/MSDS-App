create table if not exists public.documents (
  document_id text primary key,
  file_name text not null,
  file_hash text not null,
  storage_path text not null,
  status text not null,
  uploaded_at timestamptz not null default now(),
  text_content text not null default '',
  page_count integer not null default 0
);

create table if not exists public.document_basic_info (
  document_id text not null references public.documents(document_id) on delete cascade,
  info_key text not null,
  label text not null,
  value text not null,
  source text not null,
  updated_at timestamptz not null default now(),
  primary key (document_id, info_key)
);

create table if not exists public.components (
  row_id text primary key,
  document_id text not null references public.documents(document_id) on delete cascade,
  row_index integer not null,
  raw_row_text text not null,
  cas_no_candidate text not null,
  chemical_name_candidate text not null,
  content_min_candidate text not null,
  content_max_candidate text not null,
  content_single_candidate text not null,
  content_text text not null,
  confidence double precision not null,
  evidence_location text not null,
  review_status text not null,
  ai_review_status text not null default 'not_reviewed',
  ai_review_note text not null default '',
  regulatory_match_status text not null default 'not_checked'
);

create table if not exists public.regulatory_matches (
  match_id text primary key,
  row_id text not null references public.components(row_id) on delete cascade,
  document_id text not null references public.documents(document_id) on delete cascade,
  cas_no text not null,
  category text not null,
  status text not null,
  source_type text not null,
  source_name text not null,
  source_url text not null,
  evidence_text text not null,
  checked_at timestamptz not null default now()
);

create table if not exists public.chemical_api_cache (
  cache_id text primary key,
  provider text not null,
  cas_no text not null,
  request_url text not null,
  response_text text not null,
  status text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  unique(provider, cas_no)
);

create table if not exists public.review_queue (
  queue_id text primary key,
  document_id text not null references public.documents(document_id) on delete cascade,
  entity_id text not null default '',
  field_type text not null,
  label text not null,
  candidate_value text not null,
  evidence text not null,
  review_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_components_document_id on public.components(document_id);
create index if not exists idx_review_queue_status on public.review_queue(review_status);
create index if not exists idx_regulatory_matches_row_id on public.regulatory_matches(row_id);
create index if not exists idx_regulatory_matches_document_id on public.regulatory_matches(document_id);
create index if not exists idx_chemical_api_cache_provider_cas on public.chemical_api_cache(provider, cas_no);

alter table public.documents enable row level security;
alter table public.document_basic_info enable row level security;
alter table public.components enable row level security;
alter table public.regulatory_matches enable row level security;
alter table public.chemical_api_cache enable row level security;
alter table public.review_queue enable row level security;
