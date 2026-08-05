import { createClient } from "@supabase/supabase-js";

import { env, parseCsv } from "@/src/lib/server/env";

import type {
  CreateDownloadUrlResult,
  CreateUploadUrlResult,
  FileListResult,
  StoredFile,
  StoredFileStatus,
  UploadUrlRequest,
} from "./types";

const DEFAULT_PAGE_SIZE = 25;
const DOWNLOAD_URL_TTL_SECONDS = 60;
const MANIFEST_FOLDER = "private/system/files/manifests";

type AdapterActor = {
  sub: string;
  isFileAdmin: boolean;
  uploadLimitBytes: number;
};

type AdapterListOptions = {
  cursor?: string | null;
  ownerSub?: string | null;
  limit?: number;
};

type AdapterConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  maxBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
};

type FileManifest = StoredFile & {
  updatedAt?: string;
};

type StorageObject = {
  name?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    mimetype?: string;
    size?: number;
  };
};

function requireSupabaseConfig(): AdapterConfig {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_STORAGE_BUCKET) {
    throw new Error(
      "Supabase storage is not configured. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET.",
    );
  }

  return {
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_STORAGE_BUCKET,
    maxBytes: env.FILE_UPLOAD_MAX_BYTES,
    allowedMimeTypes: parseCsv(env.FILE_ALLOWED_MIME_TYPES),
    allowedExtensions: parseCsv(env.FILE_ALLOWED_EXTENSIONS).map((value) =>
      value.toLowerCase().replace(/^\./, ""),
    ),
  };
}

function createSupabaseAdminClient() {
  const config = requireSupabaseConfig();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizeFilename(filename: string) {
  const normalized = filename
    .normalize("NFKC")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "file";
}

function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function buildObjectKey(ownerSub: string, fileId: string, filename: string) {
  return `private/users/${ownerSub}/${fileId}/${sanitizeFilename(filename)}`;
}

function buildManifestKey(fileId: string) {
  return `${MANIFEST_FOLDER}/${fileId}.json`;
}

function buildManifest(ownerSub: string, fileId: string, objectKey: string, request: UploadUrlRequest) {
  return {
    id: fileId,
    ownerSub,
    bucket: requireSupabaseConfig().bucket,
    objectKey,
    originalFilename: request.filename,
    mimeType: request.mimeType || undefined,
    sizeBytes: request.sizeBytes,
    status: "pending" as const,
    visibility: request.visibility ?? "private",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function encodeCursor(offset: number) {
  return String(offset);
}

function canAccessFile(actor: AdapterActor, ownerSub: string) {
  return actor.isFileAdmin || actor.sub === ownerSub;
}

function assertAllowedFile(request: UploadUrlRequest, config: AdapterConfig, actor: AdapterActor, usedBytes: number) {
  const trimmedFilename = request.filename?.trim();

  if (!trimmedFilename) {
    throw new Error("Filename is required.");
  }

  const maxBytes = actor.uploadLimitBytes;

  if (typeof request.sizeBytes === "number" && request.sizeBytes > maxBytes) {
    throw new Error(`File exceeds the maximum allowed size of ${maxBytes} bytes.`);
  }

  if (typeof request.sizeBytes === "number" && usedBytes + request.sizeBytes > maxBytes) {
    throw new Error(`Upload limit exceeded. ${Math.max(maxBytes - usedBytes, 0)} bytes remaining.`);
  }

  const extension = getFileExtension(trimmedFilename);
  const mimeType = request.mimeType?.trim();
  const mimeAllowed =
    !config.allowedMimeTypes.length || (mimeType ? config.allowedMimeTypes.includes(mimeType) : false);
  const extensionAllowed =
    !config.allowedExtensions.length || (extension ? config.allowedExtensions.includes(extension) : false);

  if ((config.allowedMimeTypes.length || config.allowedExtensions.length) && !mimeAllowed && !extensionAllowed) {
    throw new Error("File type is not allowed.");
  }
}

async function writeManifest(manifest: FileManifest) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(manifest.bucket)
    .upload(buildManifestKey(manifest.id), JSON.stringify(manifest), {
      upsert: true,
      contentType: "application/json",
    });

  if (error) {
    throw new Error(`Failed to write file manifest: ${error.message}`);
  }
}

async function readManifest(fileId: string) {
  const config = requireSupabaseConfig();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(config.bucket).download(buildManifestKey(fileId));

  if (error) {
    return null;
  }

  const text = await data.text();
  return JSON.parse(text) as FileManifest;
}

async function getObjectInfo(bucket: string, objectKey: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).info(objectKey);

  if (error) {
    return null;
  }

  return data as StorageObject;
}

function mergeManifestWithObjectInfo(manifest: FileManifest, objectInfo: StorageObject | null): FileManifest {
  if (!objectInfo) {
    return manifest;
  }

  const nextStatus: StoredFileStatus =
    manifest.status === "rejected" ? "rejected" : manifest.status === "verified" ? "verified" : "uploaded";

  return {
    ...manifest,
    mimeType: manifest.mimeType ?? objectInfo.metadata?.mimetype ?? undefined,
    sizeBytes:
      typeof manifest.sizeBytes === "number"
        ? manifest.sizeBytes
        : typeof objectInfo.metadata?.size === "number"
          ? objectInfo.metadata.size
          : undefined,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

async function hydrateManifest(manifest: FileManifest) {
  const hydrated = mergeManifestWithObjectInfo(manifest, await getObjectInfo(manifest.bucket, manifest.objectKey));

  if (
    hydrated.status !== manifest.status ||
    hydrated.sizeBytes !== manifest.sizeBytes ||
    hydrated.mimeType !== manifest.mimeType
  ) {
    await writeManifest(hydrated);
  }

  return hydrated;
}

async function listManifestFiles(ownerSub: string, limit: number, offset: number) {
  const config = requireSupabaseConfig();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(config.bucket).list(MANIFEST_FOLDER, {
    limit: Math.min(limit * 4, 100),
    offset,
    sortBy: { column: "name", order: "desc" },
  });

  if (error) {
    throw new Error(`Failed to list file manifests: ${error.message}`);
  }

  const manifests: FileManifest[] = [];

  for (const item of data ?? []) {
    if (!item.name.endsWith(".json")) {
      continue;
    }

    const manifest = await readManifest(item.name.replace(/\.json$/, ""));

    if (manifest && manifest.ownerSub === ownerSub) {
      manifests.push(manifest);
    }

    if (manifests.length >= limit) {
      break;
    }
  }

  return manifests;
}

function sumFileBytes(files: StoredFile[]) {
  return files.reduce((total, file) => total + (typeof file.sizeBytes === "number" ? file.sizeBytes : 0), 0);
}

export async function createSupabaseUploadUrl(
  actor: AdapterActor,
  request: UploadUrlRequest,
): Promise<CreateUploadUrlResult> {
  const config = requireSupabaseConfig();
  const currentListing = await listSupabaseFiles(actor, { ownerSub: actor.sub, limit: 10_000 });
  assertAllowedFile(request, config, actor, currentListing.quota.usedBytes);

  const fileId = crypto.randomUUID();
  const objectKey = buildObjectKey(actor.sub, fileId, request.filename);
  const manifest = buildManifest(actor.sub, fileId, objectKey, request);
  await writeManifest(manifest);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(config.bucket).createSignedUploadUrl(objectKey);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Failed to create signed upload URL.");
  }

  return {
    file: manifest,
    uploadUrl: data.signedUrl,
    uploadMethod: "PUT",
    uploadHeaders: request.mimeType ? { "Content-Type": request.mimeType } : {},
  };
}

export async function listSupabaseFiles(
  actor: AdapterActor,
  options: AdapterListOptions = {},
): Promise<FileListResult> {
  const ownerSub = options.ownerSub && actor.isFileAdmin ? options.ownerSub : actor.sub;
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), 100);
  const offset = decodeCursor(options.cursor);
  const manifests = await listManifestFiles(ownerSub, limit, offset);
  const files = await Promise.all(manifests.map(hydrateManifest));
  const allOwnerManifests = await listManifestFiles(ownerSub, 10_000, 0);
  const allOwnerFiles = await Promise.all(allOwnerManifests.map(hydrateManifest));
  const maxBytes = actor.uploadLimitBytes;
  const usedBytes = sumFileBytes(allOwnerFiles);

  return {
    files: files
      .filter((file) => canAccessFile(actor, file.ownerSub))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    nextCursor: manifests.length >= limit ? encodeCursor(offset + limit) : null,
    quota: {
      usedBytes,
      maxBytes,
      remainingBytes: Math.max(maxBytes - usedBytes, 0),
    },
  };
}

export async function createSupabaseDownloadUrl(
  actor: AdapterActor,
  fileId: string,
): Promise<CreateDownloadUrlResult> {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  const hydrated = await hydrateManifest(manifest);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(hydrated.bucket)
    .createSignedUrl(hydrated.objectKey, DOWNLOAD_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Failed to create signed download URL.");
  }

  return {
    file: hydrated,
    downloadUrl: data.signedUrl,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  };
}

export async function deleteSupabaseFile(actor: AdapterActor, fileId: string) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(manifest.bucket)
    .remove([manifest.objectKey, buildManifestKey(fileId)]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }

  return { id: fileId };
}
