# Supabase setup

Run this SQL in Supabase SQL Editor:

```sql
create table if not exists public.entries (
  id text primary key,
  parent_id text references public.entries(id),
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

For image sync, create a public Storage bucket named:

```text
entry-images
```

Then run this SQL:

```sql
create policy "Allow public image uploads"
on storage.objects
for insert
with check (bucket_id = 'entry-images');
```

The bucket should be public so pasted screenshots can be viewed from other devices through their public URLs.

If your `entries` table already exists, run this once to enable replies:

```sql
alter table public.entries
add column if not exists parent_id text references public.entries(id);
```
