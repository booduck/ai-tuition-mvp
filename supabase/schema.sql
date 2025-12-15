-- Enable pgvector
create extension if not exists vector;

-- Content chunks for RAG
create table if not exists public.content_chunks (
  id bigserial primary key,
  subject text not null,
  year int not null,
  source text not null,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  file_url text,
  file_name text,
  file_type text,
  created_at timestamptz not null default now()
);

create index if not exists content_chunks_subject_year_idx
  on public.content_chunks (subject, year);

create index if not exists content_chunks_embedding_idx
  on public.content_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Minimal message log (optional)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  child_id text not null,
  subject text not null,
  year int not null,
  role text not null check (role in ('kid','tutor')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Quiz attempts
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  child_id text not null,
  subject text not null,
  year int not null,
  topic text not null,
  score int not null default 0,
  total int not null default 0,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Vector search function
create or replace function public.match_content_chunks(
  query_embedding vector(1536),
  match_count int,
  p_subject text,
  p_year int
)
returns table (
  id bigint,
  content text,
  source text,
  similarity float
)
language sql stable
as $$
  select
    cc.id,
    cc.content,
    cc.source,
    1 - (cc.embedding <=> query_embedding) as similarity
  from public.content_chunks cc
  where cc.subject = p_subject
    and cc.year = p_year
  order by cc.embedding <=> query_embedding
  limit match_count;
$$;
