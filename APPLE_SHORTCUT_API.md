# Apple Shortcuts API

This site is hosted on GitHub Pages, so it cannot run a server-side API by itself.
Use the Supabase REST API as the API layer for Apple Shortcuts.

## Write a new entry

Request:

```text
POST https://bmpklgjyqvxwkuvlnhmi.supabase.co/rest/v1/entries
```

Headers:

```text
apikey: sb_publishable_gKyIEllCTpKJqtYJ7A6mng_8iMBxcwJ
Authorization: Bearer sb_publishable_gKyIEllCTpKJqtYJ7A6mng_8iMBxcwJ
Content-Type: application/json
Prefer: return=representation
```

JSON body:

```json
{
  "id": "PUT-A-UUID-HERE",
  "parent_id": null,
  "content_html": "Text from Apple Shortcuts",
  "comments": [],
  "author_id": "me",
  "author_color": "blue"
}
```

The database will fill `created_at` automatically.

## Read recent entries

Request:

```text
GET https://bmpklgjyqvxwkuvlnhmi.supabase.co/rest/v1/entries?select=id,parent_id,content_html,created_at,comments,author_id,author_color&order=created_at.desc&limit=20
```

Use the same `apikey` and `Authorization` headers.

## Apple Shortcuts setup

1. Add `Text` or `Ask for Input`.
2. Add `Generate UUID`.
3. Add `Dictionary` with these keys:
   - `id`: generated UUID
   - `parent_id`: empty value
   - `content_html`: input text
   - `comments`: empty list
   - `author_id`: `me` or `wife`
   - `author_color`: `blue` or `red`
4. Add `Get Contents of URL`.
5. Set method to `POST`.
6. Set request body to `JSON`.
7. Add the headers listed above.
8. Run the shortcut.
9. Open the website and press `重拉` to reload from Supabase.

## Two-person color setup

Create two shortcuts, one for each person.

Shortcut A:

```json
{
  "author_id": "me",
  "author_color": "blue"
}
```

Shortcut B:

```json
{
  "author_id": "wife",
  "author_color": "red"
}
```

The website only uses `author_color` to color the entry border. It does not show
the user name or expose a user selector on the page.

## Security note

This is convenient, but the current database policy allows public insert/update.
For a private personal API, the next upgrade should be a Supabase Edge Function
with a secret token, so only your shortcuts can write entries.
