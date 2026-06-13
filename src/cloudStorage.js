import {
  CLOUD_IMAGES_BUCKET,
  CLOUD_RECORDS_TABLE,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isCloudConfigured,
} from "./supabaseConfig.js?v=20260613-5";

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

function toDatabaseRecord(record, options = {}) {
  const databaseRecord = {
    id: record.id,
    parent_id: record.parentId,
    content_html: record.contentHtml,
    created_at: record.createdAt,
  };

  if (options.includeComments !== false) {
    databaseRecord.comments = record.comments || [];
  }

  return databaseRecord;
}

function fromDatabaseRecord(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    contentHtml: row.content_html,
    createdAt: row.created_at,
    comments: row.comments || [],
  };
}

export async function loadCloudRecords() {
  const client = await getSupabaseClient();

  if (!client) {
    return null;
  }

  let { data, error } = await client
    .from(CLOUD_RECORDS_TABLE)
    .select("id, parent_id, content_html, created_at, comments")
    .order("created_at", { ascending: false });

  if (error?.message?.includes("comments")) {
    const fallback = await client
      .from(CLOUD_RECORDS_TABLE)
      .select("id, parent_id, content_html, created_at")
      .order("created_at", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return data.map(fromDatabaseRecord);
}

export async function saveCloudRecord(record, options = {}) {
  const client = await getSupabaseClient();

  if (!client) {
    return null;
  }

  const writeRecord = (writeOptions = {}) => {
    return options.updateExisting
      ? client
          .from(CLOUD_RECORDS_TABLE)
          .update(toDatabaseRecord(record, writeOptions))
          .eq("id", record.id)
      : client
          .from(CLOUD_RECORDS_TABLE)
          .upsert(toDatabaseRecord(record, writeOptions), {
            ignoreDuplicates: true,
            onConflict: "id",
          });
  };

  let { error } = await writeRecord();

  if (
    error?.message?.includes("comments") &&
    !options.requireComments
  ) {
    const fallback = await writeRecord({ includeComments: false });
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return record;
}

export async function uploadCloudImage(fileBlob, draftId) {
  const client = await getSupabaseClient();

  if (!client) {
    return null;
  }

  const path = `${draftId}/${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.jpg`;

  const { error } = await client.storage
    .from(CLOUD_IMAGES_BUCKET)
    .upload(path, fileBlob, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = client.storage
    .from(CLOUD_IMAGES_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}
