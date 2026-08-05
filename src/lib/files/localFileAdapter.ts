import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { env, getAuthSecret, parseCsv } from "@/src/lib/server/env";

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
const STORAGE_ROOT = path.join(process.cwd(), ".local-data", "file-storage");
const MANIFEST_ROOT = path.join(STORAGE_ROOT, "manifests");
const OBJECT_ROOT = path.join(STORAGE_ROOT, "objects");

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

type UploadTokenPayload = {
  exp: number;
  fileId: string;
  mode: "upload";
  ownerSub: string;
};

type DownloadTokenPayload = {
  exp: number;
  fileId: string;
  mode: "download";
  ownerSub: string;
};

function getConfig() {
  return {
    bucket: "local-user-files",
    maxBytes: env.FILE_UPLOAD_MAX_BYTES,
    allowedMimeTypes: parseCsv(env.FILE_ALLOWED_MIME_TYPES),
    allowedExtensions: parseCsv(env.FILE_ALLOWED_EXTENSIONS).map((value) =>
      value.toLowerCase().replace(/^\./, ""),
    ),
  };
}

async function ensureStorageDirs() {
  await mkdir(MANIFEST_ROOT, { recursive: true });
  await mkdir(OBJECT_ROOT, { recursive: true });
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

function buildObjectPath(objectKey: string) {
  return path.join(OBJECT_ROOT, ...objectKey.split("/"));
}

function buildManifest(ownerSub: string, fileId: string, objectKey: string, request: UploadUrlRequest): FileManifest {
  const config = getConfig();

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

function manifestPath(fileId: string) {
  return path.join(MANIFEST_ROOT, `${fileId}.json`);
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

function assertAllowedFile(request: UploadUrlRequest, actor: AdapterActor, usedBytes: number) {
  const config = getConfig();
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
  await ensureStorageDirs();
  await writeFile(manifestPath(manifest.id), JSON.stringify(manifest, null, 2), "utf8");
}

async function readManifest(fileId: string) {
  try {
    const content = await readFile(manifestPath(fileId), "utf8");
    return JSON.parse(content) as FileManifest;
  } catch {
    return null;
  }
}

function getSigningSecret() {
  const secret = getAuthSecret();

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required for local file signing.");
  }

  return secret;
}

function signToken(payload: UploadTokenPayload | DownloadTokenPayload) {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json, "utf8").toString("base64url");
  const signature = createHmac("sha256", getSigningSecret()).update(base).digest("base64url");
  return `${base}.${signature}`;
}

function verifyToken(token: string, mode: "upload" | "download") {
  const [base, signature] = token.split(".");

  if (!base || !signature) {
    throw new Error("Invalid token.");
  }

  const expected = createHmac("sha256", getSigningSecret()).update(base).digest();
  const actual = Buffer.from(signature, "base64url");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid token.");
  }

  const payload = JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as
    | UploadTokenPayload
    | DownloadTokenPayload;

  if (payload.mode !== mode || payload.exp < Date.now()) {
    throw new Error("Token expired or invalid.");
  }

  return payload;
}

async function hydrateManifest(manifest: FileManifest) {
  const objectPath = buildObjectPath(manifest.objectKey);

  try {
    const objectStat = await stat(objectPath);
    const nextStatus: StoredFileStatus =
      manifest.status === "rejected" ? "rejected" : manifest.status === "verified" ? "verified" : "uploaded";

    const updatedManifest = {
      ...manifest,
      sizeBytes: typeof manifest.sizeBytes === "number" ? manifest.sizeBytes : objectStat.size,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    if (
      updatedManifest.status !== manifest.status ||
      updatedManifest.sizeBytes !== manifest.sizeBytes ||
      updatedManifest.updatedAt !== manifest.updatedAt
    ) {
      await writeManifest(updatedManifest);
    }

    return updatedManifest;
  } catch {
    return manifest;
  }
}

async function listAllManifests() {
  await ensureStorageDirs();
  const entries = await readdir(MANIFEST_ROOT, { withFileTypes: true });
  const manifests: FileManifest[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const manifest = await readManifest(entry.name.replace(/\.json$/, ""));

    if (manifest) {
      manifests.push(manifest);
    }
  }

  return manifests.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function sumFileBytes(files: StoredFile[]) {
  return files.reduce((total, file) => total + (typeof file.sizeBytes === "number" ? file.sizeBytes : 0), 0);
}

export async function createLocalUploadUrl(
  actor: AdapterActor,
  request: UploadUrlRequest,
): Promise<CreateUploadUrlResult> {
  const currentListing = await listLocalFiles(actor, { ownerSub: actor.sub, limit: 10_000 });
  assertAllowedFile(request, actor, currentListing.quota.usedBytes);

  const fileId = crypto.randomUUID();
  const objectKey = buildObjectKey(actor.sub, fileId, request.filename);
  const manifest = buildManifest(actor.sub, fileId, objectKey, request);
  await writeManifest(manifest);

  const token = signToken({
    exp: Date.now() + UPLOAD_URL_TTL_SECONDS * 1000,
    fileId,
    mode: "upload",
    ownerSub: actor.sub,
  });

  return {
    file: manifest,
    uploadUrl: `/api/files/upload/${fileId}?token=${encodeURIComponent(token)}`,
    uploadMethod: "PUT",
    uploadHeaders: request.mimeType ? { "Content-Type": request.mimeType } : {},
  };
}

export async function performLocalUpload(
  actor: AdapterActor,
  fileId: string,
  token: string,
  bytes: Uint8Array,
  mimeType: string | null,
) {
  const payload = verifyToken(token, "upload");
  const manifest = await readManifest(fileId);

  if (!manifest || payload.fileId !== fileId) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub) || payload.ownerSub !== manifest.ownerSub) {
    throw new Error("Forbidden");
  }

  const objectPath = buildObjectPath(manifest.objectKey);
  await mkdir(path.dirname(objectPath), { recursive: true });
  await writeFile(objectPath, bytes);

  const nextManifest: FileManifest = {
    ...manifest,
    mimeType: manifest.mimeType ?? mimeType ?? undefined,
    sizeBytes: bytes.byteLength,
    status: "uploaded",
    updatedAt: new Date().toISOString(),
  };

  await writeManifest(nextManifest);

  return nextManifest;
}

export async function listLocalFiles(
  actor: AdapterActor,
  options: AdapterListOptions = {},
): Promise<FileListResult> {
  const ownerSub = options.ownerSub && actor.isFileAdmin ? options.ownerSub : actor.sub;
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), 100);
  const offset = decodeCursor(options.cursor);
  const all = await listAllManifests();
  const ownerFiles = all.filter((manifest) => manifest.ownerSub === ownerSub);
  const slice = ownerFiles.slice(offset, offset + limit);
  const files = await Promise.all(slice.map(hydrateManifest));
  const hydratedOwnerFiles = await Promise.all(ownerFiles.map(hydrateManifest));
  const usedBytes = sumFileBytes(hydratedOwnerFiles);
  const maxBytes = actor.uploadLimitBytes;

  return {
    files: files.filter((file) => canAccessFile(actor, file.ownerSub)),
    nextCursor: offset + limit < ownerFiles.length
      ? encodeCursor(offset + limit)
      : null,
    quota: {
      usedBytes,
      maxBytes,
      remainingBytes: Math.max(maxBytes - usedBytes, 0),
    },
  };
}

export async function createLocalDownloadUrl(
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
  const token = signToken({
    exp: Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000,
    fileId,
    mode: "download",
    ownerSub: hydrated.ownerSub,
  });

  return {
    file: hydrated,
    downloadUrl: `/api/files/download/${fileId}?token=${encodeURIComponent(token)}`,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  };
}

export async function streamLocalDownload(actor: AdapterActor, fileId: string, token: string) {
  const payload = verifyToken(token, "download");
  const manifest = await readManifest(fileId);

  if (!manifest || payload.fileId !== fileId) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub) || payload.ownerSub !== manifest.ownerSub) {
    throw new Error("Forbidden");
  }

  const objectPath = buildObjectPath(manifest.objectKey);
  const data = await readFile(objectPath);
  const hydrated = await hydrateManifest(manifest);

  return { file: hydrated, data };
}

export async function deleteLocalFile(actor: AdapterActor, fileId: string) {
  const manifest = await readManifest(fileId);

  if (!manifest) {
    throw new Error("File not found.");
  }

  if (!canAccessFile(actor, manifest.ownerSub)) {
    throw new Error("Forbidden");
  }

  await rm(buildObjectPath(manifest.objectKey), { force: true });
  await rm(manifestPath(fileId), { force: true });

  return { id: fileId };
}
