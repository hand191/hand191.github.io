# Supabase setup

Run this SQL in Supabase SQL Editor:

```sql
create table if not exists public.entries (
  id text primary key,
  parent_id text references public.entries(id),
  content_html text not null,
  created_at timestamptz not null default now(),
  author_id text,
  author_color text,
  is_todo boolean not null default false,
  todo_done boolean not null default false,
  entry_marker text
);

create table if not exists public.entry_comments (
  id text primary key,
  entry_id text not null references public.entries(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  author_id text,
  author_color text
);

alter table public.entries enable row level security;
alter table public.entry_comments enable row level security;

create policy "Allow public read entries"
on public.entries
for select
using (true);

create policy "Allow public insert entries"
on public.entries
for insert
with check (true);

create policy "Allow public update entries"
on public.entries
for update
using (true)
with check (true);

create policy "Allow public read entry comments"
on public.entry_comments
for select
using (true);

create policy "Allow public insert entry comments"
on public.entry_comments
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

Apple Shortcuts can write directly through the Supabase REST API. See:

```text
APPLE_SHORTCUT_API.md
```

If your `entries` table already exists, run this once to enable replies, authors, and the separate comments table:

```sql
alter table public.entries
add column if not exists parent_id text references public.entries(id);

alter table public.entries
add column if not exists author_id text;

alter table public.entries
add column if not exists author_color text;

alter table public.entries
add column if not exists is_todo boolean not null default false;

alter table public.entries
add column if not exists todo_done boolean not null default false;

alter table public.entries
add column if not exists entry_marker text;

create table if not exists public.entry_comments (
  id text primary key,
  entry_id text not null references public.entries(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  author_id text,
  author_color text
);

drop policy if exists "Allow public update entries" on public.entries;

create policy "Allow public update entries"
on public.entries
for update
using (true)
with check (true);

-- This update policy is required for todo/check status, replies, and future
-- entry edits. Without it, the page may look clickable but Supabase updates
-- zero rows.

alter table public.entry_comments enable row level security;

drop policy if exists "Allow public read entry comments" on public.entry_comments;
drop policy if exists "Allow public insert entry comments" on public.entry_comments;

create policy "Allow public read entry comments"
on public.entry_comments
for select
using (true);

create policy "Allow public insert entry comments"
on public.entry_comments
for insert
with check (true);
```
