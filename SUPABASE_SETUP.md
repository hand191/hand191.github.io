# Supabase setup

Run this SQL in Supabase SQL Editor:

```sql
create table if not exists public.entries (
  id text primary key,
  content_html text not null,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "Allow public read entries"
on public.entries
for select
using (true);

create policy "Allow public insert entries"
on public.entries
for insert
with check (true);
```

Then copy your project URL and anon public key into:

```js
// src/supabaseConfig.js
export const SUPABASE_URL = "https://your-project.supabase.co";
export const SUPABASE_ANON_KEY = "your-anon-public-key";
```

Phase 1 only syncs text records. Records with pasted screenshots remain local until Storage support is added.
