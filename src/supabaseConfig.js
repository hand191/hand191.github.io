export const SUPABASE_URL = "https://bmpklgjyqvxwkuvlnhmi.supabase.co";
export const SUPABASE_ANON_KEY =
  "sb_publishable_gKyIEllCTpKJqtYJ7A6mng_8iMBxcwJ";
export const CLOUD_RECORDS_TABLE = "entries";
export const CLOUD_COMMENTS_TABLE = "entry_comments";
export const CLOUD_IMAGES_BUCKET = "entry-images";
export const DROP_RECORDS_TABLE = "drop_entries";
export const DROP_IMAGES_BUCKET = "drop-images";
export const FAMILY_ACCESS_CODE = "home2026";
export const ADVANCED_ACCESS_CODE = "admin2026";

export function isCloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
