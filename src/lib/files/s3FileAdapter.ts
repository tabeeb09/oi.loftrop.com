import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env, parseCsv } from "@/src/lib/server/env";
import {
  getPrivateStorageConfig,
  privateStorageRelativeKey,
  requireS3Credentials,
  toStorageObjectKey,
} from "@/src/lib/server/storage-project";

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
const UPLOAD_URL_TTL_SECONDS = 300;
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

type FileManifest = StoredFile & {
  updatedAt?: string;
};

type AdapterConfig = {
  bucket: string;
  endpoint: string;
  maxBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  region: string;
  keyPrefix: string;
};

function requireConfig(): AdapterConfig {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_PRIVATE_BUCKET) {
    throw new Error(
      "S3 file storage is not configured. Required: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PRIVATE_BUCKET.",
    );
  }

  const storage = getPrivateStorageConfig();
  requireS3Credentials();

  return {
    bucket: storage.bucket,
    endpoint: storage.endpoint,
    region: storage.region,
    keyPrefix: storage.keyPrefix,
    maxBytes: env.FILE_UPLOAD_MAX_BYTES,
    allowedMimeTypes: parseCsv(env.FILE_ALLOWED_MIME_TYPES),
    allowedExtensions: parseCsv(env.FILE_ALLOWED_EXTENSIONS).map((value) =>
      value.toLowerCase().replace(/^\./, ""),
    ),
  };
}

function createS3Client() {
  const config = requireConfig();

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
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
  const config = requireConfig();
  return toStorageObjectKey(config, `private/users/${ownerSub}/${fileId}/${sanitizeFilename(filename)}`);
}

function buildManifestKey(fileId: string) {
  const config = requireConfig();
  return toStorageObjectKey(config, `${MANIFEST_FOLDER}/${fileId}.json`);
}

function buildManifest(ownerSub: string, fileId: string, objectKey: string, request: UploadUrlRequest): FileManifest {
  const config = requireConfig();

  return {
    id: fileId,
    ownerSub,
    bucket: config.bucket,
    objectKey,
    originalFilename: request.filename,
    mimeType: request.mimeType || undefined,
    sizeBytes: request.sizeBytes,
    status: "pending",
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

async function ensureBucketExists(bucket: string) {
  const client = createS3Client();
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
}

async function writeManifest(manifest: FileManifest) {
  await ensureBucketExists(manifest.bucket);
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: manifest.bucket,
      Key: buildManifestKey(manifest.id),
      Body: JSON.stringify(manifest),
      ContentType: "application/json",
    }),
  );
}

async function readManifest(fileId: string) {
  const config = requireConfig();
  const client = createS3Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: buildManifestKey(fileId),
      }),
    );

    const text = await response.Body?.transformToString();
    return text ? (JSON.parse(text) as FileManifest) : null;
  } catch {
    return null;
  }
}

async function getObjectInfo(bucket: string, objectKey: string) {
  const client = createS3Client();

  try {
    return await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
    );
  } catch {
    return null;
  }
}

function mergeManifestWithObjectInfo(manifest: FileManifest, objectInfo: Awaited<ReturnType<typeof getObjectInfo>>) {
  if (!objectInfo) {
    return manifest;
  }

  const nextStatus: StoredFileStatus =
    manifest.status === "rejected" ? "rejected" : manifest.status === "verified" ? "verified" : "uploaded";

  return {
    ...manifest,
    mimeType: manifest.mimeType ?? objectInfo.ContentType ?? undefined,
    sizeBytes:
      typeof manifest.sizeBytes === "number"
        ? manifest.sizeBytes
        : typeof objectInfo.ContentLength === "number"
          ? objectInfo.ContentLength
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
  const config = requireConfig();
  const client = createS3Client();
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: toStorageObjectKey(config, `${MANIFEST_FOLDER}/`),
      MaxKeys: Math.min(limit * 4, 100),
    }),
  );

  const keys = (response.Contents ?? [])
    .map((item) => item.Key)
    .filter((key): key is string => Boolean(key) && key.endsWith(".json"))
    .sort()
    .reverse()
    .slice(offset, offset + Math.min(limit * 4, 100));

  const manifests: FileManifest[] = [];

  for (const key of keys) {
    const relativeKey = privateStorageRelativeKey(key);
    const manifest = await readManifest(relativeKey.replace(`${MANIFEST_FOLDER}/`, "").replace(/\.json$/, ""));

    if (manifest && manifest.ownerSub === ownerSub) {
      manifests.push(manifest);
    }

    if (manifests.length >= limit) {
      break;
    }
  }

  return {
    manifests,
    scannedCount: keys.length,
    totalListedCount: (response.Contents ?? []).length,
  };
}

function sumFileBytes(files: StoredFile[]) {
  return files.reduce((total, file) => total + (typeof file.sizeBytes === "number" ? file.sizeBytes : 0), 0);
}

export async function createS3UploadUrl(
  actor: AdapterActor,
  request: UploadUrlRequest,
): Promise<CreateUploadUrlResult> {
  const config = requireConfig();
  const currentListing = await listS3Files(actor, { ownerSub: actor.sub, limit: 10_000 });
  assertAllowedFile(request, config, actor, currentListing.quota.usedBytes);

  const fileId = crypto.randomUUID();
  const objectKey = buildObjectKey(actor.sub, fileId, request.filename);
  const manifest = buildManifest(actor.sub, fileId, objectKey, request);
  await writeManifest(manifest);

  const client = createS3Client();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: request.mimeType || "application/octet-stream",
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return {
    file: manifest,
    uploadUrl,
    uploadMethod: "PUT",
    uploadHeaders: request.mimeType ? { "Content-Type": request.mimeType } : {},
  };
}

export async function listS3Files(
  actor: AdapterActor,
  options: AdapterListOptions = {},
): Promise<FileListResult> {
  const ownerSub = options.ownerSub && actor.isFileAdmin ? options.ownerSub : actor.sub;
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), 100);
  const offset = decodeCursor(options.cursor);
  const { manifests, totalListedCount } = await listManifestFiles(ownerSub, limit, offset);
  const files = await Promise.all(manifests.map(hydrateManifest));
  const { manifests: allOwnerManifests } = await listManifestFiles(ownerSub, 10_000, 0);
  const allOwnerFiles = await Promise.all(allOwnerManifests.map(hydrateManifest));
  const totalForOwner = totalListedCount; // conservative; enough for local test pagination
  const maxBytes = actor.uploadLimitBytes;
  const usedBytes = sumFileBytes(allOwnerFiles);

  return {
    files: files
      .filter((file) => canAccessFile(actor, file.ownerSub))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    nextCursor: offset + manifests.length < totalForOwner ? encodeCursor(offset + manifests.length) : null,
    quota: {
      usedBytes,
      maxBytes,
      remainingBytes: Math.max(maxBytes - usedBytes, 0),
    },
  };
}

export async function createS3DownloadUrl(
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
  const client = createS3Client();
  const downloadUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: hydrated.bucket,
      Key: hydrated.objectKey,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(hydrated.originalFilename)}`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );

  return {
    file: hydrated,
    downloadUrl,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  };
}

export async function deleteS3File(actor: AdapterActor, fileId: string) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  const client = createS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: manifest.bucket, Key: manifest.objectKey }));
  await client.send(new DeleteObjectCommand({ Bucket: manifest.bucket, Key: buildManifestKey(fileId) }));

  return { id: fileId };
}
