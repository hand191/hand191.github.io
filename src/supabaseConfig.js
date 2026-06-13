export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
export const CLOUD_RECORDS_TABLE = "entries";

export function isCloudConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
