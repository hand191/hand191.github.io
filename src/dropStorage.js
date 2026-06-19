import {
  DROP_IMAGES_BUCKET,
  DROP_RECORDS_TABLE,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isCloudConfigured,
} from "./supabaseConfig.js?v=20260619-7";

let supabaseClient;

async function getSupabaseClient() {
  if (!isCloudConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return supabaseClient;
}

function fromDatabaseDropEntry(row) {
  return {
    id: row.id,
    contentText: row.content_text || "",
    imageUrl: row.image_url || null,
    imageName: row.image_name || null,
    createdAt: row.created_at,
    isDeleted: Boolean(row.is_deleted),
  };
}

function toDatabaseDropEntry(entry) {
  return {
    id: entry.id,
    content_text: entry.contentText,
    image_url: entry.imageUrl,
    image_name: entry.imageName,
    created_at: entry.createdAt,
    is_deleted: false,
  };
}

export async function loadDropEntries() {
  const client = await getSupabaseClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from(DROP_RECORDS_TABLE)
    .select("id, content_text, image_url, image_name, created_at, is_deleted")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return data.map(fromDatabaseDropEntry);
}

export async function countTodayDropEntries() {
  const client = await getSupabaseClient();

  if (!client) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await client
    .from(DROP_RECORDS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false)
    .gte("created_at", today.toISOString());

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function saveDropEntry(entry) {
  const client = await getSupabaseClient();

  if (!client) {
    return entry;
  }

  const { error } = await client
    .from(DROP_RECORDS_TABLE)
    .insert(toDatabaseDropEntry(entry));

  if (error) {
    throw error;
  }

  return entry;
}

export async function deleteDropEntry(entryId) {
  const client = await getSupabaseClient();

  if (!client) {
    return;
  }

  const { error } = await client
    .from(DROP_RECORDS_TABLE)
    .update({ is_deleted: true })
    .eq("id", entryId);

  if (error) {
    throw error;
  }
}

export async function uploadDropImage(fileBlob, entryId) {
  const client = await getSupabaseClient();

  if (!client) {
    return null;
  }

  const path = `${entryId}/${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.jpg`;

  const { error } = await client.storage
    .from(DROP_IMAGES_BUCKET)
    .upload(path, fileBlob, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = client.storage
    .from(DROP_IMAGES_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
