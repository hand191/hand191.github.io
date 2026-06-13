export const SUPABASE_URL = "https://bmpklgjyqvxwkuvlnhmi.supabase.co";
export const SUPABASE_ANON_KEY =
  "sb_publishable_gKyIEllCTpKJqtYJ7A6mng_8iMBxcwJ";
export const CLOUD_RECORDS_TABLE = "entries";
export const CLOUD_IMAGES_BUCKET = "entry-images";

export function isCloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
