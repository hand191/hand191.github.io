import {
  CLOUD_COMMENTS_TABLE,
  CLOUD_IMAGES_BUCKET,
  CLOUD_RECORDS_TABLE,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isCloudConfigured,
} from "./supabaseConfig.js?v=20260619-3";

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

  if (options.includeTodo !== false) {
    databaseRecord.is_todo = Boolean(record.isTodo);
    databaseRecord.todo_done = Boolean(record.todoDone);
  }

  if (options.includeMarker !== false) {
    databaseRecord.entry_marker = record.entryMarker || null;
  }

  if (options.includeHidden !== false) {
    databaseRecord.is_hidden = Boolean(record.isHidden);
  }

  if (options.includeAuthor !== false) {
    databaseRecord.author_id = record.authorId || null;
    databaseRecord.author_color = record.authorColor || null;
  }

  return databaseRecord;
}

function fromDatabaseRecord(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    contentHtml: row.content_html,
    createdAt: row.created_at,
    comments: [],
    authorId: row.author_id || null,
    authorColor: row.author_color || null,
    isTodo: Boolean(row.is_todo),
    todoDone: Boolean(row.todo_done),
    entryMarker: row.entry_marker || null,
    isHidden: Boolean(row.is_hidden),
  };
}

function toDatabaseComment(comment) {
  return {
    id: comment.id,
    entry_id: comment.entryId,
    text: comment.text,
    created_at: comment.createdAt,
    author_id: comment.authorId || null,
    author_color: comment.authorColor || null,
  };
}

function fromDatabaseComment(row) {
  return {
    id: row.id,
    entryId: row.entry_id,
    text: row.text,
    createdAt: row.created_at,
    authorId: row.author_id || null,
    authorColor: row.author_color || null,
  };
}

function attachComments(records, comments) {
  const commentsByRecordId = new Map();

  for (const comment of comments) {
    const recordComments = commentsByRecordId.get(comment.entryId) || [];
    recordComments.push(comment);
    commentsByRecordId.set(comment.entryId, recordComments);
  }

  return records.map((record) => ({
    ...record,
    comments: commentsByRecordId.get(record.id) || [],
  }));
}

async function loadCloudComments(client) {
  const { data, error } = await client
    .from(CLOUD_COMMENTS_TABLE)
    .select("id, entry_id, text, created_at, author_id, author_color")
    .order("created_at", { ascending: true });

  if (error?.message?.includes(CLOUD_COMMENTS_TABLE)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return data.map(fromDatabaseComment);
}

export async function loadCloudRecords() {
  const client = await getSupabaseClient();

  if (!client) {
    return null;
  }

  const selectRecords = (columns) => {
    return client
      .from(CLOUD_RECORDS_TABLE)
      .select(columns)
      .order("created_at", { ascending: false });
  };

  let { data, error } = await selectRecords(
    "id, parent_id, content_html, created_at, author_id, author_color, is_todo, todo_done, entry_marker, is_hidden"
  );

  if (error?.message?.includes("is_hidden")) {
    const fallback = await selectRecords(
      "id, parent_id, content_html, created_at, author_id, author_color, is_todo, todo_done, entry_marker"
    );

    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("entry_marker")) {
    const fallback = await selectRecords(
      "id, parent_id, content_html, created_at, author_id, author_color, is_todo, todo_done"
    );

    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("todo")) {
    const fallback = await selectRecords(
      "id, parent_id, content_html, created_at, author_id, author_color"
    );

    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("author_")) {
    const fallback = await selectRecords(
      "id, parent_id, content_html, created_at"
    );

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  const records = data.map(fromDatabaseRecord);
  const comments = await loadCloudComments(client);

  return attachComments(records, comments);
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
          .select("id")
      : client
          .from(CLOUD_RECORDS_TABLE)
          .upsert(toDatabaseRecord(record, writeOptions), {
            ignoreDuplicates: true,
            onConflict: "id",
          });
  };

  let writeOptions = {};
  let { data, error } = await writeRecord(writeOptions);

  if (
    error?.message?.includes("author_") &&
    !options.requireAuthor
  ) {
    writeOptions = {
      ...writeOptions,
      includeAuthor: false,
    };
    const fallback = await writeRecord(writeOptions);
    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("todo") && !options.requireTodo) {
    writeOptions = {
      ...writeOptions,
      includeTodo: false,
    };
    const fallback = await writeRecord(writeOptions);
    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("entry_marker") && !options.requireMarker) {
    writeOptions = {
      ...writeOptions,
      includeMarker: false,
    };
    const fallback = await writeRecord(writeOptions);
    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message?.includes("is_hidden") && !options.requireHidden) {
    writeOptions = {
      ...writeOptions,
      includeHidden: false,
    };
    const fallback = await writeRecord(writeOptions);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  if (options.updateExisting && Array.isArray(data) && data.length === 0) {
    throw new Error("数据库没有允许更新这条记录，请检查 entries 的 update policy");
  }

  return record;
}

export async function deleteCloudRecord(recordId) {
  const client = await getSupabaseClient();

  if (!client) {
    return null;
  }

  const { error: childUpdateError } = await client
    .from(CLOUD_RECORDS_TABLE)
    .update({ parent_id: null })
    .eq("parent_id", recordId);

  if (childUpdateError) {
    throw childUpdateError;
  }

  const { data, error } = await client
    .from(CLOUD_RECORDS_TABLE)
    .delete()
    .eq("id", recordId)
    .select("id");

  if (error) {
    throw error;
  }

  if (Array.isArray(data) && data.length === 0) {
    throw new Error("数据库没有允许删除这条记录，请检查 entries 的 delete policy");
  }

  return recordId;
}

export async function saveCloudComment(comment) {
  const client = await getSupabaseClient();

  if (!client) {
    return null;
  }

  const { error } = await client
    .from(CLOUD_COMMENTS_TABLE)
    .insert(toDatabaseComment(comment));

  if (error) {
    throw error;
  }

  return comment;
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
